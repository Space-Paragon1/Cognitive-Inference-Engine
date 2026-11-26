/* Small per-device preferences: the theme, Do Not Disturb, which alerts this device
   shows, and vibration. Do Not Disturb always pauses CLR's own non-urgent alerts
   (context toasts and notifications); the engine also silences the OS when it runs
   on this machine. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { setDnD as apiSetDnD } from "../api/client";

export type Theme = "light" | "dark";
export type ThemeChoice = Theme | "system";

export interface AlertPrefs {
  /** "Break time" when a Pomodoro phase ends. */
  breaks: boolean;
  /** Toasts when the context changes (deep focus, stuck, recovering). */
  context: boolean;
  /** The overload warning after 5 minutes above fatigue. */
  overload: boolean;
}

interface PrefsApi {
  theme: Theme;
  themeChoice: ThemeChoice;
  setThemeChoice: (t: ThemeChoice) => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  dnd: boolean;
  dndBusy: boolean;
  /** "os": the engine changed the computer's setting too; "app": only CLR's own alerts
      are paused (a hosted engine can't reach the student's OS); "failed": nothing changed. */
  setDnd: (on: boolean) => Promise<"os" | "app" | "failed">;
  alerts: AlertPrefs;
  setAlerts: (patch: Partial<AlertPrefs>) => void;
  vibrate: boolean;
  setVibrate: (on: boolean) => void;
}

const THEME_KEY = "clr_theme";
// TODO(backend): there is no GET for Do Not Disturb, so the last value the
// student set is remembered on this device.
const DND_KEY = "clr_dnd";
const ALERTS_KEY = "clr_alerts";
export const VIBRATE_KEY = "clr_vibrate";
const DEFAULT_ALERTS: AlertPrefs = { breaks: true, context: true, overload: true };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
}

/** Alert preferences outside React (the alert engine reads them per event). */
export function readAlertPrefs(): AlertPrefs {
  try {
    return { ...DEFAULT_ALERTS, ...(JSON.parse(read(ALERTS_KEY) ?? "{}") as Partial<AlertPrefs>) };
  } catch {
    return DEFAULT_ALERTS;
  }
}

// Android's WebView keeps the prefers-color-scheme it started with, so MainActivity
// reports later changes to the phone's dark mode with a "clrsystemtheme" event.
let nativeScheme: Theme | null = null;
const systemTheme = (): Theme =>
  nativeScheme ?? (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark");

/** Android draws the clock, the system icons and the gesture bar over the app, so their
    colour follows the app's theme: dark icons on light, light icons on dark. Capacitor's
    SystemBars and the status-bar plugin each keep a style of their own, so both are set. */
function setSystemBars(theme: Theme) {
  if (!Capacitor.isNativePlatform()) return;
  const light = theme === "light";
  SystemBars.setStyle({ style: light ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(() => {});
  StatusBar.setStyle({ style: light ? Style.Light : Style.Dark }).catch(() => {});
}

const PrefsContext = createContext<PrefsApi | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [themeChoice, setChoiceState] = useState<ThemeChoice>(() => {
    const v = read(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  });
  const [theme, setThemeState] = useState<Theme>(() => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"));
  const [dnd, setDndState] = useState(() => read(DND_KEY) === "1");
  const [dndBusy, setDndBusy] = useState(false);
  const [alerts, setAlertsState] = useState<AlertPrefs>(readAlertPrefs);
  const [vibrate, setVibrateState] = useState(() => read(VIBRATE_KEY) !== "0");

  const apply = useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    setThemeState(t);
  }, []);

  useEffect(() => setSystemBars(theme), [theme]);

  // "System" follows the OS live.
  useEffect(() => {
    if (themeChoice !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const on = () => apply(systemTheme());
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [themeChoice, apply]);

  // Android: the phone's dark mode changed while the app was open. Android also puts
  // the status bar icons back to the phone's setting, so they're set again either way.
  useEffect(() => {
    const on = (e: Event) => {
      const scheme = (e as Event & { scheme?: unknown }).scheme;
      if (scheme !== "light" && scheme !== "dark") return;
      nativeScheme = scheme;
      const next = themeChoice === "system" ? scheme : theme;
      apply(next);
      setSystemBars(next);
    };
    window.addEventListener("clrsystemtheme", on);
    return () => window.removeEventListener("clrsystemtheme", on);
  }, [themeChoice, theme, apply]);

  const setThemeChoice = useCallback(
    (t: ThemeChoice) => {
      write(THEME_KEY, t === "system" ? null : t);
      setChoiceState(t);
      apply(t === "system" ? systemTheme() : t);
    },
    [apply]
  );
  const setTheme = useCallback((t: Theme) => setThemeChoice(t), [setThemeChoice]);
  const toggleTheme = useCallback(() => setThemeChoice(theme === "dark" ? "light" : "dark"), [theme, setThemeChoice]);

  const setDnd = useCallback(async (on: boolean): Promise<"os" | "app" | "failed"> => {
    setDndBusy(true);
    setDndState(on);
    try {
      const r = await apiSetDnD(on);
      write(DND_KEY, on ? "1" : "0");
      return r.ok ? "os" : "app";
    } catch {
      setDndState(!on);
      return "failed";
    } finally {
      setDndBusy(false);
    }
  }, []);

  const setAlerts = useCallback((patch: Partial<AlertPrefs>) => {
    setAlertsState((a) => {
      const next = { ...a, ...patch };
      write(ALERTS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setVibrate = useCallback((on: boolean) => {
    write(VIBRATE_KEY, on ? "1" : "0");
    setVibrateState(on);
  }, []);

  const api = useMemo(
    () => ({ theme, themeChoice, setThemeChoice, setTheme, toggleTheme, dnd, dndBusy, setDnd, alerts, setAlerts, vibrate, setVibrate }),
    [theme, themeChoice, setThemeChoice, setTheme, toggleTheme, dnd, dndBusy, setDnd, alerts, setAlerts, vibrate, setVibrate]
  );
  return <PrefsContext.Provider value={api}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsApi {
  const v = useContext(PrefsContext);
  if (!v) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return v;
}
