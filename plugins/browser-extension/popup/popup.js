/* global clrGetConfig, clrFetch, clrPair, clrUnpair, clrOriginPattern, clrDeviceName, clrIcon */
/**
 * ExtensionPopup (design/components/ExtensionPopup): live with focus off, focus mode
 * on, and not paired, plus a small settings view behind the header button.
 *
 * While open it polls GET /state and GET /actions/focus every 3 s (both accept this
 * browser's device token). The live view is built once and patched in place, so
 * keyboard focus survives every update.
 */

const CTX = {
  deep_focus: { label: "Deep focus", icon: "target" },
  shallow_work: { label: "Shallow work", icon: "waves" },
  stuck: { label: "Stuck", icon: "repeat" },
  fatigue: { label: "Fatigue", icon: "battery-low" },
  recovering: { label: "Recovering", icon: "leaf" },
  unknown: { label: "Warming up", icon: "circle-dashed" },
};
const PARTS = [
  ["intrinsic", "Intrinsic"],
  ["extraneous", "Extraneous"],
  ["germane", "Germane"],
];
/** Same default as the app's Focus mode card. */
const FOCUS_MINUTES = 25;
const POLL_MS = 3000;

const body = document.getElementById("body");
const foot = document.getElementById("foot");
const settingsBtn = document.getElementById("settingsBtn");
settingsBtn.innerHTML = clrIcon("settings", 18);

let cfg = null;
let mode = null; // "live" | "unpaired" | "settings"
let showingSettings = false;
let pollTimer = null;
let snapshot = { reachable: null, state: null, focus: null };
let lastSentAt = null;
let busy = false; // a focus start or stop is in flight
let focusKind = null;
let footKind = null;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pct = (v) => Math.round(v * 100);
const paired = () => !!(cfg && cfg.deviceToken && !cfg.authError);
const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch (_) {
    return url;
  }
};

function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

function logo(size) {
  return `<svg class="logo" width="${size}" height="${size}" viewBox="14 14 80 80" aria-hidden="true" focusable="false"><path class="links" d="M54 47V31M47 54H31M61 54h16M49 59 37 72M59 59l12 13"/><g class="nodes"><circle cx="54" cy="54" r="7"/><circle cx="54" cy="25" r="5"/><circle cx="25" cy="54" r="5"/><circle cx="83" cy="54" r="5"/><circle cx="33" cy="77" r="5"/><circle cx="75" cy="77" r="5"/></g></svg>`;
}

function note(tone, icon, text) {
  return `<div class="note" data-tone="${tone}" role="status">${clrIcon(icon, 16)}<span>${esc(text)}</span></div>`;
}

// ── Footer: connection status and when telemetry was last sent ─────────────

function renderFoot() {
  if (!cfg) return;
  let kind, chip, text;
  if (!paired()) {
    kind = "unpaired";
    chip = ["offline", "Not paired"];
    text = `v${chrome.runtime.getManifest().version}`;
  } else if (snapshot.reachable === false) {
    kind = "offline";
    chip = ["offline", "Offline"];
    text = "Retrying every few seconds";
  } else if (snapshot.reachable === null) {
    kind = "connecting";
    chip = ["reconnecting", "Connecting"];
    text = "";
  } else {
    kind = "live";
    chip = ["live", "Live"];
    text = lastSentAt ? `Sent ${ago(lastSentAt)}` : "Nothing sent yet";
  }
  // Rebuild only when the status changes, so the live dot's ping keeps its rhythm.
  if (kind !== footKind) {
    footKind = kind;
    foot.innerHTML = `<span class="conn ${chip[0]}"><span class="conn-dot" aria-hidden="true"></span>${chip[1]}</span><span id="footText"></span>`;
  }
  $("footText").textContent = text;
}

// ── Live view ───────────────────────────────────────────────────────────────

function buildLive() {
  mode = "live";
  focusKind = null;
  body.className = "content";
  body.setAttribute("aria-busy", "true");
  body.innerHTML = `
    <section class="live" id="liveRow" data-ctx="unknown" aria-label="Your load right now">
      <span class="ring empty" id="ring" role="meter" aria-label="Cognitive load" aria-valuemin="0" aria-valuemax="100">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle class="track" cx="24" cy="24" r="20" fill="none" stroke-width="5"/>
          <circle class="arc" id="arc" cx="24" cy="24" r="20" fill="none" stroke-width="5" pathLength="100" stroke-dasharray="0 100" stroke-linecap="round" transform="rotate(-90 24 24)"/>
        </svg>
        <span class="num" id="num" aria-hidden="true">–</span>
      </span>
      <div class="meta">
        <span class="pill" id="pill"></span>
        <span class="sm muted" id="conf"></span>
      </div>
    </section>
    <div class="breakdown" id="breakdown" aria-label="What makes up your load">
      ${PARTS.map(
        ([k, label]) => `
        <div class="bd-row bd-${k}">
          <span class="bd-name"><i aria-hidden="true"></i>${label}</span>
          <span class="bd-val" id="v-${k}">–</span>
          <span class="bar" aria-hidden="true"><span id="b-${k}" style="width:0%"></span></span>
        </div>`
      ).join("")}
    </div>
    <div class="stack" id="focusArea"></div>`;
  updateLive();
}

function updateLive() {
  const { reachable, state } = snapshot;
  const has = !!(reachable && state && state.active);
  const ctx = has && CTX[state.context] ? state.context : "unknown";
  const load = has ? state.load_score : null;
  const conf = has ? state.confidence : 0;
  const uncertain = has && conf < 0.5;

  $("liveRow").dataset.ctx = ctx;
  const ring = $("ring");
  ring.classList.toggle("empty", load == null);
  ring.classList.toggle("offline", reachable === false);
  const arc = $("arc");
  arc.setAttribute("stroke-dasharray", uncertain ? "1 6" : `${((load || 0) * 100).toFixed(1)} 100`);
  arc.classList.toggle("dotted", uncertain);
  $("num").textContent = load == null ? "–" : String(pct(load));
  if (load == null) ring.removeAttribute("aria-valuenow");
  else ring.setAttribute("aria-valuenow", String(pct(load)));
  ring.setAttribute(
    "aria-valuetext",
    load == null
      ? reachable === false
        ? "Offline. No reading."
        : "No reading yet"
      : `Load ${pct(load)} percent, ${CTX[ctx].label.toLowerCase()}, confidence ${pct(conf)} percent`
  );

  const pill = $("pill");
  pill.classList.toggle("uncertain", uncertain);
  if (reachable === false) pill.innerHTML = `${clrIcon("wifi-off", 16)}Offline`;
  else if (reachable === null) pill.innerHTML = `${clrIcon("circle-dashed", 16)}Connecting`;
  else pill.innerHTML = `${clrIcon(CTX[ctx].icon, 16)}${CTX[ctx].label}`;

  $("conf").innerHTML = has
    ? `Confidence <b class="strong tnum">${pct(conf)}%</b>${uncertain ? " · rough" : ""}`
    : reachable === false
      ? `Can't reach CLR at ${esc(hostOf(cfg.engineUrl))}`
      : reachable === null
        ? ""
        : "Waiting for activity";

  $("breakdown").classList.toggle("uncertain", uncertain);
  for (const [k] of PARTS) {
    const v = has && state.breakdown ? state.breakdown[k] : null;
    $(`v-${k}`).textContent = v == null ? "–" : `${pct(v)}%`;
    $(`b-${k}`).style.width = `${v == null ? 0 : pct(v)}%`;
  }

  if (!busy) updateFocusArea(false);
}

function updateFocusArea(takeFocus) {
  const { reachable, focus } = snapshot;
  const kind = reachable !== true ? "off-disabled" : focus && focus.active ? "on" : "off";
  const area = $("focusArea");
  if (kind !== focusKind) {
    const hadFocus = takeFocus || area.contains(document.activeElement);
    focusKind = kind;
    body.classList.toggle("tight", kind === "on");
    area.innerHTML =
      kind === "on"
        ? `<div class="card">
             <div class="card-head">
               <b class="card-title">${clrIcon("shield-check", 14)}Focus mode</b>
               <span class="sm muted tnum" id="focusTime"></span>
             </div>
             <div class="progress" id="focusBar" role="progressbar" aria-label="Focus session" aria-valuemin="0"><span style="width:0%"></span></div>
             <span class="caption" id="focusCaption"></span>
           </div>
           <div id="focusError"></div>
           <button type="button" class="btn secondary block" id="stopBtn">Stop focus</button>`
        : `<div class="toggle-row">
             <div class="toggle-text">
               <span class="toggle-label" id="focusLabel">Focus mode</span>
               <span class="toggle-desc" id="focusDesc">${kind === "off" ? "Blocks your distracting sites" : "Available when CLR is back"}</span>
             </div>
             <button type="button" class="toggle" role="switch" aria-checked="false" aria-labelledby="focusLabel" aria-describedby="focusDesc" id="focusToggle"${kind === "off" ? "" : " disabled"}><span class="thumb">${clrIcon("check", 14)}</span></button>
           </div>
           <div id="focusError"></div>
           <button type="button" class="btn secondary block" id="dashBtn">Open dashboard${clrIcon("external-link", 16)}</button>`;
    if (kind === "on") $("stopBtn").onclick = stopFocus;
    else {
      $("focusToggle").onclick = startFocus;
      $("dashBtn").onclick = openDashboard;
    }
    if (hadFocus) (kind === "on" ? $("stopBtn") : kind === "off" ? $("focusToggle") : $("dashBtn")).focus();
  }
  if (kind === "on") {
    const total = focus.duration_minutes;
    const done = Math.min(Math.floor(focus.elapsed_minutes), total);
    $("focusTime").textContent = `${done} / ${total} min`;
    const bar = $("focusBar");
    bar.setAttribute("aria-valuemax", String(total));
    bar.setAttribute("aria-valuenow", String(done));
    bar.setAttribute("aria-valuetext", `${done} of ${total} minutes`);
    bar.firstElementChild.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
    $("focusCaption").textContent = focus.block_tabs ? "Blocking distracting sites · notifications silenced" : "Notifications silenced";
  }
}

async function setFocus(start) {
  busy = true;
  const toggle = $("focusToggle");
  const stop = $("stopBtn");
  if (toggle) {
    toggle.setAttribute("aria-checked", "true");
    toggle.disabled = true;
  }
  if (stop) stop.disabled = true;
  try {
    const res = await clrFetch(start ? "/actions/focus/start" : "/actions/focus/stop", {
      method: "POST",
      body: start ? { duration_minutes: FOCUS_MINUTES, block_tabs: true, reason: "Started from the browser" } : undefined,
    });
    if (!res || !res.ok) throw new Error(String(res && res.status));
    snapshot.focus = await res.json();
    chrome.runtime.sendMessage({ type: "CLR_FOCUS_CHANGED" });
    busy = false;
    updateFocusArea(true);
  } catch (_) {
    busy = false;
    if (toggle) {
      toggle.setAttribute("aria-checked", "false");
      toggle.disabled = false;
    }
    if (stop) stop.disabled = false;
    $("focusError").innerHTML = note(
      "critical",
      "wifi-off",
      start ? "Couldn't start focus mode. Check that CLR is running, then try again." : "Couldn't stop focus mode. Try again in a moment."
    );
  }
}
const startFocus = () => setFocus(true);
const stopFocus = () => setFocus(false);

function openDashboard() {
  chrome.tabs.create({ url: cfg.dashboardUrl });
  window.close();
}

async function poll() {
  try {
    const [sr, fr] = await Promise.all([clrFetch("/state"), clrFetch("/actions/focus")]);
    if (!sr || sr.status === 401 || (fr && fr.status === 401)) {
      cfg = await clrGetConfig();
      route();
      return;
    }
    if (!sr.ok) throw new Error(String(sr.status));
    const state = await sr.json();
    const focus = fr && fr.ok ? await fr.json() : snapshot.focus;
    snapshot = { reachable: true, state, focus };
  } catch (_) {
    snapshot = { reachable: false, state: null, focus: null };
  }
  if (mode === "live") {
    body.removeAttribute("aria-busy");
    updateLive();
  }
  renderFoot();
}

// ── Not paired ──────────────────────────────────────────────────────────────

function showUnpaired(notice) {
  mode = "unpaired";
  body.className = "content center";
  body.removeAttribute("aria-busy");
  body.innerHTML = `
    ${logo(48)}
    <h2 class="h3">Pair this browser</h2>
    <p class="sm muted">Enter the code shown in the CLR app under Settings → Connected sources.</p>
    ${notice ? note("caution", "unplug", notice) : ""}
    <form class="stack" id="pairForm" novalidate>
      <div class="field" id="codeField">
        <label for="code">Pairing code</label>
        <input class="input code" id="code" name="code" autocomplete="off" spellcheck="false" maxlength="12" placeholder="XXXX-XXXX" aria-describedby="codeHelp" />
        <p class="help" id="codeHelp" hidden></p>
      </div>
      <button type="submit" class="btn primary block" id="pairBtn">Pair</button>
    </form>`;
  const input = $("code");
  input.focus();
  input.addEventListener("input", () => fieldError(null));
  $("pairForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const code = input.value.trim();
    if (!code) return fieldError("Enter the pairing code from the CLR app.");
    let origin;
    try {
      origin = clrOriginPattern(cfg.engineUrl);
    } catch (_) {
      return fieldError("The engine address in Settings doesn't look right.");
    }
    // Ask for the engine's origin straight from the submit, while it still counts as a user gesture.
    chrome.permissions.request({ origins: [origin] }, async (granted) => {
      if (!granted) return fieldError("CLR needs permission to reach the engine. Pair again and choose Allow.");
      const btn = $("pairBtn");
      btn.disabled = true;
      btn.textContent = "Pairing";
      try {
        await clrPair(cfg.engineUrl, code, clrDeviceName("Browser extension"), "browser");
        chrome.runtime.sendMessage({ type: "CLR_PAIRED" });
        cfg = await clrGetConfig();
        route();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Pair";
        fieldError(pairError(err));
      }
    });
  });
}

function pairError(err) {
  if (err && err.status === 400) return "That code didn't work. It may have expired, so make a new one in the CLR app.";
  if (err && err.status === 429) return "Too many tries. Wait a minute, then try again.";
  if (err && err.status) return "Pairing didn't work on CLR's side. Try again in a moment.";
  return `Couldn't reach CLR at ${hostOf(cfg.engineUrl)}. Check that it is running.`;
}

function fieldError(text) {
  const field = $("codeField");
  const help = $("codeHelp");
  if (!field) return;
  field.classList.toggle("error", !!text);
  help.hidden = !text;
  help.textContent = text || "";
  $("code").setAttribute("aria-invalid", text ? "true" : "false");
}

// ── Settings ────────────────────────────────────────────────────────────────

function showSettings() {
  mode = "settings";
  body.className = "content";
  body.removeAttribute("aria-busy");
  if (paired()) {
    body.innerHTML = `
      <h2 class="h3">Settings</h2>
      <div class="field"><span class="toggle-label">Engine address</span><span class="value">${esc(cfg.engineUrl)}</span></div>
      <div class="field"><span class="toggle-label">Paired account</span><span class="value">${esc(cfg.userEmail || "Not shown")}</span></div>
      <div class="stack">
        <button type="button" class="btn danger-ghost block" id="unpairBtn">Unpair this browser</button>
        <p class="help">CLR stops hearing from this browser. You can pair it again with a new code.</p>
      </div>
      <button type="button" class="btn secondary block" id="doneBtn">Done</button>`;
    $("unpairBtn").onclick = async () => {
      $("unpairBtn").disabled = true;
      await clrUnpair();
      cfg = await clrGetConfig();
      showingSettings = false;
      route();
    };
  } else {
    body.innerHTML = `
      <h2 class="h3">Settings</h2>
      <form class="stack" id="engineForm" novalidate>
        <div class="field" id="engineField">
          <label for="engineUrl">Engine address</label>
          <input class="input" id="engineUrl" type="url" spellcheck="false" autocomplete="off" value="${esc(cfg.engineUrl)}" aria-describedby="engineHelp" />
          <p class="help" id="engineHelp">Where CLR runs. Change it only if you moved the engine.</p>
        </div>
        <button type="submit" class="btn primary block">Save</button>
      </form>
      <button type="button" class="btn secondary block" id="doneBtn">Cancel</button>`;
    $("engineForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const url = $("engineUrl").value.trim().replace(/\/+$/, "");
      try {
        if (!/^https?:$/.test(new URL(url).protocol)) throw new Error();
      } catch (_) {
        $("engineField").classList.add("error");
        $("engineHelp").textContent = "Use a full address that starts with https:// or http://.";
        $("engineUrl").setAttribute("aria-invalid", "true");
        return;
      }
      await chrome.storage.local.set({ engineUrl: url });
      cfg = await clrGetConfig();
      showingSettings = false;
      route();
    });
  }
  $("doneBtn").onclick = () => {
    showingSettings = false;
    route();
  };
  body.querySelector("h2").setAttribute("tabindex", "-1");
  body.querySelector("h2").focus();
}

settingsBtn.onclick = () => {
  if (!cfg) return;
  showingSettings = !showingSettings;
  route();
};

// ── Routing and boot ────────────────────────────────────────────────────────

function route(notice) {
  clearInterval(pollTimer);
  pollTimer = null;
  settingsBtn.setAttribute("aria-pressed", String(showingSettings));
  if (showingSettings) showSettings();
  else if (paired()) {
    buildLive();
    poll();
    pollTimer = setInterval(poll, POLL_MS);
  } else {
    snapshot = { reachable: null, state: null, focus: null };
    showUnpaired(cfg.authError ? "This browser was disconnected. Enter a new code to pair it again." : notice);
  }
  renderFoot();
}

(async () => {
  cfg = await clrGetConfig();
  const stored = await chrome.storage.local.get("lastSentAt");
  lastSentAt = stored.lastSentAt || null;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.lastSentAt) {
      lastSentAt = changes.lastSentAt.newValue || null;
      renderFoot();
    }
  });
  route();
  setInterval(renderFoot, 1000);
})();
