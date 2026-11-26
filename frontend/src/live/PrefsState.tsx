/* Small per-device preferences: the theme and Do Not Disturb.
   Do Not Disturb always pauses CLR's own non-urgent alerts (context toasts and
   notifications); the engine also silences the OS when it runs on this machine. */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { setDnD as apiSetDnD } from "../api/client";

export type Theme = "light" | "dark";

interface PrefsApi {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  dnd: boolean;
  dndBusy: boolean;
  /** "os": the engine changed the computer's setting too; "app": only CLR's own alerts
      are paused (a hosted engine can't reach the student's OS); "failed": nothing changed. */
  setDnd: (on: boolean) => Promise<"os" | "app" | "failed">;
}

const THEME_KEY = "clr_theme";
// TODO(backend): there is no GET for Do Not Disturb, so the last value the
// student set is remembered on this device.
const DND_KEY = "clr_dnd";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
}

const PrefsContext = createContext<PrefsApi | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"
  );
  const [dnd, setDndState] = useState(() => read(DND_KEY) === "1");
  const [dndBusy, setDndBusy] = useState(false);

  const setTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    write(THEME_KEY, t);
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

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

  const api = useMemo(() => ({ theme, setTheme, toggleTheme, dnd, dndBusy, setDnd }), [theme, setTheme, toggleTheme, dnd, dndBusy, setDnd]);
  return <PrefsContext.Provider value={api}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsApi {
  const v = useContext(PrefsContext);
  if (!v) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return v;
}
