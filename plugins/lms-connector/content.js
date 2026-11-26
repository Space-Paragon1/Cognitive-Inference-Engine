/**
 * CLR LMS Connector — content script
 *
 * Runs on Canvas, Blackboard, and Moodle pages.
 * Detects the LMS platform, observes navigation and interactions,
 * and hands events to the background worker, which sends them to the engine.
 * (Content scripts can't call the engine directly: their requests are
 * subject to the LMS page's CORS rules.)
 *
 * Supported LMS platforms:
 *   Canvas    (*.instructure.com)
 *   Blackboard (*.blackboard.com)
 *   Moodle    (*.moodle.org, *.moodlecloud.com)
 */

const FLUSH_INTERVAL_MS = 5000;
const IDLE_THRESHOLD_MS = 60_000; // 1 minute without interaction → LMS_IDLE

// ── LMS platform detection ──────────────────────────────────────────────────

function detectPlatform() {
  const host = window.location.hostname;
  if (/instructure\.com|canvas\.com/.test(host)) return "canvas";
  if (/blackboard\.com/.test(host)) return "blackboard";
  if (/moodle\.(org|cloud|net)|moodlecloud\.com/.test(host)) return "moodle";
  // Generic fallback: check for well-known LMS body classes / meta
  if (document.querySelector('meta[name="generator"][content*="Moodle"]')) return "moodle";
  if (document.getElementById("application") && document.querySelector(".ic-app")) return "canvas";
  if (document.getElementById("basePageLayout")) return "blackboard";
  return "lms";
}

// ── Course / page context extraction ───────────────────────────────────────

function extractContext() {
  const platform = detectPlatform();
  let course = "unknown";
  let title = document.title || "";

  if (platform === "canvas") {
    // Canvas embeds course name in breadcrumbs
    const crumb = document.querySelector("#breadcrumbs li:nth-child(2) a");
    if (crumb) course = crumb.textContent.trim();
  } else if (platform === "blackboard") {
    const crumb = document.querySelector("#courseMenuPalette_paletteTitleHeading");
    if (crumb) course = crumb.textContent.trim();
  } else if (platform === "moodle") {
    const heading = document.querySelector(".breadcrumb li:nth-child(2) a");
    if (heading) course = heading.textContent.trim();
  }

  return { platform, course, title, url: window.location.href };
}

// ── Page type classification ────────────────────────────────────────────────

function classifyPage(url, title, platform) {
  const u = url.toLowerCase();
  if (/quiz|exam|test/.test(u) && !/result|score/.test(u)) return "QUIZ_START";
  if (/quiz.*result|quiz.*score|exam.*score/.test(u)) return "GRADE_VIEW";
  if (/assignment|submit|upload/.test(u)) return "ASSIGNMENT_VIEW";
  if (/discussion|forum|board/.test(u)) return "DISCUSSION_VIEW";
  if (/grade|mark|feedback/.test(u)) return "GRADE_VIEW";
  if (/announcement|news|bulletin/.test(u)) return "ANNOUNCEMENT_VIEW";
  if (/file|resource|module|content|lesson/.test(u)) return "RESOURCE_OPEN";
  return "COURSE_NAVIGATE";
}

// ── Event buffer & flush ────────────────────────────────────────────────────

let _buffer = [];

function enqueue(type, extraData = {}) {
  const ctx = extractContext();
  _buffer.push({
    source: "lms",
    type,
    timestamp: Date.now() / 1000,
    data: {
      lms: ctx.platform,
      course: ctx.course,
      title: ctx.title,
      url: ctx.url,
      ...extraData,
    },
  });
}

function flush() {
  if (!_buffer.length) return;
  const batch = _buffer.splice(0);
  try {
    chrome.runtime.sendMessage({ type: "CLR_EVENTS", events: batch });
  } catch (_) {
    // Extension was reloaded/updated under this page — drop; never block the student
  }
}

setInterval(flush, FLUSH_INTERVAL_MS);

// ── Page load / SPA navigation detection ───────────────────────────────────

let _lastUrl = window.location.href;
let _lastTitle = document.title;

function onPageChange(newUrl, newTitle) {
  const ctx = extractContext();
  const eventType = classifyPage(newUrl, newTitle, ctx.platform);
  enqueue(eventType, { fromUrl: _lastUrl, toUrl: newUrl });
  _lastUrl = newUrl;
  _lastTitle = newTitle;
}

// Initial page load event
onPageChange(window.location.href, document.title);

// SPA navigation: watch URL changes via MutationObserver + popstate
const _observer = new MutationObserver(() => {
  const currentUrl = window.location.href;
  const currentTitle = document.title;
  if (currentUrl !== _lastUrl || currentTitle !== _lastTitle) {
    onPageChange(currentUrl, currentTitle);
  }
});
_observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener("popstate", () => onPageChange(window.location.href, document.title));

// ── Scroll telemetry ────────────────────────────────────────────────────────

let _scrollDistance = 0;
let _lastScrollY = window.scrollY;
const SCROLL_REPORT_MS = 3000;

window.addEventListener("scroll", () => {
  _scrollDistance += Math.abs(window.scrollY - _lastScrollY);
  _lastScrollY = window.scrollY;
}, { passive: true });

// Every 3 seconds, report the distance scrolled and the average speed (px/s).
setInterval(() => {
  if (_scrollDistance > 0) {
    enqueue("LMS_SCROLL", {
      deltaY: Math.round(_scrollDistance),
      velocity: Math.round(_scrollDistance / (SCROLL_REPORT_MS / 1000)),
    });
    _scrollDistance = 0;
  }
}, SCROLL_REPORT_MS);

// ── Idle detection ──────────────────────────────────────────────────────────

let _lastActivity = Date.now();
let _isIdle = false;

function onActivity() {
  if (_isIdle) {
    enqueue("LMS_ACTIVE");
    _isIdle = false;
  }
  _lastActivity = Date.now();
}

["mousemove", "keydown", "click", "scroll", "touchstart"].forEach((evt) => {
  window.addEventListener(evt, onActivity, { passive: true });
});

setInterval(() => {
  const silent = Date.now() - _lastActivity;
  if (!_isIdle && silent >= IDLE_THRESHOLD_MS) {
    enqueue("LMS_IDLE");
    _isIdle = true;
  }
}, 10_000);

// ── Page visibility ─────────────────────────────────────────────────────────

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    enqueue("PAGE_HIDDEN");
    flush(); // Flush immediately before page is suspended
  } else {
    enqueue("PAGE_VISIBLE");
  }
});

// ── Quiz-specific signals ───────────────────────────────────────────────────

// Canvas quiz submit button
document.addEventListener("click", (e) => {
  const target = e.target;
  if (!target) return;
  const text = target.textContent?.toLowerCase() ?? "";
  const isSubmit = text.includes("submit quiz") || text.includes("submit exam")
    || target.id === "submit_quiz_button"
    || target.classList.contains("submit_quiz_button");
  if (isSubmit) enqueue("QUIZ_SUBMIT");
}, { capture: true });

// Flush on unload
window.addEventListener("beforeunload", () => { flush(); });
