import { useEffect, useRef, useState } from "react";
import {
  getFocusState,
  getPomodoro,
  startFocus,
  startPomodoro,
  stopFocus,
} from "../../api/client";
import type { FocusState, PomodoroState } from "../../types";
import css from "./ControlPanel.module.css";

// ── Constants ────────────────────────────────────────────────────────────────

const PHASE_NOTIFICATIONS: Record<string, [string, string]> = {
  short_break: ["Pomodoro complete!", "Take a 5-minute break."],
  long_break:  ["Long break time!", "You've earned a proper rest."],
  work:        ["Break over — back to work", "Starting your next Pomodoro session."],
};

const PHASE_LABELS: Record<string, string> = {
  work: "Focus",
  short_break: "Short Break",
  long_break: "Long Break",
  idle: "Idle",
};

const PHASE_COLORS: Record<string, string> = {
  work: "#4a4af0",
  short_break: "#4af0a0",
  long_break: "#4ac0f0",
  idle: "#4a4a6a",
};

const POMO_CIRCUMFERENCE = 2 * Math.PI * 30;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Component ────────────────────────────────────────────────────────────────

interface ControlPanelProps {
  notify?: (key: string, title: string, body?: string) => void;
}

export function ControlPanel({ notify }: ControlPanelProps) {
  const [focus, setFocus] = useState<FocusState | null>(null);
  const [pomo, setPomo] = useState<PomodoroState | null>(null);
  const prevPhaseRef = useRef<string>("idle");

  const refresh = () => {
    getFocusState().then(setFocus).catch(() => {});
    getPomodoro().then(setPomo).catch(() => {});
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  // Fire a notification when the Pomodoro phase transitions
  useEffect(() => {
    if (!pomo || !notify) return;
    const prev = prevPhaseRef.current;
    const curr = pomo.phase;
    prevPhaseRef.current = curr;
    if (prev === curr || prev === "idle") return;
    const msg = PHASE_NOTIFICATIONS[curr];
    if (msg) notify("pomodoro", msg[0], msg[1]);
  }, [pomo?.phase, notify]);

  const toggleFocus = async () => {
    if (focus?.active) await stopFocus();
    else await startFocus(25, true);
    refresh();
  };

  const handleStartPomo = async () => {
    await startPomodoro();
    refresh();
  };

  const pomoPct = pomo ? 1 - pomo.remaining_seconds / pomo.duration_seconds : 0;
  const pomoColor = PHASE_COLORS[pomo?.phase ?? "idle"];

  return (
    <div className={css.root}>
      {/* Focus mode */}
      <div className={`${css.card} ${focus?.active ? css.cardActive : ""}`}>
        <div className={css.sectionLabel}>FOCUS MODE</div>
        <div className={`${css.focusStatus} ${focus?.active ? css.focusStatusActive : ""}`}>
          {focus?.active ? "Active" : "Off"}
        </div>
        {focus?.active && (
          <div className={css.elapsed}>
            {Math.round(focus.elapsed_minutes)}/{focus.duration_minutes} min
          </div>
        )}
        <button
          type="button"
          onClick={toggleFocus}
          className={`${css.btn} ${focus?.active ? css.btnStop : ""}`}
        >
          {focus?.active ? "Stop" : "Start Focus"}
        </button>
      </div>

      {/* Pomodoro */}
      <div className={css.card}>
        <div className={css.sectionLabel}>POMODORO</div>
        <div className={css.timerRow}>
          {/* SVG arc — stroke color is a presentation attribute, not a style prop */}
          <div className={css.timerWrap}>
            <svg width="70" height="70" className={css.svgRotate}>
              <circle cx="35" cy="35" r="30" fill="none" stroke="#2a2a4a" strokeWidth="6" />
              <circle
                cx="35" cy="35" r="30" fill="none"
                stroke={pomoColor} strokeWidth="6"
                strokeDasharray={POMO_CIRCUMFERENCE}
                strokeDashoffset={POMO_CIRCUMFERENCE * (1 - pomoPct)}
                strokeLinecap="round"
                className={css.timerArc}
              />
            </svg>
            <div className={css.timerLabel}>
              {pomo ? formatTime(pomo.remaining_seconds) : "--:--"}
            </div>
          </div>

          {/* Phase name — CSS custom property carries the dynamic color */}
          <div>
            <div
              className={css.phaseName}
              style={{ ["--phase-color" as string]: pomoColor }}
            >
              {PHASE_LABELS[pomo?.phase ?? "idle"]}
            </div>
            <div className={css.sessionNum}>
              Session #{(pomo?.sessions_completed ?? 0) + 1}
            </div>
          </div>
        </div>

        {pomo?.phase === "idle" && (
          <button type="button" onClick={handleStartPomo} className={css.btn}>
            Start Pomodoro
          </button>
        )}
      </div>
    </div>
  );
}
