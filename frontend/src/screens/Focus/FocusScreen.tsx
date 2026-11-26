import { useGaugeState } from "../../live/LiveState";
import { usePrefs } from "../../live/PrefsState";
import { useTimer } from "../../live/TimerState";
import { BreakScreen, FocusModeCard, PomodoroCard, TodaySessions, isBreak } from "../../components/ControlPanel";
import { Card } from "../../components/Card";
import { ContextPill } from "../../components/ContextPill";
import { Banner } from "../../components/Banner";
import { Cell, ConnectionBanner, Grid, LiveStatus, Page, useShell } from "../../components/Shell";
import styles from "./FocusScreen.module.css";

/** Focus mode and the adaptive Pomodoro; breaks take over the whole screen. */
export function FocusScreen() {
  const { layout } = useShell();
  const mobile = layout === "mobile";
  const t = useTimer();
  const g = useGaugeState();
  const { dnd } = usePrefs();

  if (t.pomodoro && isBreak(t.pomodoro.phase)) return <BreakScreen mobile={mobile} />;

  const running = t.pomodoro != null && t.pomodoro.phase !== "idle";
  const banner = (
    <>
      <ConnectionBanner
        offlineBody="Your timer keeps running here. Changes reach the engine when you are back."
        reconnectingBody="Your timer keeps running. Live load will catch up."
      />
      {t.error && !t.pomodoro && (
        <Banner tone="critical" title="Couldn't reach the timer." body="Check your connection. Starting a session will retry." />
      )}
    </>
  );

  return (
    <Page title="Focus" sub="Protect your attention, or work in adaptive Pomodoros" actions={<LiveStatus />} banner={banner}>
      {mobile ? (
        <div className={styles.stack}>
          {running ? (
            <>
              <PomodoroCard size={250} />
              <Card as="div">
                <div className={styles.status}>
                  <ContextPill context={g.load == null ? "unknown" : g.context} size="sm" uncertain={g.confidence < 0.5} />
                  <span className={styles.muted}>{dnd ? "Notifications silenced" : "Notifications on"}</span>
                </div>
              </Card>
              <FocusModeCard />
            </>
          ) : (
            <>
              <PomodoroCard />
              <FocusModeCard />
            </>
          )}
          <TodaySessions />
        </div>
      ) : (
        <Grid>
          <Cell span={6} tablet={8}>
            <PomodoroCard size={layout === "desktop" ? 280 : 260} />
          </Cell>
          <Cell span={6} tablet={8}>
            <FocusModeCard />
            <TodaySessions />
          </Cell>
        </Grid>
      )}
    </Page>
  );
}
