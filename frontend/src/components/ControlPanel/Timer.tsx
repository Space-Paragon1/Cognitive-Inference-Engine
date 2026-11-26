import { Coffee, Info, Pause, Play, SkipForward, Square, Timer as TimerIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { PomodoroPhase, TimerProps } from "../../types/ui";
import { mmss } from "../../lib/format";
import { Button } from "../Button";
import styles from "./Timer.module.css";

export const PHASE_LABEL: Record<PomodoroPhase, string> = {
  idle: "Ready",
  work: "Focus",
  short_break: "Short break",
  long_break: "Long break",
};

export const isBreak = (phase: string) => phase === "short_break" || phase === "long_break";

type Props = TimerProps & {
  /** Paused: the main button reads Resume. */
  paused?: boolean;
  /** Rich why line (bold length). Overrides `why`. */
  whyNode?: ReactNode;
};

function spokenLeft(seconds: number) {
  const m = Math.ceil(seconds / 60);
  return `${m} minute${m === 1 ? "" : "s"} left`;
}

/** The adaptive Pomodoro ring: drains clockwise from 12, with session dots, controls and the why line. */
export function Timer({
  phase,
  remainingSeconds,
  totalSeconds,
  sessionsCompleted,
  why,
  whyNode,
  size = 280,
  paused = false,
  onStart,
  onPause,
  onSkip,
  onStop,
}: Props) {
  const brk = isBreak(phase);
  const idle = phase === "idle";
  const left = totalSeconds ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 1;
  const PhaseIcon = brk ? Coffee : TimerIcon;

  return (
    <div className={[styles.timer, brk && styles.break, size < 240 && styles.small].filter(Boolean).join(" ")}>
      <div className={styles.ring} style={{ width: size, height: size }}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle className={styles.track} cx="100" cy="100" r="92" fill="none" strokeWidth="6" />
          <circle
            className={styles.arc}
            cx="100"
            cy="100"
            r="92"
            fill="none"
            strokeWidth="6"
            pathLength={100}
            strokeDasharray={`${(100 * left).toFixed(2)} 100`}
            strokeLinecap="round"
            transform="rotate(-90 100 100)"
          />
        </svg>
        <div className={styles.center}>
          <span className={styles.phase}>
            <PhaseIcon size={16} aria-hidden="true" />
            {paused ? "Paused" : PHASE_LABEL[phase]}
          </span>
          <span
            className={styles.time}
            role="timer"
            aria-label={idle ? `Ready, ${Math.round(totalSeconds / 60)} minute session` : `${PHASE_LABEL[phase]}, ${spokenLeft(remainingSeconds)}`}
          >
            <span aria-hidden="true">{mmss(remainingSeconds)}</span>
          </span>
          <span className={styles.of}>of {Math.round(totalSeconds / 60)} min</span>
        </div>
      </div>

      {!idle && <SessionDots done={sessionsCompleted} rest={brk} />}

      {idle ? (
        onStart && (
          <Button size="lg" icon={Play} onClick={onStart}>
            Start Pomodoro
          </Button>
        )
      ) : (
        <div className={styles.controls}>
          {onStop && (
            <Button variant={brk ? "rest-ghost" : "secondary"} iconOnly round icon={Square} aria-label="Stop" onClick={onStop} />
          )}
          {(onPause || onStart) && (
            <button
              type="button"
              className={styles.play}
              aria-label={paused ? "Resume" : "Pause"}
              onClick={paused ? onStart : onPause}
            >
              {paused ? <Play size={24} aria-hidden="true" /> : <Pause size={24} aria-hidden="true" />}
            </button>
          )}
          {onSkip && (
            <Button
              variant={brk ? "rest-ghost" : "secondary"}
              iconOnly
              round
              icon={SkipForward}
              aria-label="Skip to next phase"
              onClick={onSkip}
            />
          )}
        </div>
      )}

      {(whyNode || why) && (
        <div className={styles.why}>
          <Info size={18} aria-hidden="true" />
          <span>{whyNode ?? why}</span>
        </div>
      )}
    </div>
  );
}

/** Four dots: filled = done, ringed = current. */
export function SessionDots({ done, total = 4, rest = false }: { done: number; total?: number; rest?: boolean }) {
  const d = Math.max(0, Math.min(total, done % (total + 1)));
  return (
    <span className={[styles.dots, rest && styles.break].filter(Boolean).join(" ")} role="img" aria-label={`${d} of ${total} sessions done before your long break`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < d ? styles.done : i === d ? styles.now : undefined} />
      ))}
      <span className={styles.dotsLabel} aria-hidden="true">
        {d} of {total}
      </span>
    </span>
  );
}

/** "10 fatigued · 15 high · 25 normal · 35 low", with the current pick highlighted. */
export function LengthScale({ current }: { current: number }) {
  const items: [number, string][] = [
    [10, "fatigued"],
    [15, "high load"],
    [25, "normal"],
    [35, "low load"],
  ];
  return (
    <ul className={styles.lengths} aria-label="Pomodoro length by load">
      {items.map(([m, label]) => (
        <li key={m} className={m === current ? styles.on : undefined} aria-current={m === current || undefined}>
          <b>{m}</b>
          {label}
        </li>
      ))}
    </ul>
  );
}

/** The slow breathing disc on break screens (8 s cycle; still under reduced motion). */
export function BreathingDisc({ size = 160 }: { size?: number }) {
  return (
    <div className={styles.breath} style={{ width: size, height: size }} aria-hidden="true">
      <div className={styles.disc} />
    </div>
  );
}

/** The "why this length" line on its own (the idle Pomodoro setup). */
export function WhyLine({ children }: { children: ReactNode }) {
  return (
    <div className={[styles.why, styles.whyWide].join(" ")}>
      <Info size={18} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
