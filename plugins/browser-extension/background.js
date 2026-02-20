/**
 * Background Service Worker — collects tab and idle events,
 * buffers them locally, and flushes to the CLR engine API.
 */

const API_BASE = "http://127.0.0.1:8765";
const FLUSH_INTERVAL_MS = 5000;
const MAX_BUFFER_SIZE = 100;

let eventBuffer = [];
let lastTabId = null;
let lastTabUrl = "";

// ── Tab switching ──────────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    pushEvent({
      source: "browser",
      type: "TAB_SWITCH",
      data: {
        fromUrl: lastTabUrl,
        toUrl: tab.url || "",
      },
    });
    lastTabId = activeInfo.tabId;
    lastTabUrl = tab.url || "";
  } catch (_) {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tabId === lastTabId) {
    pushEvent({
      source: "browser",
      type: "NAVIGATION",
      data: { url: tab.url || "" },
    });
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

// ── Message from content script ───────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "PAGE_SCROLL") {
    pushEvent({
      source: "browser",
      type: "PAGE_SCROLL",
      data: { deltaY: message.deltaY, url: message.url },
    });
  }
});

// ── Buffer & flush ────────────────────────────────────────────────────────

function pushEvent(event) {
  event.timestamp = Date.now() / 1000;
  eventBuffer.push(event);
  if (eventBuffer.length >= MAX_BUFFER_SIZE) {
    flush();
  }
}

async function flush() {
  if (eventBuffer.length === 0) return;
  const batch = eventBuffer.splice(0, eventBuffer.length);
  try {
    await fetch(`${API_BASE}/telemetry/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
  } catch (_) {
    // Engine not running — silently drop; extension should not crash
  }
}

// ── State polling for focus mode (block tabs) ─────────────────────────────

async function checkFocusMode() {
  try {
    const res = await fetch(`${API_BASE}/actions/focus`);
    if (!res.ok) return;
    const state = await res.json();
    // Store state so content scripts can query it
    chrome.storage.local.set({ focusActive: state.active, blockTabs: state.block_tabs });
  } catch (_) {}
}

setInterval(flush, FLUSH_INTERVAL_MS);
setInterval(checkFocusMode, 3000);
