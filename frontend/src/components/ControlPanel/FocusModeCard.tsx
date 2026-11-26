import { useState } from "react";
import { Check, Plus, ShieldCheck, Square } from "lucide-react";
import { usePrefs } from "../../live/PrefsState";
import { lastFocusChoice, useTimer } from "../../live/TimerState";
import { clock, minutes, mmss } from "../../lib/format";
import { Button } from "../Button";
import { Card } from "../Card";
import { SegmentedControl } from "../SegmentedControl";
import { TextField } from "../TextField";
import { Toggle } from "../Toggle";
import { useToast } from "../Toast";
import styles from "./FocusModeCard.module.css";

type Preset = "25" | "50" | "90" | "custom";
const PRESETS: { value: Preset; label: string }[] = [
  { value: "25", label: "25 m" },
  { value: "50", label: "50 m" },
  { value: "90", label: "90 m" },
  { value: "custom", label: "Custom" },
];

/** Focus mode: blocks distracting tabs and silences notifications for a set time. */
export function FocusModeCard() {
  const t = useTimer();
  const { dnd } = usePrefs();
  const toast = useToast();
  const fail = (title: string) => () => toast.show({ key: title, title, body: "Check your connection and try again.", tone: "critical" });
  const last = lastFocusChoice();
  const [preset, setPreset] = useState<Preset>(["25", "50", "90"].includes(String(last.minutes)) ? (String(last.minutes) as Preset) : "custom");
  const [custom, setCustom] = useState(String(last.minutes));
  const [block, setBlock] = useState(last.blockTabs);
  const [busy, setBusy] = useState(false);

  const title = (
    <>
      <ShieldCheck size={18} className={styles.accent} aria-hidden="true" />
      Focus mode
    </>
  );

  if (t.focus?.active) {
    const left = t.focusRemaining;
    const done = t.focusTotal ? Math.min(1, t.focusElapsed / t.focusTotal) : 0;
    return (
      <Card
        title={title}
        titleId="focusmode-title"
        meta={
          <span className={styles.on} data-tone="positive">
            <Check size={12} aria-hidden="true" />
            On
          </span>
        }
      >
        <div className={styles.body}>
          <p className={styles.elapsed}>
            <span className={styles.big}>{mmss(t.focusElapsed)}</span>
            <span className={styles.muted}>elapsed of {mmss(t.focusTotal)}</span>
          </p>
          <div
            className={styles.bar}
            role="progressbar"
            aria-label="Focus session"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(done * 100)}
            aria-valuetext={`${minutes(t.focusElapsed / 60)} of ${minutes(t.focusTotal / 60)}`}
          >
            <span style={{ width: `${(done * 100).toFixed(1)}%` }} />
          </div>
          <div className={styles.meta}>
            <span>
              Ends at {clock(Date.now() + left * 1000)} · {minutes(Math.ceil(left / 60))} to go
            </span>
            {dnd && <span>Notifications silenced</span>}
          </div>
          <Toggle
            row
            checked={t.focus.block_tabs}
            onChange={(on) => t.setFocusBlocking(on).catch(fail("Couldn't change tab blocking"))}
            label="Block distracting tabs"
            description="You can always let yourself through for 5 minutes."
          />
          <div className={styles.actions}>
            <Button variant="secondary" icon={Square} onClick={() => t.stopFocus().catch(fail("Couldn't stop focus mode"))}>
              Stop focus
            </Button>
            <Button variant="ghost" icon={Plus} onClick={() => t.addFocusMinutes(10).catch(fail("Couldn't add time"))}>
              Add 10 min
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Starting focus mode during a Pomodoro's focus phase links them.
  const linked = t.pomodoro?.phase === "work" ? Math.max(1, Math.ceil(t.pomodoroRemaining / 60)) : null;
  const customNum = Number(custom);
  const customError = preset === "custom" && (!Number.isInteger(customNum) || customNum < 5 || customNum > 180) ? "Choose between 5 and 180 minutes." : undefined;
  const length = linked ?? (preset === "custom" ? customNum : Number(preset));

  const start = async () => {
    if (customError && !linked) return;
    setBusy(true);
    try {
      await t.startFocus(length, block);
    } catch {
      fail("Couldn't start focus mode")();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={title} titleId="focusmode-title">
      <div className={styles.body}>
        {linked ? (
          <p className={styles.linked}>Runs until this Pomodoro&rsquo;s focus phase ends, in {minutes(linked)}.</p>
        ) : (
          <div className={styles.field}>
            <span className={styles.label} id="focus-duration">
              Duration
            </span>
            <SegmentedControl block options={PRESETS} value={preset} onChange={setPreset} label="Duration" />
            {preset === "custom" && (
              <TextField label="Minutes" type="number" value={custom} onChange={setCustom} min={5} max={180} inputMode="numeric" help="5 to 180 minutes." error={customError} />
            )}
          </div>
        )}
        <Toggle row checked={block} onChange={setBlock} label="Block distracting tabs" description="You can always let yourself through for 5 minutes." />
        <Button variant="secondary" block loading={busy} loadingLabel="Starting…" disabled={Boolean(customError) && !linked} onClick={start}>
          Start focus
        </Button>
      </div>
    </Card>
  );
}
