/**
 * CLR LMS Connector — background service worker
 *
 * Minimal background script. The content script does all the heavy lifting.
 * This is kept in place to satisfy Manifest V3 requirements and to provide
 * a hook for future features (e.g., badge updates when the engine is offline).
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("[CLR LMS Connector] Installed. Monitoring Canvas / Blackboard / Moodle.");
});
