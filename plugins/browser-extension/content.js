/* global CLR_TOKENS_CSS, clrIcon */
/**
 * Content Script: captures scroll speed, shows the BlockedOverlay over distracting
 * sites during focus mode, and copies the app's theme choice from the dashboard.
 * clr-tokens.js and clr-icons.js load first (see manifest.json).
 */

// ── Scroll telemetry ───────────────────────────────────────────────────────
// Each scroll burst (scrolling with pauses under 500 ms) is reported once with
// the distance moved and the average speed in px/s.

let scrollDebounceTimer = null;
let lastScrollY = window.scrollY;
let burstDistance = 0;
let burstStart = 0;

window.addEventListener("scroll", () => {
  const now = performance.now();
  if (burstDistance === 0) burstStart = now;
  burstDistance += Math.abs(window.scrollY - lastScrollY);
  lastScrollY = window.scrollY;

  clearTimeout(scrollDebounceTimer);
  scrollDebounceTimer = setTimeout(() => {
    const seconds = Math.max((performance.now() - burstStart) / 1000, 0.25);
    if (burstDistance > 0) {
      chrome.runtime.sendMessage({
        type: "PAGE_SCROLL",
        deltaY: Math.round(burstDistance),
        velocity: Math.round(burstDistance / seconds),
        url: window.location.href,
      });
    }
    burstDistance = 0;
  }, 500);
}, { passive: true });

// ── Theme: copy the app's choice so the popup and overlay can follow it ─────

const DEFAULT_DASHBOARD = "http://localhost:5173";

function syncAppTheme(dashboardUrl) {
  let origin;
  try {
    origin = new URL(dashboardUrl || DEFAULT_DASHBOARD).origin;
  } catch (_) {
    return;
  }
  if (location.origin !== origin) return;
  const read = () => {
    let saved = null;
    try {
      saved = localStorage.getItem("clr_theme");
    } catch (_) {}
    chrome.storage.local.set({ appTheme: saved === "light" || saved === "dark" ? saved : null });
  };
  read();
  document.addEventListener("visibilitychange", read);
  window.addEventListener("storage", (e) => e.key === "clr_theme" && read());
}

// ── Focus mode: BlockedOverlay (design/components/BlockedOverlay) ──────────
// A solid cover over distracting sites, in a closed shadow root so the page's CSS
// can't reach it and ours can't leak out. "Back to work" takes focus; a 5-minute
// pass is a deliberate choice, 3 per focus session (the background worker counts
// them in chrome.storage); Esc does nothing.

const MAX_PASSES = 3;
const STATE_KEYS = ["focusActive", "blockTabs", "focusDuration", "focusStartedAt", "passes", "passesUsed", "dashboardUrl", "engineUrl", "appTheme"];
// Sites that stay open during focus. The engine has no blocked-sites list yet.
const ALLOWED_SITES = [
  "stackoverflow.com", "arxiv.org", "scholar.google.com",
  "docs.python.org", "developer.mozilla.org", "coursera.org",
  "edx.org", "khanacademy.org", "localhost", "127.0.0.1",
];

const site = location.hostname.replace(/^www\./, "");
let store = {};
let guard = null; // { kind: "overlay" | "pass", host, root }
let ticker = null;
let savedInert = false;

const OVERLAY_CSS = `
:host { all: initial; }
[hidden] { display: none !important; }
*, *::before, *::after { box-sizing: border-box; }
.theme { font-family: var(--font-sans); font-size: 15px; line-height: 22px; color: var(--ink); -webkit-font-smoothing: antialiased; }
:where(button):focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
:where(button):focus:not(:focus-visible) { outline: none; }
p, h1 { margin: 0; }

.cover { position: fixed; inset: 0; overflow: auto; display: grid; place-items: center; padding: 24px; background: var(--bg); }
.card { width: 480px; max-width: 100%; display: grid; justify-items: center; gap: 14px; padding: 40px 36px 32px; text-align: center; border-radius: var(--radius-xl); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-lg); }
.art { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); }
.eyebrow { font-size: 11px; line-height: 16px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-subtle); overflow-wrap: anywhere; }
.title { font-size: 28px; line-height: 34px; font-weight: 600; letter-spacing: -.02em; color: var(--ink); }
.line { color: var(--ink-muted); }
.meter { width: 100%; margin: 6px 0; }
.progress { height: 8px; border-radius: 4px; background: var(--surface-sunken); overflow: hidden; }
.progress span { display: block; height: 100%; border-radius: 4px; background: var(--accent); }
.ticks { display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; line-height: 16px; font-weight: 500; color: var(--ink-subtle); font-variant-numeric: tabular-nums; }
.actions { display: grid; gap: 8px; width: 100%; }
.caption { font-size: 12px; line-height: 16px; font-weight: 500; color: var(--ink-subtle); }

.btn { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: var(--radius-md); border: 1px solid transparent; font: inherit; font-size: 15px; line-height: 20px; font-weight: 500; white-space: nowrap; cursor: pointer; }
.btn.primary { background: var(--accent); color: var(--on-accent); }
.btn.primary:hover { background: var(--accent-hover); }
.btn.ghost { background: transparent; color: var(--ink-muted); }
.btn.ghost:hover { background: var(--surface-hover); color: var(--ink); }
.btn.lg { height: 52px; padding: 0 22px; font-size: 16px; }
.btn.sm { height: 32px; padding: 0 12px; font-size: 14px; border-radius: 10px; }
.btn.block { width: 100%; }
.btn.accent { color: var(--accent); }
.link { padding: 0; border: 0; background: none; font: inherit; font-size: 12px; font-weight: 500; color: var(--accent); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; cursor: pointer; }

.passbar { position: fixed; top: 0; left: 0; right: 0; height: 40px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0 12px; font-size: 14px; line-height: 20px; color: var(--ink); background: linear-gradient(var(--accent-soft), var(--accent-soft)), var(--bg); border-bottom: 1px solid var(--line); }
.passbar > svg { flex: none; color: var(--accent); }
.passbar b { font-weight: 600; font-variant-numeric: tabular-nums; }
@media (max-width: 560px) { .passbar .rest { display: none; } }
`;

function themeFor() {
  if (store.appTheme === "light" || store.appTheme === "dark") return store.appTheme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function siteIsAllowed() {
  if (ALLOWED_SITES.some((d) => location.hostname.includes(d))) return true;
  for (const url of [store.dashboardUrl || DEFAULT_DASHBOARD, store.engineUrl]) {
    try {
      if (url && new URL(url).hostname === location.hostname) return true;
    } catch (_) {}
  }
  return !/^https?:$/.test(location.protocol);
}

const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const minutesWord = (n) => `${n} minute${n === 1 ? "" : "s"}`;
const timeOfDay = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();

/** Mount a shadow host on <html> (not <body>, which goes inert behind the overlay). */
function mount(kind) {
  if (guard && guard.kind === kind) return guard;
  unmount();
  const host = document.createElement("clr-focus-guard");
  host.style.cssText = "all: initial !important; position: fixed !important; z-index: 2147483647 !important; " +
    (kind === "overlay" ? "inset: 0 !important;" : "top: 0 !important; left: 0 !important; right: 0 !important; height: 40px !important;");
  const root = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = CLR_TOKENS_CSS + OVERLAY_CSS;
  const theme = document.createElement("div");
  theme.className = "theme";
  theme.setAttribute("data-theme", themeFor());
  root.append(style, theme);
  document.documentElement.appendChild(host);
  guard = { kind, host, root, theme };
  return guard;
}

function unmount() {
  if (!guard) return;
  guard.host.remove();
  if (guard.kind === "overlay") {
    document.removeEventListener("play", pauseMedia, true);
    if (document.body && !savedInert) document.body.inert = false;
  }
  guard = null;
  clearInterval(ticker);
  ticker = null;
}

function pauseMedia(e) {
  const media = e && e.target instanceof HTMLMediaElement ? [e.target] : document.querySelectorAll("video, audio");
  media.forEach((m) => {
    try {
      m.pause();
    } catch (_) {}
  });
}

/** Keys typed in the overlay stay in the overlay: Esc does nothing, Tab cycles. */
function trapKeys(root, e) {
  e.stopPropagation();
  if (e.type !== "keydown" || e.key !== "Tab") return;
  const items = [...root.querySelectorAll("button:not([hidden])")];
  if (!items.length) return;
  const i = items.indexOf(root.activeElement);
  const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1;
  e.preventDefault();
  items[next].focus();
}

function showOverlay() {
  const fresh = !guard || guard.kind !== "overlay";
  const g = mount("overlay");
  if (fresh) {
    g.theme.innerHTML = `
      <div class="cover" role="dialog" aria-modal="true" aria-labelledby="t" aria-describedby="d">
        <div class="card">
          <span class="art">${clrIcon("shield-check", 28)}</span>
          <p class="eyebrow" id="site"></p>
          <h1 class="title" id="t"></h1>
          <p class="line" id="d"></p>
          <div class="meter">
            <div class="progress" id="bar" role="progressbar" aria-label="Focus session" aria-valuemin="0"><span></span></div>
            <div class="ticks"><span id="elapsed"></span><span id="total"></span></div>
          </div>
          <div class="actions">
            <button type="button" class="btn primary lg block" id="back">${clrIcon("arrow-left", 18)}Back to work</button>
            <button type="button" class="btn ghost block" id="pass">Let me through for 5 min</button>
          </div>
          <p class="caption"><span id="passes"></span> · <button type="button" class="link" id="end">End focus mode</button></p>
        </div>
      </div>`;
    const $ = (id) => g.root.getElementById(id);
    $("back").addEventListener("click", () => chrome.runtime.sendMessage({ type: "CLR_BACK_TO_WORK" }));
    $("pass").addEventListener("click", () => chrome.runtime.sendMessage({ type: "CLR_TAKE_PASS", site }));
    $("end").addEventListener("click", () => {
      $("end").disabled = true;
      chrome.runtime.sendMessage({ type: "CLR_STOP_FOCUS" });
    });
    for (const type of ["keydown", "keyup", "keypress"]) g.host.addEventListener(type, (e) => trapKeys(g.root, e));
    // The page behind can't be clicked, focused, read aloud or heard.
    savedInert = !!(document.body && document.body.inert);
    if (document.body) document.body.inert = true;
    pauseMedia();
    document.addEventListener("play", pauseMedia, true);
    ticker = setInterval(updateOverlay, 1000);
    updateOverlay();
    $("back").focus();
    return;
  }
  updateOverlay();
}

function updateOverlay() {
  if (!guard || guard.kind !== "overlay") return;
  const $ = (id) => guard.root.getElementById(id);
  const total = (store.focusDuration || 0) * 60;
  const elapsed = Math.max(0, Math.min(total, (Date.now() - (store.focusStartedAt || Date.now())) / 1000));
  const mins = Math.floor(elapsed / 60);
  const left = Math.max(0, Math.ceil((total - elapsed) / 60));
  const used = Math.min(store.passesUsed || 0, MAX_PASSES);

  $("site").textContent = `${site} is paused`;
  $("t").textContent = mins < 1 ? "Your focus session has just started." : `You’re ${minutesWord(mins)} into a focus session.`;
  $("d").textContent = left > 0
    ? `${minutesWord(left)} to go. This will still be here at ${timeOfDay(Date.now() + left * 60000)}.`
    : "Your session is about to end. This will be here in a moment.";
  const bar = $("bar");
  bar.setAttribute("aria-valuemax", String(Math.round(total / 60)));
  bar.setAttribute("aria-valuenow", String(mins));
  bar.setAttribute("aria-valuetext", `${mins} of ${Math.round(total / 60)} minutes`);
  bar.firstElementChild.style.width = `${total ? (elapsed / total) * 100 : 0}%`;
  $("elapsed").textContent = clock(elapsed);
  $("total").textContent = clock(total);
  const pass = $("pass");
  const out = used >= MAX_PASSES;
  if (out && guard.root.activeElement === pass) $("back").focus();
  pass.hidden = out;
  $("passes").textContent = `Used ${used} of ${MAX_PASSES} passes this session`;
}

function showPassBar(until) {
  const fresh = !guard || guard.kind !== "pass";
  const g = mount("pass");
  if (fresh) {
    g.theme.innerHTML = `
      <div class="passbar" role="region" aria-label="Focus mode pass">
        ${clrIcon("timer", 16)}
        <span>Pass active · <b id="left"></b> left<span class="rest">, then this tab pauses again</span></span>
        <button type="button" class="btn ghost sm accent" id="now">Back to work now</button>
      </div>`;
    g.root.getElementById("now").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "CLR_END_PASS", site });
      chrome.runtime.sendMessage({ type: "CLR_BACK_TO_WORK" });
    });
    ticker = setInterval(() => evaluate(), 1000);
  }
  g.root.getElementById("left").textContent = clock(Math.max(0, (until - Date.now()) / 1000));
}

function evaluate() {
  if (!store.focusActive || !store.blockTabs || siteIsAllowed()) return unmount();
  const until = (store.passes || {})[site] || 0;
  if (until > Date.now()) showPassBar(until);
  else showOverlay();
  if (guard) guard.theme.setAttribute("data-theme", themeFor());
}

function load() {
  chrome.storage.local.get(STATE_KEYS, (s) => {
    store = s;
    evaluate();
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && STATE_KEYS.some((k) => k in changes)) load();
});
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => guard && guard.theme.setAttribute("data-theme", themeFor()));

chrome.storage.local.get(["dashboardUrl"], (s) => syncAppTheme(s.dashboardUrl));
load();
