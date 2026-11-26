import { ChevronUp, Pause, Play } from "lucide-react";
import type { MiniPlayerProps } from "../../types/ui";
import { mmss } from "../../lib/format";
import { Button } from "../Button";
import { PHASE_LABEL, isBreak } from "./Timer";
import styles from "./MiniPlayer.module.css";

type Props = MiniPlayerProps & {
  paused?: boolean;
  /** Sidebar row: no shadow, no expand chevron. */
  compact?: boolean;
};

/** The running timer as a slim bar. The whole bar opens Focus; play/pause is its own 44px target. */
export function MiniPlayer({ phase, remainingSeconds, totalSeconds, label, onToggle, onExpand, paused = false, compact = false }: Props) {
  const brk = isBreak(phase);
  const done = totalSeconds ? Math.max(0, Math.min(1, 1 - remainingSeconds / totalSeconds)) : 0;
  const title = label ?? (phase === "focus_mode" ? "Focus mode" : brk ? PHASE_LABEL[phase] : "Pomodoro · Focus");
  const spokenPhase = phase === "focus_mode" ? "Focus mode" : phase === "work" ? "Focus" : PHASE_LABEL[phase];
  const mins = Math.ceil(remainingSeconds / 60);

  return (
    <div className={[styles.mini, brk && styles.break, compact && styles.compact].filter(Boolean).join(" ")} role="region" aria-label="Running timer">
      <button
        type="button"
        className={styles.open}
        onClick={onExpand}
        aria-label={`${spokenPhase}, ${mins} minute${mins === 1 ? "" : "s"} left${paused ? ", paused" : ""}. Open timer`}
      >
        <span className={styles.ringWrap} aria-hidden="true">
          <svg viewBox="0 0 48 48" width="32" height="32">
            <circle className={styles.ringTrack} cx="24" cy="24" r="20" fill="none" strokeWidth="5" />
            <circle
              className={styles.ringArc}
              cx="24"
              cy="24"
              r="20"
              fill="none"
              strokeWidth="5"
              pathLength={100}
              strokeDasharray={`${((1 - done) * 100).toFixed(1)} 100`}
              strokeLinecap="round"
              transform="rotate(-90 24 24)"
            />
          </svg>
        </span>
        <span className={styles.text} aria-hidden="true">
          <span className={styles.phase}>{paused ? `${title} · paused` : title}</span>
          <span className={styles.time}>{mmss(remainingSeconds)} left</span>
        </span>
        {!compact && <ChevronUp size={20} aria-hidden="true" />}
      </button>
      {onToggle && (
        <Button
          variant="ghost"
          iconOnly
          icon={paused ? Play : Pause}
          className={styles.toggle}
          aria-label={paused ? "Resume" : "Pause"}
          onClick={onToggle}
        />
      )}
      <span className={styles.bar} style={{ width: `${(done * 100).toFixed(1)}%` }} aria-hidden="true" />
    </div>
  );
}
