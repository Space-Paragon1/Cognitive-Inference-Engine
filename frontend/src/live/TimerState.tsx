/* Focus mode and the Pomodoro, shared by the Focus screen, the mini-player and
   the sidebar timer row. Polls the engine every 2 s and counts down locally in
   between so the ring moves once a second. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import {
  getFocusState,
  getPomodoro,
  startFocus as apiStartFocus,
  startPomodoro as apiStartPomodoro,
  stopFocus as apiStopFocus,
  stopPomodoro as apiStopPomodoro,
} from "../api/client";
import type { FocusState, PomodoroState } from "../types";
import type { PomodoroPhase } from "../types/ui";
import { useLiveStore } from "./LiveState";

export type Haptic = "light" | "medium";

export async function haptic(kind: Haptic) {
  if (!Capacitor.isNativePlatform()) return;
  await Haptics.impact({ style: kind === "light" ? ImpactStyle.Light : ImpactStyle.Medium }).catch(() => {});
}

export interface PhaseChange {
  from: PomodoroPhase;
  to: PomodoroPhase;
  sessionsCompleted: number;
}

interface TimerApi {
  pomodoro: PomodoroState | null;
  focus: FocusState | null;
  /** Remaining seconds, counted down locally between polls. */
  pomodoroRemaining: number;
  focusRemaining: number;
  /** Load when the current Pomodoro phase started (drives the why line). */
  loadAtStart: number | null;
  confidenceAtStart: number;
  paused: boolean;
  /** Minutes added locally with "Add 10 min" (the engine restarts the session). */
  focusAdded: number;
  error: boolean;
  startPomodoro: () => Promise<void>;
  stopPomodoro: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  skip: () => Promise<void>;
  startFocus: (minutes: number, blockTabs: boolean) => Promise<void>;
  stopFocus: () => Promise<void>;
  addFocusMinutes: (minutes: number) => Promise<void>;
  onPhaseChange: (fn: (c: PhaseChange) => void) => () => void;
}

const TimerContext = createContext<TimerApi | null>(null);
const POLL_MS = 2000;
const FOCUS_MIN_KEY = "clr_focus_minutes";
const BLOCK_KEY = "clr_block_tabs";

/** The last focus length and block-tabs choice (Start focus reuses them; default 50 min, blocking on). */
export function lastFocusChoice(): { minutes: number; blockTabs: boolean } {
  try {
    const m = Number(localStorage.getItem(FOCUS_MIN_KEY));
    const b = localStorage.getItem(BLOCK_KEY);
    return { minutes: m >= 5 && m <= 180 ? m : 50, blockTabs: b == null ? true : b === "1" };
  } catch {
    return { minutes: 50, blockTabs: true };
  }
}

function rememberFocusChoice(minutes: number, blockTabs: boolean) {
  try {
    localStorage.setItem(FOCUS_MIN_KEY, String(minutes));
    localStorage.setItem(BLOCK_KEY, blockTabs ? "1" : "0");
  } catch {
    /* storage blocked */
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const live = useLiveStore();
  const [pomodoro, setPomodoro] = useState<PomodoroState | null>(null);
  const [focus, setFocus] = useState<FocusState | null>(null);
  const [polledAt, setPolledAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [paused, setPaused] = useState(false);
  const [pausedRemaining, setPausedRemaining] = useState<number | null>(null);
  const [loadAtStart, setLoadAtStart] = useState<number | null>(null);
  const [confidenceAtStart, setConfidenceAtStart] = useState(1);
  const [focusAdded, setFocusAdded] = useState(0);
  const [error, setError] = useState(false);
  const listeners = useRef(new Set<(c: PhaseChange) => void>());
  const prevPhase = useRef<PomodoroPhase | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [p, f] = await Promise.all([getPomodoro(), getFocusState()]);
      setPomodoro(p);
      setFocus(f);
      setPolledAt(Date.now());
      setError(false);
      if (!f.active) setFocusAdded(0);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const poll = window.setInterval(refresh, POLL_MS);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [refresh]);

  // Phase changes: record the load at phase start and tell listeners (alerts, haptics).
  useEffect(() => {
    const phase = (pomodoro?.phase ?? "idle") as PomodoroPhase;
    const prev = prevPhase.current;
    prevPhase.current = phase;
    if (prev === phase) return;
    const s = live.get().state;
    setLoadAtStart(s ? s.load_score : null);
    setConfidenceAtStart(s?.confidence ?? 0);
    setPaused(false);
    setPausedRemaining(null);
    if (prev === null) return;
    if (prev === "work" && phase !== "idle") haptic("medium");
    listeners.current.forEach((l) => l({ from: prev, to: phase, sessionsCompleted: pomodoro?.sessions_completed ?? 0 }));
  }, [pomodoro?.phase, pomodoro?.sessions_completed, live]);

  const elapsed = Math.max(0, (now - polledAt) / 1000);
  const pomodoroRemaining = pomodoro
    ? paused && pausedRemaining != null
      ? pausedRemaining
      : Math.max(0, pomodoro.remaining_seconds - (pomodoro.phase === "idle" ? 0 : elapsed))
    : 0;
  const focusRemaining = focus?.active
    ? Math.max(0, (focus.duration_minutes - focus.elapsed_minutes) * 60 - elapsed)
    : 0;

  const startPomodoro = useCallback(async () => {
    haptic("light");
    await apiStartPomodoro();
    await refresh();
  }, [refresh]);

  const stopPomodoro = useCallback(async () => {
    await apiStopPomodoro();
    setPaused(false);
    await refresh();
  }, [refresh]);

  // TODO(backend): the engine has no pause endpoint. Pause freezes the countdown
  // on screen only; the engine's own phase timer keeps running.
  const pause = useCallback(() => {
    haptic("light");
    setPausedRemaining(pomodoroRemaining);
    setPaused(true);
  }, [pomodoroRemaining]);

  const resume = useCallback(() => {
    haptic("light");
    setPaused(false);
    setPausedRemaining(null);
  }, []);

  // TODO(backend): no skip endpoint either. Skip stops the current phase.
  const skip = useCallback(async () => {
    await apiStopPomodoro();
    await refresh();
  }, [refresh]);

  const startFocus = useCallback(
    async (minutes: number, blockTabs: boolean) => {
      haptic("light");
      setFocusAdded(0);
      rememberFocusChoice(minutes, blockTabs);
      await apiStartFocus(minutes, blockTabs);
      await refresh();
    },
    [refresh]
  );

  const stopFocus = useCallback(async () => {
    await apiStopFocus();
    setFocusAdded(0);
    await refresh();
  }, [refresh]);

  // TODO(backend): no endpoint extends a running session. Restart it with the
  // remaining time plus the extra minutes, and keep the elapsed offset locally.
  const addFocusMinutes = useCallback(
    async (minutes: number) => {
      if (!focus?.active) return;
      const left = Math.max(1, Math.ceil(focusRemaining / 60));
      await apiStartFocus(left + minutes, focus.block_tabs);
      setFocusAdded((a) => a + minutes);
      await refresh();
    },
    [focus, focusRemaining, refresh]
  );

  const onPhaseChange = useCallback((fn: (c: PhaseChange) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const api = useMemo<TimerApi>(
    () => ({
      pomodoro,
      focus,
      pomodoroRemaining,
      focusRemaining,
      loadAtStart,
      confidenceAtStart,
      paused,
      focusAdded,
      error,
      startPomodoro,
      stopPomodoro,
      pause,
      resume,
      skip,
      startFocus,
      stopFocus,
      addFocusMinutes,
      onPhaseChange,
    }),
    [pomodoro, focus, pomodoroRemaining, focusRemaining, loadAtStart, confidenceAtStart, paused, focusAdded, error, startPomodoro, stopPomodoro, pause, resume, skip, startFocus, stopFocus, addFocusMinutes, onPhaseChange]
  );
  return <TimerContext.Provider value={api}>{children}</TimerContext.Provider>;
}

export function useTimer(): TimerApi {
  const v = useContext(TimerContext);
  if (!v) throw new Error("useTimer must be used inside <TimerProvider>");
  return v;
}

/** What the mini-player shows: the Pomodoro if it runs, else focus mode, else nothing. */
export function useRunningTimer() {
  const t = useTimer();
  if (t.pomodoro && t.pomodoro.phase !== "idle") {
    return {
      phase: t.pomodoro.phase as PomodoroPhase,
      remainingSeconds: t.pomodoroRemaining,
      totalSeconds: t.pomodoro.duration_seconds,
      paused: t.paused,
      toggle: t.paused ? t.resume : t.pause,
    };
  }
  if (t.focus?.active) {
    return {
      phase: "focus_mode" as const,
      remainingSeconds: t.focusRemaining,
      totalSeconds: t.focus.duration_minutes * 60,
      paused: false,
      toggle: undefined,
    };
  }
  return null;
}
