import { useCallback, useEffect, useState } from "react";
import {
  createPairingCode,
  engineUrlForPlugins,
  listDevices,
  revokeDevice,
} from "../../api/client";
import type { Device, PairingCode } from "../../types";
import css from "./Settings.module.css";

// Functional placeholder until the redesigned "Connect sources" screen lands.

const KIND_LABEL: Record<Device["kind"], string> = {
  browser: "Browser extension",
  ide: "VS Code",
  desktop: "Desktop agent",
  lms: "LMS connector",
  other: "Device",
};

function ago(ts: number | null): string {
  if (!ts) return "never";
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function ConnectedDevices() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [code, setCode] = useState<PairingCode | null>(null);
  const [now, setNow] = useState(Date.now() / 1000);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    listDevices().then(setDevices).catch(() => setDevices([]));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // While a code is showing, tick the countdown and pick up newly paired devices.
  useEffect(() => {
    if (!code) return;
    const t = setInterval(() => {
      setNow(Date.now() / 1000);
      refresh();
    }, 3000);
    return () => clearInterval(t);
  }, [code, refresh]);

  const expired = code ? now >= code.expires_at : false;
  const minutesLeft = code ? Math.max(0, Math.ceil((code.expires_at - now) / 60)) : 0;

  const handleNewCode = async () => {
    setError("");
    try {
      setCode(await createPairingCode());
      setNow(Date.now() / 1000);
    } catch {
      setError("Could not create a pairing code.");
    }
  };

  const handleRevoke = async (id: number) => {
    await revokeDevice(id).catch(() => {});
    refresh();
  };

  return (
    <div className={css.section}>
      <div className={css.sectionTitle}>Connected devices</div>
      <span className={css.hint}>
        Plugins send your activity to the engine. Generate a code, then enter it in the
        browser extension popup, the LMS connector options, VS Code (“CLR: Connect to
        Engine”), or the desktop agent (<code>--pair CODE</code>).
      </span>

      {code && !expired ? (
        <div className={css.row}>
          <div className={css.rowHeader}>
            <span className={css.label}>Pairing code</span>
            <span className={css.value}>{minutesLeft} min left</span>
          </div>
          <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 22, letterSpacing: "0.15em", fontWeight: 700 }}>
            {code.code}
          </div>
          <span className={css.hint}>Engine URL: {engineUrlForPlugins()}</span>
        </div>
      ) : (
        <button type="button" className={css.saveBtn} onClick={handleNewCode} style={{ alignSelf: "flex-start" }}>
          {code ? "Code expired, get a new one" : "Connect a device"}
        </button>
      )}
      {error && <span className={css.hint} style={{ color: "#f0905a" }}>{error}</span>}

      {devices && devices.length > 0 && devices.map((d) => (
        <div key={d.id} className={css.row}>
          <div className={css.rowHeader}>
            <span className={css.label}>{d.name}</span>
            <button type="button" className={css.resetBtn} onClick={() => handleRevoke(d.id)}>
              Remove
            </button>
          </div>
          <span className={css.hint}>{KIND_LABEL[d.kind] ?? d.kind} · last seen {ago(d.last_seen_at)}</span>
        </div>
      ))}
      {devices && devices.length === 0 && (
        <span className={css.hint}>No devices connected yet.</span>
      )}
    </div>
  );
}
