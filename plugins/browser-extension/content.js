/**
 * Content Script — captures scroll events and focus blocking.
 */

// ── Scroll telemetry ───────────────────────────────────────────────────────

let scrollDebounceTimer = null;

window.addEventListener("scroll", () => {
  clearTimeout(scrollDebounceTimer);
  scrollDebounceTimer = setTimeout(() => {
    chrome.runtime.sendMessage({
      type: "PAGE_SCROLL",
      deltaY: window.scrollY,
      url: window.location.href,
    });
  }, 500);
}, { passive: true });

// ── Focus mode tab blocking ────────────────────────────────────────────────

const BLOCKED_OVERLAY_ID = "clr-blocked-overlay";

function showBlockedOverlay() {
  if (document.getElementById(BLOCKED_OVERLAY_ID)) return;
  const overlay = document.createElement("div");
  overlay.id = BLOCKED_OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(15, 15, 30, 0.96); color: #fff;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; z-index: 2147483647; font-family: sans-serif;
  `;
  overlay.innerHTML = `
    <div style="font-size:3rem;margin-bottom:1rem">🧠</div>
    <h2 style="margin:0 0 0.5rem">Focus Mode Active</h2>
    <p style="opacity:.7;margin:0">Cognitive Load Router has blocked this tab to protect your deep-work session.</p>
  `;
  document.body.appendChild(overlay);
}

function removeBlockedOverlay() {
  const el = document.getElementById(BLOCKED_OVERLAY_ID);
  if (el) el.remove();
}

// Check focus state every 3 seconds
function checkFocusBlock() {
  chrome.storage.local.get(["focusActive", "blockTabs"], ({ focusActive, blockTabs }) => {
    if (focusActive && blockTabs) {
      // Only block non-academic pages (heuristic: check hostname)
      const academicDomains = [
        "stackoverflow.com", "arxiv.org", "scholar.google.com",
        "docs.python.org", "developer.mozilla.org", "coursera.org",
        "edx.org", "khanacademy.org", "localhost",
      ];
      const isAcademic = academicDomains.some(d => location.hostname.includes(d));
      if (!isAcademic) {
        showBlockedOverlay();
      }
    } else {
      removeBlockedOverlay();
    }
  });
}

setInterval(checkFocusBlock, 3000);
checkFocusBlock();
