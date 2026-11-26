/**
 * Background Service Worker — collects tab and idle events, buffers them,
 * and flushes them to the CLR engine with this device's token.
 */

importScripts("clr-client.js");

const FLUSH_INTERVAL_MS = 5000;
const FLUSH_AT = 100;          // flush early once this many events are queued
const MAX_BUFFER_SIZE = 500;   // engine limit per batch; oldest events dropped beyond this

let eventBuffer = [];
let flushing = false;
let lastTabId = null;
let lastTabUrl = "";

// ── Tab switching ──────────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    pushEvent({
      source: "browser",
      type: "TAB_SWITCH",
      data: { fromUrl: lastTabUrl, toUrl: tab.url || "" },
    });
    lastTabId = activeInfo.tabId;
    lastTabUrl = tab.url || "";
  } catch (_) {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tabId === lastTabId) {
    pushEvent({ source: "browser", type: "NAVIGATION", data: { url: tab.url || "" } });
    lastTabUrl = tab.url || "";
  }
});

// ── Idle detection ─────────────────────────────────────────────────────────

chrome.idle.setDetectionInterval(30);
chrome.idle.onStateChanged.addListener((state) => {
  if (state === "idle" || state === "locked") {
    pushEvent({ source: "browser", type: "IDLE_START", data: { state } });
  } else if (state === "active") {
    pushEvent({ source: "browser", type: "IDLE_END", data: {} });
  }
});

// ── Messages from the content script and popup ─────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "PAGE_SCROLL") {
    pushEvent({
      source: "browser",
      type: "PAGE_SCROLL",
      data: { deltaY: message.deltaY, velocity: message.velocity, url: message.url },
    });
  } else if (message.type === "CLR_PAIRED") {
    checkFocusMode();
  }
});

// ── Buffer & flush ────────────────────────────────────────────────────────

function pushEvent(event) {
  event.timestamp = Date.now() / 1000;
  eventBuffer.push(event);
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.splice(0, eventBuffer.length - MAX_BUFFER_SIZE);
  }
  if (eventBuffer.length >= FLUSH_AT) flush();
}

async function flush() {
  if (flushing || eventBuffer.length === 0) return;
  flushing = true;
  const batch = eventBuffer.splice(0, eventBuffer.length);
  try {
    const res = await clrFetch("/telemetry/batch", { method: "POST", body: batch });
    if (res === null) {
      // Not paired yet: keep nothing (we don't collect for nobody).
    } else if (!res.ok && res.status >= 500) {
      requeue(batch);   // engine error — try again next flush
    }
    // 401/403/4xx: drop; the popup shows "reconnect" for 401.
  } catch (_) {
    requeue(batch);     // engine unreachable — retry later
  } finally {
    flushing = false;
  }
}

function requeue(batch) {
  eventBuffer = batch.concat(eventBuffer).slice(-MAX_BUFFER_SIZE);
}

// ── Focus mode state (for tab blocking) ───────────────────────────────────

async function checkFocusMode() {
  try {
    const res = await clrFetch("/actions/focus");
    if (!res || !res.ok) {
      await chrome.storage.local.set({ focusActive: false });
      return;
    }
    const state = await res.json();
    // Content scripts read this to decide whether to show the blocking overlay.
    await chrome.storage.local.set({ focusActive: state.active, blockTabs: state.block_tabs });
  } catch (_) {}
}

// setInterval runs while the worker is awake; the alarm wakes it at least
// every 30 s (Chrome's minimum) so buffered events and focus state stay fresh.
setInterval(flush, FLUSH_INTERVAL_MS);
setInterval(checkFocusMode, 3000);
chrome.alarms.create("clr-tick", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "clr-tick") {
    flush();
    checkFocusMode();
  }
});
