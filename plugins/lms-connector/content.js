/**
 * CLR LMS Connector — content script
 *
 * Runs on Canvas, Blackboard, and Moodle pages.
 * Detects the LMS platform, observes navigation and interactions,
 * and sends telemetry to the local CLR engine.
 *
 * Supported LMS platforms:
 *   Canvas    (*.instructure.com)
 *   Blackboard (*.blackboard.com)
 *   Moodle    (*.moodle.org, *.moodlecloud.com)
 */

const API_BASE = "http://127.0.0.1:8765";
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

async function flush() {
  if (!_buffer.length) return;
  const batch = _buffer.splice(0);
  try {
    await fetch(`${API_BASE}/telemetry/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
  } catch (_) {
    // Engine offline — silently discard; never block the student
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

let _scrollBuffer = 0;
let _scrollTimer = null;

window.addEventListener("scroll", (e) => {
  _scrollBuffer += Math.abs(window.scrollY - (_scrollBuffer || 0));
}, { passive: true });

// Emit a scroll event every 3 seconds if there was scroll activity
setInterval(() => {
  if (_scrollBuffer > 0) {
    enqueue("LMS_SCROLL", { deltaY: Math.round(_scrollBuffer) });
    _scrollBuffer = 0;
  }
}, 3000);

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
