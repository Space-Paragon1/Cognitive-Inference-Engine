/* The session picker in the replay card's head. */
import { CalendarDays, ChevronDown } from "lucide-react";
import type { SessionSummary } from "../../types";
import { minutes } from "../../lib/format";
import { isRunning, sessionRange } from "../../lib/history";
import styles from "./SessionPicker.module.css";

interface Props {
  sessions: SessionSummary[];
  value: number | null;
  onChange: (s: SessionSummary) => void;
}

export function SessionPicker({ sessions, value, onChange }: Props) {
  return (
    <div className={styles.wrap}>
      <CalendarDays size={18} aria-hidden="true" className={styles.lead} />
      <select
        className={styles.select}
        aria-label="Session"
        value={value ?? ""}
        onChange={(e) => {
          const s = sessions.find((x) => x.start_ts === Number(e.target.value));
          if (s) onChange(s);
        }}
      >
        {sessions.map((s) => (
          <option key={s.start_ts} value={s.start_ts}>
            {sessionRange(s)} · {isRunning(s) ? "running" : minutes(s.duration_minutes)}
          </option>
        ))}
      </select>
      <ChevronDown size={18} aria-hidden="true" className={styles.trail} />
    </div>
  );
}
