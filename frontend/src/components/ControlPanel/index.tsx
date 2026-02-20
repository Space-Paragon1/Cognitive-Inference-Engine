import { useEffect, useState } from "react";
import {
  getFocusState,
  getPomodoro,
  startFocus,
  startPomodoro,
  stopFocus,
} from "../../api/client";
import type { FocusState, PomodoroState } from "../../types";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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

export function ControlPanel() {
  const [focus, setFocus] = useState<FocusState | null>(null);
  const [pomo, setPomo] = useState<PomodoroState | null>(null);

  const refresh = () => {
    getFocusState().then(setFocus).catch(() => {});
    getPomodoro().then(setPomo).catch(() => {});
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  const toggleFocus = async () => {
    if (focus?.active) {
      await stopFocus();
    } else {
      await startFocus(25, true);
    }
    refresh();
  };

  const handleStartPomo = async () => {
    await startPomodoro();
    refresh();
  };

  const pomoPct = pomo
    ? 1 - pomo.remaining_seconds / pomo.duration_seconds
    : 0;
  const pomoCircumference = 2 * Math.PI * 30;
  const pomoColor = PHASE_COLORS[pomo?.phase ?? "idle"];

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      {/* Focus mode */}
      <div style={{
        flex: 1, minWidth: 140, background: "#1a1a2e",
        borderRadius: 12, padding: 16,
        border: focus?.active ? "1px solid #4a4af0" : "1px solid #2a2a4a",
      }}>
        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 8 }}>FOCUS MODE</div>
        <div style={{
          fontSize: 20, fontWeight: 700,
          color: focus?.active ? "#4a4af0" : "#4a4a6a",
          marginBottom: 4,
        }}>
          {focus?.active ? "Active" : "Off"}
        </div>
        {focus?.active && (
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 8 }}>
            {Math.round(focus.elapsed_minutes)}/{focus.duration_minutes} min
          </div>
        )}
        <button
          onClick={toggleFocus}
          style={{
            width: "100%", padding: "7px 0", border: "none", borderRadius: 8,
            background: focus?.active ? "#2a2a4a" : "#4a4af0",
            color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >
          {focus?.active ? "Stop" : "Start Focus"}
        </button>
      </div>

      {/* Pomodoro */}
      <div style={{
        flex: 1, minWidth: 140, background: "#1a1a2e",
        borderRadius: 12, padding: 16, border: "1px solid #2a2a4a",
      }}>
        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 8 }}>POMODORO</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          {/* Mini circular timer */}
          <div style={{ position: "relative", width: 70, height: 70, flexShrink: 0 }}>
            <svg width="70" height="70" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="35" cy="35" r="30" fill="none" stroke="#2a2a4a" strokeWidth="6" />
              <circle
                cx="35" cy="35" r="30" fill="none"
                stroke={pomoColor} strokeWidth="6"
                strokeDasharray={pomoCircumference}
                strokeDashoffset={pomoCircumference * (1 - pomoPct)}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div style={{
              position: "absolute", inset: 0, display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700,
            }}>
              {pomo ? formatTime(pomo.remaining_seconds) : "--:--"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: pomoColor }}>
              {PHASE_LABELS[pomo?.phase ?? "idle"]}
            </div>
            <div style={{ fontSize: 11, opacity: 0.4 }}>
              Session #{(pomo?.sessions_completed ?? 0) + 1}
            </div>
          </div>
        </div>
        {pomo?.phase === "idle" && (
          <button
            onClick={handleStartPomo}
            style={{
              width: "100%", padding: "7px 0", border: "none", borderRadius: 8,
              background: "#4a4af0", color: "#fff", fontSize: 12,
              fontWeight: 600, cursor: "pointer",
            }}
          >
            Start Pomodoro
          </button>
        )}
      </div>
    </div>
  );
}
