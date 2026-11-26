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

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "PAGE_SCROLL") {
    pushEvent({
      source: "browser",
      type: "PAGE_SCROLL",
      data: { deltaY: message.deltaY, velocity: message.velocity, url: message.url },
    });
  } else if (message.type === "CLR_PAIRED" || message.type === "CLR_FOCUS_CHANGED") {
    checkFocusMode();
  } else if (message.type === "CLR_BACK_TO_WORK") {
    backToWork(sender.tab);
  } else if (message.type === "CLR_TAKE_PASS") {
    takePass(message.site);
  } else if (message.type === "CLR_END_PASS") {
    endPass(message.site);
  } else if (message.type === "CLR_STOP_FOCUS") {
    stopFocus();
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
    } else if (res.ok) {
      // The popup's footer shows "Sent 4s ago".
      chrome.storage.local.set({ lastSentAt: Date.now() });
    } else if (res.status >= 500) {
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

// ── Focus mode state (for the blocked-tab overlay) ─────────────────────────
// Content scripts read these keys from chrome.storage:
//   focusActive, blockTabs, focusDuration (min), focusStartedAt (ms, estimated)
//   passes { site: untilMs } and passesUsed: the 5-minute passes, 3 per session.

const PASS_MS = 5 * 60 * 1000;
const MAX_PASSES = 3;

async function checkFocusMode() {
  try {
    const res = await clrFetch("/actions/focus");
    if (!res || !res.ok) {
      await chrome.storage.local.set({ focusActive: false, passes: {} });
      return;
    }
    const state = await res.json();
    const prev = await chrome.storage.local.get(["focusActive", "focusStartedAt", "passes"]);
    const update = { focusActive: state.active, blockTabs: state.block_tabs, focusDuration: state.duration_minutes };
    if (state.active) {
      // The engine has no session id, so a session is known by its start time.
      // A start more than 90 s away from the stored one is a new session: passes reset.
      const startedAt = Date.now() - state.elapsed_minutes * 60000;
      const same = prev.focusActive && prev.focusStartedAt && Math.abs(prev.focusStartedAt - startedAt) < 90000;
      update.focusStartedAt = same ? prev.focusStartedAt : startedAt;
      if (same) {
        update.passes = Object.fromEntries(Object.entries(prev.passes || {}).filter(([, until]) => until > Date.now()));
      } else {
        update.passes = {};
        update.passesUsed = 0;
      }
    } else {
      update.passes = {};
    }
    await chrome.storage.local.set(update);
  } catch (_) {}
}

async function takePass(site) {
  if (!site) return;
  const { focusActive, passesUsed = 0, passes = {} } = await chrome.storage.local.get(["focusActive", "passesUsed", "passes"]);
  if (!focusActive || passesUsed >= MAX_PASSES) return;
  await chrome.storage.local.set({ passes: { ...passes, [site]: Date.now() + PASS_MS }, passesUsed: passesUsed + 1 });
}

async function endPass(site) {
  const { passes = {} } = await chrome.storage.local.get("passes");
  delete passes[site];
  await chrome.storage.local.set({ passes });
}

/** "Back to work": close the blocked tab, or go back when it's the window's only tab. */
async function backToWork(tab) {
  if (!tab || tab.id == null) return;
  try {
    const others = await chrome.tabs.query({ windowId: tab.windowId });
    if (others.length > 1) {
      await chrome.tabs.remove(tab.id);
      return;
    }
    await chrome.tabs.goBack(tab.id);
  } catch (_) {
    const cfg = await clrGetConfig();
    chrome.tabs.update(tab.id, { url: cfg.dashboardUrl }).catch(() => {});
  }
}

async function stopFocus() {
  try {
    await clrFetch("/actions/focus/stop", { method: "POST" });
  } catch (_) {}
  await checkFocusMode();
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
