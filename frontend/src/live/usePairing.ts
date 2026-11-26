/* Connecting a source: one pairing code at a time, and the device list that
   tells us when a plugin has paired. Used by Now (no data yet), Settings and
   Onboarding. */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPairingCode, listDevices, revokeDevice } from "../api/client";
import type { Device } from "../types";
import type { SourceKind, SourceState } from "../types/ui";
import { sourceKindFromDevice } from "../lib/domain";
import { useSources } from "./LiveState";

export function useDevices(pollMs = 0) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    try {
      setDevices(await listDevices());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    reload();
    if (!pollMs) return;
    const t = window.setInterval(reload, pollMs);
    return () => window.clearInterval(t);
  }, [reload, pollMs]);
  return { devices, error, reload };
}

export function usePairing() {
  const [waiting, setWaiting] = useState<{ kind: SourceKind; code: string; expiresAt: number; since: number } | null>(null);
  const [connecting, setConnecting] = useState<SourceKind | null>(null);
  const [failed, setFailed] = useState(false);
  const { devices, reload, error } = useDevices(waiting ? 3000 : 0);
  const sending = useSources();
  const paired = useRef(new Set<SourceKind>());

  const connect = useCallback(async (kind: SourceKind) => {
    setConnecting(kind);
    setFailed(false);
    try {
      const p = await createPairingCode();
      setWaiting({ kind, code: p.code, expiresAt: p.expires_at * 1000, since: Date.now() / 1000 });
    } catch {
      setFailed(true);
    } finally {
      setConnecting(null);
    }
  }, []);

  const cancel = useCallback(() => setWaiting(null), []);

  const disconnect = useCallback(
    async (kind: SourceKind) => {
      const mine = (devices ?? []).filter((d) => sourceKindFromDevice(d.kind) === kind);
      await Promise.all(mine.map((d) => revokeDevice(d.id)));
      paired.current.delete(kind);
      await reload();
    },
    [devices, reload]
  );

  // A device created after the code was issued means the plugin paired.
  useEffect(() => {
    if (!waiting || !devices) return;
    const hit = devices.find((d) => sourceKindFromDevice(d.kind) === waiting.kind && d.created_at >= waiting.since - 5);
    if (hit) {
      paired.current.add(waiting.kind);
      setWaiting(null);
    }
  }, [devices, waiting]);

  const stateFor = useCallback(
    (kind: SourceKind): SourceState => {
      if (waiting?.kind === kind) return "waiting";
      const hasDevice = (devices ?? []).some((d) => sourceKindFromDevice(d.kind) === kind);
      return hasDevice || sending[kind] || paired.current.has(kind) ? "connected" : "not_connected";
    },
    [waiting, devices, sending]
  );

  const lastSeen = useCallback(
    (kind: SourceKind): string | undefined => {
      const d = (devices ?? []).filter((x) => sourceKindFromDevice(x.kind) === kind && x.last_seen_at);
      if (!d.length) return undefined;
      const s = Math.max(0, Date.now() / 1000 - Math.max(...d.map((x) => x.last_seen_at ?? 0)));
      return s < 60 ? `${Math.round(s)}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
    },
    [devices]
  );

  return {
    waiting,
    connecting,
    failed,
    devices,
    devicesError: error,
    connect,
    cancel,
    disconnect,
    stateFor,
    lastSeen,
    codeExpiresIn: waiting ? Math.max(0, Math.round((waiting.expiresAt - Date.now()) / 1000)) : undefined,
  };
}
