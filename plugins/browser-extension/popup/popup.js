/* global clrGetConfig, clrFetch, clrPair, clrUnpair, clrOriginPattern, clrDeviceName, CLR_DEFAULTS */

const $ = (id) => document.getElementById(id);
let renderTimer = null;

function pct(v) { return Math.round(v * 100) + "%"; }

function colorForScore(s) {
  if (s < 0.4) return "#4af0a0";
  if (s < 0.7) return "#f0d04a";
  return "#f05a4a";
}

function contextEmoji(ctx) {
  const map = { deep_focus: "🎯", shallow_work: "🌊", stuck: "🔁", fatigue: "😓", recovering: "🔋", unknown: "❓" };
  return map[ctx] || "❓";
}

// ── Views ────────────────────────────────────────────────────────────────────

async function showConnect(message = "") {
  clearInterval(renderTimer);
  const cfg = await clrGetConfig();
  $("stateView").classList.add("hidden");
  $("connectView").classList.remove("hidden");
  $("engineUrl").value = cfg.engineUrl;
  $("connectError").textContent = message;
  $("pairCode").focus();
}

async function showState() {
  $("connectView").classList.add("hidden");
  $("stateView").classList.remove("hidden");
  const cfg = await clrGetConfig();
  $("accountLine").textContent = cfg.userEmail || "";
  render();
  clearInterval(renderTimer);
  renderTimer = setInterval(render, 3000);
}

// ── Connect ─────────────────────────────────────────────────────────────────

$("connectBtn").onclick = () => {
  const engineUrl = $("engineUrl").value.trim() || CLR_DEFAULTS.engineUrl;
  const code = $("pairCode").value.trim();
  if (!code) {
    $("connectError").textContent = "Enter the pairing code from the dashboard.";
    return;
  }
  let origin;
  try {
    origin = clrOriginPattern(engineUrl);
  } catch (_) {
    $("connectError").textContent = "That engine URL doesn't look right.";
    return;
  }
  // Must be called directly from the click (before any await) to count as a user gesture.
  chrome.permissions.request({ origins: [origin] }, async (granted) => {
    if (!granted) {
      $("connectError").textContent = "Permission to reach the engine was declined.";
      return;
    }
    $("connectBtn").disabled = true;
    $("connectError").textContent = "";
    try {
      await clrPair(engineUrl, code, clrDeviceName("Browser extension"), "browser");
      chrome.runtime.sendMessage({ type: "CLR_PAIRED" });
      showState();
    } catch (e) {
      $("connectError").textContent = e.message || "Could not reach the engine.";
    } finally {
      $("connectBtn").disabled = false;
    }
  });
};

$("pairCode").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("connectBtn").click();
});

$("disconnectBtn").onclick = async () => {
  await clrUnpair();
  showConnect();
};

// ── Live state ──────────────────────────────────────────────────────────────

async function render() {
  const errorEl = $("error");
  try {
    const [stateRes, focusRes] = await Promise.all([clrFetch("/state"), clrFetch("/actions/focus")]);
    if (!stateRes || stateRes.status === 401) {
      showConnect("This browser was disconnected. Enter a new pairing code to reconnect.");
      return;
    }
    if (!stateRes.ok || !focusRes.ok) throw new Error();
    const state = await stateRes.json();
    const focus = await focusRes.json();

    const score = state.load_score;
    $("scoreCircle").textContent = state.active ? pct(score) : "—";
    $("scoreCircle").style.borderColor = state.active ? colorForScore(score) : "#2a2a4a";
    $("contextLabel").textContent = state.active
      ? contextEmoji(state.context) + " " + state.context.replace(/_/g, " ")
      : "Waiting for activity…";
    $("confidenceLabel").textContent = `Confidence: ${pct(state.confidence)}`;

    const b = state.breakdown;
    $("intVal").textContent = pct(b.intrinsic);
    $("intBar").style.width = pct(b.intrinsic);
    $("extVal").textContent = pct(b.extraneous);
    $("extBar").style.width = pct(b.extraneous);
    $("gerVal").textContent = pct(b.germane);
    $("gerBar").style.width = pct(b.germane);

    const btn = $("focusBtn");
    btn.textContent = focus.active ? "Stop Focus" : "Start Focus";
    btn.onclick = () => toggleFocus(focus.active);

    $("statusLine").textContent = focus.active
      ? `Focus active — ${Math.round(focus.elapsed_minutes)}/${focus.duration_minutes} min`
      : "Engine connected";
    errorEl.textContent = "";
  } catch (e) {
    const cfg = await clrGetConfig();
    errorEl.textContent = `Cannot reach the engine at ${cfg.engineUrl}`;
  }
}

async function toggleFocus(isActive) {
  const endpoint = isActive ? "/actions/focus/stop" : "/actions/focus/start";
  await clrFetch(endpoint, {
    method: "POST",
    body: { duration_minutes: 25, block_tabs: true, reason: "Manual" },
  });
  render();
}

$("dashBtn").onclick = async () => {
  const cfg = await clrGetConfig();
  chrome.tabs.create({ url: cfg.dashboardUrl });
};

// ── Boot ────────────────────────────────────────────────────────────────────

(async () => {
  const cfg = await clrGetConfig();
  if (cfg.deviceToken && !cfg.authError) showState();
  else showConnect(cfg.authError ? "This browser was disconnected. Enter a new pairing code." : "");
})();
