import { BellOff, ChevronRight, ShieldCheck, Timer } from "lucide-react";
import { useGaugeState } from "../../live/LiveState";
import { usePrefs } from "../../live/PrefsState";
import { useSettings } from "../../live/SettingsState";
import { lastFocusChoice, useTimer } from "../../live/TimerState";
import { minutes, mmss } from "../../lib/format";
import { pomodoroMinutes } from "../../lib/order";
import { navigate } from "../../lib/router";
import { Card } from "../../components/Card";
import { Toggle } from "../../components/Toggle";
import { useToast } from "../../components/Toast";
import styles from "./QuickActions.module.css";

/** Start focus (last length, default 50 min), Start Pomodoro (sized to load) and Do Not Disturb. */
export function QuickActions({ grid = false }: { grid?: boolean }) {
  const timer = useTimer();
  const { load } = useGaugeState();
  const { thresholds } = useSettings();
  const { dnd, dndBusy, setDnd } = usePrefs();
  const toast = useToast();
  const focusChoice = lastFocusChoice();
  const pomoLen = pomodoroMinutes(load ?? 0.5, thresholds.high, thresholds.fatigue);
  const pomoRunning = timer.pomodoro != null && timer.pomodoro.phase !== "idle";
  const focusOn = Boolean(timer.focus?.active);

  const fail = (title: string) => toast.show({ key: title, title, body: "Check your connection and try again.", tone: "critical" });

  const startFocus = async () => {
    if (focusOn) return navigate("focus");
    try {
      await timer.startFocus(focusChoice.minutes, focusChoice.blockTabs);
      navigate("focus");
    } catch {
      fail("Couldn't start focus mode");
    }
  };
  const startPomodoro = async () => {
    if (pomoRunning) return navigate("focus");
    try {
      await timer.startPomodoro();
      navigate("focus");
    } catch {
      fail("Couldn't start the Pomodoro");
    }
  };
  const toggleDnd = async (on: boolean) => {
    const r = await setDnd(on);
    if (r === "failed") fail("Couldn't change Do Not Disturb");
  };

  const items = [
    {
      key: "focus",
      icon: ShieldCheck,
      title: focusOn ? "Focus mode on" : "Start focus",
      sub: focusOn ? `${mmss(timer.focusRemaining)} left` : `Block distractions for ${minutes(focusChoice.minutes)}`,
      onClick: startFocus,
    },
    {
      key: "pomodoro",
      icon: Timer,
      title: pomoRunning ? "Pomodoro running" : "Start Pomodoro",
      sub: pomoRunning ? `${mmss(timer.pomodoroRemaining)} left` : `${pomoLen} min, sized to your load`,
      onClick: startPomodoro,
    },
  ];

  if (grid) {
    return (
      <div className={styles.grid} role="group" aria-label="Quick actions">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.key} type="button" className={styles.tile} data-tone="accent" onClick={it.onClick} aria-label={`${it.title}. ${it.sub}`}>
              <span className={styles.tileIcon} aria-hidden="true">
                <Icon size={20} />
              </span>
              <b aria-hidden="true">{it.title}</b>
            </button>
          );
        })}
        <button
          type="button"
          className={styles.tile}
          data-tone="accent"
          aria-pressed={dnd}
          disabled={dndBusy}
          onClick={() => toggleDnd(!dnd)}
        >
          <span className={styles.tileIcon} aria-hidden="true">
            <BellOff size={20} />
          </span>
          <b>Do Not Disturb</b>
        </button>
      </div>
    );
  }

  return (
    <Card title="Quick actions" titleId="quick-actions-title">
      <div className={styles.list}>
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.key} type="button" className={styles.row} data-tone="accent" onClick={it.onClick}>
              <span className={styles.rowIcon} aria-hidden="true">
                <Icon size={20} />
              </span>
              <span className={styles.rowText}>
                <b>{it.title}</b>
                <small>{it.sub}</small>
              </span>
              <ChevronRight size={18} className={styles.chev} aria-hidden="true" />
            </button>
          );
        })}
        <div className={styles.row} data-tone="accent" data-static="">
          <span className={styles.rowIcon} aria-hidden="true">
            <BellOff size={20} />
          </span>
          <span className={styles.rowText} aria-hidden="true">
            <b>Do Not Disturb</b>
            <small>{dnd ? "On until you turn it off" : "Silence notifications"}</small>
          </span>
          <Toggle checked={dnd} onChange={toggleDnd} label="Do Not Disturb" disabled={dndBusy} />
        </div>
      </div>
    </Card>
  );
}
