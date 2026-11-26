import { Play, Timer as TimerIcon } from "lucide-react";
import { useGaugeState } from "../../live/LiveState";
import { useSettings } from "../../live/SettingsState";
import { useTimer } from "../../live/TimerState";
import { pomodoroMinutes, whyLine } from "../../lib/order";
import { Button } from "../Button";
import { Card } from "../Card";
import { useToast } from "../Toast";
import { LengthScale, Timer, WhyLine } from "./Timer";
import styles from "./PomodoroCard.module.css";

/** "15 min because …" with the length in bold. */
function Why({ text }: { text: string }) {
  const m = /^(\d+ min)(.*)$/.exec(text);
  return m ? (
    <>
      <b>{m[1]}</b>
      {m[2]}
    </>
  ) : (
    <>{text}</>
  );
}

/** The adaptive Pomodoro: setup while idle, the ring while it runs. */
export function PomodoroCard({ size = 280 }: { size?: number }) {
  const t = useTimer();
  const g = useGaugeState();
  const { thresholds } = useSettings();
  const toast = useToast();
  const fail = (title: string) => () => toast.show({ key: title, title, body: "Check your connection and try again.", tone: "critical" });

  const phase = t.pomodoro?.phase ?? "idle";
  if (phase === "idle") {
    // No reading yet: the engine falls back to its normal length.
    const len = g.load == null ? 25 : pomodoroMinutes(g.load, thresholds.high, thresholds.fatigue);
    const why = g.load == null ? `${len} min because CLR has no reading yet, so it uses your normal length.` : `${whyLine(len, g.load, thresholds.high, thresholds.fatigue, g.confidence)} It updates when each session starts.`;
    return (
      <Card
        title={
          <>
            <TimerIcon size={18} className={styles.accent} aria-hidden="true" />
            Pomodoro
          </>
        }
        titleId="pomo-title"
        meta="Long break after 4"
      >
        <div className={styles.setup}>
          <p className={styles.suggested}>
            <span className={styles.big}>{len}:00</span>
            <span className={styles.muted}>suggested</span>
          </p>
          <LengthScale current={len} />
          <WhyLine>
            <Why text={why} />
          </WhyLine>
          <Button size="lg" block icon={Play} onClick={() => t.startPomodoro().catch(fail("Couldn't start the Pomodoro"))}>
            Start Pomodoro
          </Button>
        </div>
      </Card>
    );
  }

  const total = t.pomodoro?.duration_seconds ?? 0;
  const len = Math.round(total / 60);
  const why = phase === "work" ? whyLine(len, t.loadAtStart, thresholds.high, thresholds.fatigue, t.confidenceAtStart) : undefined;

  return (
    <Card
      title={
        <>
          <TimerIcon size={18} className={styles.accent} aria-hidden="true" />
          Adaptive Pomodoro
        </>
      }
      titleId="pomo-title"
      meta="Long break after 4"
      className={styles.running}
    >
      <div className={styles.center}>
        <Timer
          phase={phase}
          remainingSeconds={t.pomodoroRemaining}
          totalSeconds={total}
          sessionsCompleted={t.pomodoro?.sessions_completed ?? 0}
          size={size}
          paused={t.paused}
          whyNode={why ? <Why text={why} /> : undefined}
          onStart={t.resume}
          onPause={t.pause}
          onSkip={() => t.skip().catch(fail("Couldn't skip"))}
          onStop={() => t.stopPomodoro().catch(fail("Couldn't stop the Pomodoro"))}
        />
      </div>
    </Card>
  );
}
