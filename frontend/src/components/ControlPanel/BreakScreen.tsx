import { Eye, PersonStanding, Wind } from "lucide-react";
import { useGaugeState } from "../../live/LiveState";
import { useSettings } from "../../live/SettingsState";
import { useTimer } from "../../live/TimerState";
import { pomodoroMinutes } from "../../lib/order";
import { Button } from "../Button";
import { useToast } from "../Toast";
import { BreathingDisc, Timer } from "./Timer";
import styles from "./BreakScreen.module.css";

const TIPS = [
  { icon: Wind, text: "Breathe with the circle: in as it grows, out as it shrinks." },
  { icon: Eye, text: "Look at something 6 metres away for 20 seconds." },
  { icon: PersonStanding, text: "Stand up and roll your shoulders." },
];

/** A break takes over the whole canvas in the rest palette: no sidebar, no numbers but the countdown. */
export function BreakScreen({ mobile = false }: { mobile?: boolean }) {
  const t = useTimer();
  const g = useGaugeState();
  const { thresholds } = useSettings();
  const toast = useToast();
  const p = t.pomodoro;
  if (!p) return null;
  const long = p.phase === "long_break";
  const done = p.sessions_completed % 4 || (p.sessions_completed > 0 ? 4 : 0);
  const next = g.load == null ? 25 : pomodoroMinutes(g.load, thresholds.high, thresholds.fatigue);
  const eased = g.load != null && t.loadAtStart != null && g.load < t.loadAtStart;
  const nextLine = `Next: ${next} min focus.${eased && g.load != null ? ` Your load has eased to ${Math.round(g.load * 100)}%.` : ""}`;
  const endBreak = () =>
    t.skip().catch(() => toast.show({ key: "skip", title: "Couldn't start the next session", body: "Check your connection and try again.", tone: "critical" }));
  const ring = mobile ? 300 : 420;

  return (
    <section className={[styles.rest, mobile && styles.mobile].filter(Boolean).join(" ")} aria-labelledby="break-title">
      <p className={styles.overline}>
        {long ? "Long break" : "Short break"} · {done} of 4 done
      </p>
      <div className={styles.ringWrap} style={{ width: ring, height: ring }}>
        <div className={styles.disc}>
          <BreathingDisc size={ring} />
        </div>
        <div className={styles.timer}>
          <Timer phase={p.phase} remainingSeconds={t.pomodoroRemaining} totalSeconds={p.duration_seconds} sessionsCompleted={p.sessions_completed} size={mobile ? 230 : 300} />
        </div>
      </div>
      <div className={styles.text}>
        <h1 id="break-title" className={styles.title} tabIndex={-1}>
          Step away for a few minutes.
        </h1>
        {mobile ? (
          <p className={styles.muted}>Breathe with the circle. Look at something far away.{eased && g.load != null ? ` Your load has eased to ${Math.round(g.load * 100)}%.` : ""}</p>
        ) : (
          <>
            <ul className={styles.tips}>
              {TIPS.map((tip) => {
                const Icon = tip.icon;
                return (
                  <li key={tip.text}>
                    <Icon size={20} aria-hidden="true" />
                    <span>{tip.text}</span>
                  </li>
                );
              })}
            </ul>
            <p className={styles.next}>{nextLine}</p>
          </>
        )}
        <div className={styles.actions}>
          <Button variant="rest" size={mobile ? "lg" : "md"} block={mobile} onClick={endBreak}>
            I&rsquo;m back early
          </Button>
          <Button variant="rest-ghost" block={mobile} onClick={endBreak}>
            Skip break
          </Button>
        </div>
      </div>
    </section>
  );
}
