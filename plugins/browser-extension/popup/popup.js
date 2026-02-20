const API = "http://127.0.0.1:8765";

async function fetchState() {
  const res = await fetch(`${API}/state`);
  if (!res.ok) throw new Error("Engine unavailable");
  return res.json();
}

async function fetchFocus() {
  const res = await fetch(`${API}/actions/focus`);
  if (!res.ok) throw new Error();
  return res.json();
}

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

async function render() {
  const errorEl = document.getElementById("error");
  try {
    const [state, focus] = await Promise.all([fetchState(), fetchFocus()]);

    const score = state.load_score;
    document.getElementById("scoreCircle").textContent = pct(score);
    document.getElementById("scoreCircle").style.borderColor = colorForScore(score);
    document.getElementById("contextLabel").textContent =
      contextEmoji(state.context) + " " + state.context.replace("_", " ");
    document.getElementById("confidenceLabel").textContent =
      `Confidence: ${pct(state.confidence)}`;

    const b = state.breakdown;
    document.getElementById("intVal").textContent = pct(b.intrinsic);
    document.getElementById("intBar").style.width = pct(b.intrinsic);
    document.getElementById("extVal").textContent = pct(b.extraneous);
    document.getElementById("extBar").style.width = pct(b.extraneous);
    document.getElementById("gerVal").textContent = pct(b.germane);
    document.getElementById("gerBar").style.width = pct(b.germane);

    const btn = document.getElementById("focusBtn");
    btn.textContent = focus.active ? "Stop Focus" : "Start Focus";
    btn.onclick = () => toggleFocus(focus.active);

    document.getElementById("statusLine").textContent =
      focus.active
        ? `Focus active — ${Math.round(focus.elapsed_minutes)}/${focus.duration_minutes} min`
        : "Engine connected";
    errorEl.textContent = "";
  } catch (e) {
    errorEl.textContent = "Cannot reach engine on :8765";
  }
}

async function toggleFocus(isActive) {
  const endpoint = isActive ? "/actions/focus/stop" : "/actions/focus/start";
  await fetch(`${API}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ duration_minutes: 25, block_tabs: true, reason: "Manual" }),
  });
  render();
}

document.getElementById("dashBtn").onclick = () => {
  chrome.tabs.create({ url: "http://localhost:5173" });
};

render();
setInterval(render, 3000);
