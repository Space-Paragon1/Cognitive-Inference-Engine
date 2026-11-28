/**
 * CLR client — shared by the background worker and the popup.
 *
 * Keeps the engine URL and device token in chrome.storage.local, adds the
 * Authorization header to every request, and handles pairing.
 *
 * NOTE: plugins/lms-connector/clr-client.js is a copy of this file (Chrome
 * extensions cannot share files). Keep the two in sync.
 */

// The hosted engine and web app. Someone running the engine on their own computer
// sets the address in Settings instead (http://127.0.0.1:8765).
const CLR_DEFAULTS = {
  engineUrl: "https://cognitive-inference-engine-production.up.railway.app",
  dashboardUrl: "https://pretty-grace-production-e75e9439.up.railway.app",
};

async function clrGetConfig() {
  const stored = await chrome.storage.local.get([
    "engineUrl", "dashboardUrl", "deviceToken", "userEmail", "authError",
  ]);
  return {
    engineUrl: (stored.engineUrl || CLR_DEFAULTS.engineUrl).replace(/\/+$/, ""),
    dashboardUrl: stored.dashboardUrl || CLR_DEFAULTS.dashboardUrl,
    deviceToken: stored.deviceToken || null,
    userEmail: stored.userEmail || null,
    authError: Boolean(stored.authError),
  };
}

function clrOriginPattern(url) {
  const u = new URL(url);
  return `${u.protocol}//${u.hostname}/*`;
}

/**
 * fetch() against the engine with the device token attached.
 * Returns the Response, or null when not paired. A 401 marks the device as
 * disconnected (token revoked or engine reset) so the popup can offer to re-pair.
 */
async function clrFetch(path, { method = "GET", body } = {}) {
  const cfg = await clrGetConfig();
  if (!cfg.deviceToken) return null;
  const res = await fetch(`${cfg.engineUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.deviceToken}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    await chrome.storage.local.set({ authError: true });
  } else if (res.ok && cfg.authError) {
    await chrome.storage.local.set({ authError: false });
  }
  return res;
}

/** Exchange a pairing code from the dashboard for a device token. */
async function clrPair(engineUrl, code, name, kind) {
  const base = engineUrl.trim().replace(/\/+$/, "");
  const res = await fetch(`${base}/devices/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code.trim(), name, kind }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.detail || `Pairing failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  await chrome.storage.local.set({
    engineUrl: base,
    deviceToken: data.device_token,
    userEmail: data.user_email,
    authError: false,
  });
  return data;
}

/** Revoke this device's token on the engine (best effort) and forget it locally. */
async function clrUnpair() {
  try {
    await clrFetch("/devices/self", { method: "DELETE" });
  } catch (_) {
    // engine unreachable — still forget the token locally
  }
  await chrome.storage.local.remove(["deviceToken", "userEmail", "authError"]);
}

function clrDeviceName(kindLabel) {
  const platform =
    (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
  return platform ? `${kindLabel} on ${platform}` : kindLabel;
}
