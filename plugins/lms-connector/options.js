/* global clrGetConfig, clrFetch, clrPair, clrUnpair, clrOriginPattern, clrDeviceName, CLR_DEFAULTS */

const $ = (id) => document.getElementById(id);

async function render(message = "") {
  const cfg = await clrGetConfig();
  $("error").textContent = message;
  if (cfg.deviceToken && !cfg.authError) {
    $("connect").classList.add("hidden");
    $("connected").classList.remove("hidden");
    $("connectedLine").textContent =
      `Connected to ${cfg.engineUrl}` + (cfg.userEmail ? ` as ${cfg.userEmail}` : "") + ".";
    // Confirm the token still works.
    try {
      const res = await clrFetch("/devices/whoami");
      if (res && res.status === 401) render("This connector was disconnected. Pair it again.");
    } catch (_) {
      $("error").textContent = "Engine is not reachable right now; events will be retried.";
    }
  } else {
    $("connected").classList.add("hidden");
    $("connect").classList.remove("hidden");
    $("engineUrl").value = cfg.engineUrl;
    if (cfg.authError && !message) {
      $("error").textContent = "This connector was disconnected. Pair it again.";
    }
  }
}

$("connectBtn").onclick = () => {
  const engineUrl = $("engineUrl").value.trim() || CLR_DEFAULTS.engineUrl;
  const code = $("pairCode").value.trim();
  if (!code) {
    $("error").textContent = "Enter the pairing code from the dashboard.";
    return;
  }
  let origin;
  try {
    origin = clrOriginPattern(engineUrl);
  } catch (_) {
    $("error").textContent = "That engine URL doesn't look right.";
    return;
  }
  // Called straight from the click so Chrome treats it as a user gesture.
  chrome.permissions.request({ origins: [origin] }, async (granted) => {
    if (!granted) {
      $("error").textContent = "Permission to reach the engine was declined.";
      return;
    }
    $("connectBtn").disabled = true;
    try {
      await clrPair(engineUrl, code, clrDeviceName("LMS connector"), "lms");
      render();
    } catch (e) {
      $("error").textContent = e.message || "Could not reach the engine.";
    } finally {
      $("connectBtn").disabled = false;
    }
  });
};

$("disconnectBtn").onclick = async () => {
  await clrUnpair();
  render();
};

render();
