/* User settings (thresholds and break lengths) shared by the gauge ticks, the
   reorder rule, the Pomodoro why line and the Settings screen. Saves are
   debounced 400 ms and queued while offline (handoff.md, Settings). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getSettings, putSettings } from "../api/client";
import type { Settings } from "../types";

export type SaveState = "idle" | "saving" | "saved" | "queued" | "error";

interface SettingsApi {
  settings: Settings | null;
  defaults: Settings | null;
  loading: boolean;
  loadError: boolean;
  saveState: SaveState;
  /** high and fatigue as 0–1, with safe fallbacks before settings load. */
  thresholds: { high: number; fatigue: number };
  /** Update locally now; save after 400 ms of quiet (or when back online). */
  update: (patch: Partial<Settings>) => void;
  retry: () => void;
  reload: () => void;
}

const FALLBACK = { high: 0.75, fatigue: 0.85 };
const SettingsContext = createContext<SettingsApi | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [defaults, setDefaults] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const pending = useRef<Partial<Settings>>({});
  const timer = useRef<number | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getSettings()
      .then((r) => {
        setSettings(r.settings);
        setDefaults(r.defaults);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(reload, [reload]);

  const flush = useCallback(async () => {
    timer.current = null;
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    if (!navigator.onLine) {
      setSaveState("queued");
      return;
    }
    pending.current = {};
    setSaveState("saving");
    try {
      const r = await putSettings(patch);
      setSettings((s) => ({ ...(s ?? r.settings), ...r.settings, ...pending.current }));
      setSaveState("saved");
    } catch {
      pending.current = { ...patch, ...pending.current };
      setSaveState(navigator.onLine ? "error" : "queued");
    }
  }, []);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((s) => (s ? { ...s, ...patch } : s));
      pending.current = { ...pending.current, ...patch };
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 400);
    },
    [flush]
  );

  const retry = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    flush();
  }, [flush]);

  useEffect(() => {
    const on = () => {
      if (Object.keys(pending.current).length) flush();
    };
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [flush]);

  const thresholds = useMemo(
    () => ({
      high: settings?.high_load_threshold ?? FALLBACK.high,
      fatigue: settings?.fatigue_threshold ?? FALLBACK.fatigue,
    }),
    [settings?.high_load_threshold, settings?.fatigue_threshold]
  );

  const api = useMemo(
    () => ({ settings, defaults, loading, loadError, saveState, thresholds, update, retry, reload }),
    [settings, defaults, loading, loadError, saveState, thresholds, update, retry, reload]
  );
  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsApi {
  const v = useContext(SettingsContext);
  if (!v) throw new Error("useSettings must be used inside <SettingsProvider>");
  return v;
}
