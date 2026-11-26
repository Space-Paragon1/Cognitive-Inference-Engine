/**
 * CLR LMS Connector — background service worker
 *
 * Receives event batches from the content script and sends them to the CLR
 * engine with this device's token. The content script can't do this itself:
 * requests from a content script are subject to the LMS page's CORS rules.
 */

importScripts("clr-client.js");

const MAX_BUFFER_SIZE = 500;
let buffer = [];
let flushing = false;

chrome.runtime.onInstalled.addListener(async (details) => {
  const cfg = await clrGetConfig();
  if (details.reason === "install" && !cfg.deviceToken) {
    chrome.runtime.openOptionsPage();   // first run: ask the student to pair
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CLR_EVENTS" && Array.isArray(message.events)) {
    buffer = buffer.concat(message.events).slice(-MAX_BUFFER_SIZE);
    flush();
  }
});

async function flush() {
  if (flushing || buffer.length === 0) return;
  flushing = true;
  const batch = buffer.splice(0, buffer.length);
  try {
    const res = await clrFetch("/telemetry/batch", { method: "POST", body: batch });
    if (res && !res.ok && res.status >= 500) requeue(batch);
    // Not paired (null) or 4xx: drop. The options page shows the connection state.
  } catch (_) {
    requeue(batch);   // engine unreachable — retry on the next alarm
  } finally {
    flushing = false;
  }
}

function requeue(batch) {
  buffer = batch.concat(buffer).slice(-MAX_BUFFER_SIZE);
}

chrome.alarms.create("clr-flush", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "clr-flush") flush();
});
