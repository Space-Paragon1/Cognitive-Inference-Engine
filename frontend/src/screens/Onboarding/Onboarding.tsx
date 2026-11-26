/* Onboarding (ScreenOnboarding): what CLR does, the privacy promise, connecting
   sources, and notifications. Desktop: a centred column with the step bar on top and
   Back / Continue at the bottom. Phones: one full screen per step, Skip top-right,
   the primary button pinned above the safe area. */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUpDown, BellOff, Coffee, Info } from "lucide-react";
import { exitApp, useHardwareBack } from "../../lib/backStack";
import { STEP_KEY } from "../../lib/onboarding";
import { requestNotifications } from "../../lib/notify";
import { usePrefs } from "../../live/PrefsState";
import { usePairing } from "../../live/usePairing";
import { SOURCE_ORDER } from "../../lib/domain";
import type { Icon } from "../../types/ui";
import { Banner } from "../../components/Banner";
import { Button } from "../../components/Button";
import { LoadGauge } from "../../components/LoadGauge";
import { Logo } from "../../components/Logo";
import { PrivacyPromise } from "../../components/PrivacyPromise";
import { SourceList } from "../../components/Settings";
import { useLayout } from "../../components/Shell";
import { Toggle } from "../../components/Toggle";
import styles from "./Onboarding.module.css";

const STEPS = ["What CLR does", "Your privacy", "Connect sources", "Notifications"] as const;
const LAST = STEPS.length;
const TITLE_ID = "onboarding-title";

const DOES: [Icon, string, string][] = [
  [BellOff, "Protects deep focus", "Silences notifications and distracting tabs."],
  [Coffee, "Times your breaks", "Pomodoros from 10 to 35 min, sized to your load."],
  [ArrowUpDown, "Reorders your tasks", "Easier work when you are loaded, harder when you are fresh."],
];

function readStep(): number {
  try {
    const n = Number(sessionStorage.getItem(STEP_KEY));
    return n >= 1 && n <= LAST ? n : 1;
  } catch {
    return 1;
  }
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const mobile = useLayout() === "mobile";
  const [step, setStep] = useState(readStep);
  const [asking, setAsking] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    try {
      sessionStorage.setItem(STEP_KEY, String(step));
    } catch {
      /* storage blocked */
    }
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
    document.getElementById(TITLE_ID)?.focus({ preventScroll: true });
  }, [step]);

  const next = () => (step < LAST ? setStep(step + 1) : onDone());
  const back = () => setStep((s) => Math.max(1, s - 1));
  useHardwareBack(() => (step > 1 ? back() : exitApp()));

  const turnOn = async () => {
    setAsking(true);
    // Android 13+ and browsers show their own prompt; CLR goes on whatever the answer.
    await requestNotifications();
    setAsking(false);
    onDone();
  };

  const primary: Record<number, { label: string; onClick: () => void; icon?: Icon }> = {
    1: { label: "Get started", onClick: next },
    2: { label: "Sounds good", onClick: next },
    3: { label: "Continue", onClick: next, icon: ArrowRight },
    4: { label: "Turn on notifications", onClick: turnOn },
  };
  const secondary: Record<number, { label: string; onClick: () => void } | undefined> = {
    3: { label: "Skip for now", onClick: next },
    4: { label: "Not now", onClick: onDone },
  };
  const p = primary[step];
  const s = secondary[step];

  let body: ReactNode;
  if (step === 1) body = <StepDoes mobile={mobile} />;
  else if (step === 2) body = <StepPrivacy />;
  else if (step === 3) body = <StepSources />;
  else body = <StepNotify />;

  const bar = (
    <div
      className={styles.stepper}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={LAST}
      aria-valuenow={step}
      aria-valuetext={`Step ${step} of ${LAST}: ${STEPS[step - 1]}`}
    >
      {STEPS.map((name, i) => (
        <i key={name} className={i < step ? styles.done : undefined} />
      ))}
    </div>
  );

  if (mobile) {
    return (
      <div className={styles.phone}>
        <header className={styles.phoneTop}>
          {step > 1 ? <Button variant="ghost" iconOnly icon={ArrowLeft} aria-label="Back" onClick={back} /> : <span className={styles.spacer} />}
          {bar}
          {step < LAST ? (
            <Button variant="ghost" size="sm" onClick={onDone}>
              Skip
            </Button>
          ) : (
            <span className={styles.spacer} />
          )}
        </header>
        <main className={styles.phoneBody}>{body}</main>
        <footer className={styles.phoneFoot}>
          <Button size="lg" block loading={asking} loadingLabel="Asking…" onClick={p.onClick}>
            {p.label}
          </Button>
          {s && (
            <Button variant="ghost" block onClick={s.onClick}>
              {s.label}
            </Button>
          )}
        </footer>
      </div>
    );
  }

  return (
    <div className={styles.desk}>
      <header className={styles.deskTop}>
        <div className={styles.brand}>
          <Logo size={28} />
          <b>Cognitive Load Router</b>
        </div>
        <div className={styles.progress}>
          <span className={styles.caption} aria-hidden="true">
            Step {step} of {LAST} · {STEPS[step - 1]}
          </span>
          {bar}
        </div>
      </header>
      <main className={[styles.deskBody, step === 3 && styles.wide].filter(Boolean).join(" ")}>{body}</main>
      <footer className={[styles.deskFoot, step === 3 && styles.wide].filter(Boolean).join(" ")}>
        {step > 1 ? (
          <Button variant="ghost" icon={ArrowLeft} onClick={back}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <div className={styles.footRight}>
          {s && (
            <Button variant="ghost" onClick={s.onClick}>
              {s.label}
            </Button>
          )}
          <Button iconRight={p.icon} loading={asking} loadingLabel="Asking…" onClick={p.onClick}>
            {p.label}
          </Button>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Title({ children, sub }: { children: string; sub?: string }) {
  return (
    <div className={styles.heading}>
      <h1 id={TITLE_ID} tabIndex={-1}>
        {children}
      </h1>
      {sub && <p>{sub}</p>}
    </div>
  );
}

function StepDoes({ mobile }: { mobile: boolean }) {
  return (
    <div className={styles.step}>
      <div className={styles.gauge} aria-hidden="true">
        <LoadGauge load={0.62} context="deep_focus" confidence={1} size={mobile ? 200 : 220} />
      </div>
      <Title sub="CLR estimates how mentally loaded you are, every 2 seconds, from how you work. Then it adjusts:">Study with your brain, not against it</Title>
      <ul className={styles.promises}>
        {DOES.map(([I, title, body]) => (
          <li key={title}>
            <I size={20} aria-hidden="true" />
            <span>
              <b>{title}</b>
              {body}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepPrivacy() {
  return (
    <div className={styles.step}>
      <Title sub="Plain words, no small print.">What CLR sees, and what it never does</Title>
      <PrivacyPromise />
      <p className={styles.note}>Export or delete everything at any time in Settings, under Privacy.</p>
    </div>
  );
}

const ONBOARDING_DESC = {
  vscode: "Install “Cognitive Load Router” from the Extensions view, run “CLR: Pair”, then enter the code.",
  desktop: "Window changes and idle time across all apps. macOS, Windows, Linux.",
  lms: "Activity in Canvas, Moodle or Blackboard. Not your grades or messages.",
};

function StepSources() {
  const pairing = usePairing();
  const n = SOURCE_ORDER.filter((k) => pairing.stateFor(k) === "connected").length;
  const status =
    n === 0
      ? { title: "No sources yet.", body: "You can connect them later in Settings. Your load appears once one is sending." }
      : n === 1
        ? { title: "1 source connected.", body: "Enough to start. Load estimates get steadier with 2 or more." }
        : { title: `${n} sources connected.`, body: "Load estimates will be steadier for it." };
  return (
    <div className={styles.step}>
      <Title sub="Each source adds a little more signal. Start with one: CLR works with any mix, and you can add more later in Settings.">Connect where you study</Title>
      <div className={styles.sources}>
        <SourceList descriptions={ONBOARDING_DESC} />
      </div>
      <div aria-live="polite">
        <Banner tone="neutral" icon={Info} title={status.title} body={status.body} />
      </div>
    </div>
  );
}

function StepNotify() {
  const { alerts, setAlerts } = usePrefs();
  return (
    <div className={styles.step}>
      <Title sub="Just three kinds of notification, all gentle. You can change each one later.">Let CLR nudge you</Title>
      <div className={styles.sample} role="img" aria-label="Example notification: Break time. Focus session 3 is done. Your 5-minute break is ready.">
        <div className={styles.sampleHead}>
          <span className={styles.sampleApp}>
            <Coffee size={12} />
          </span>
          Cognitive Load Router · now
        </div>
        <p className={styles.sampleTitle}>Break time</p>
        <p className={styles.sampleBody}>Focus session 3 is done. Your 5-minute break is ready.</p>
        <div className={styles.sampleActions}>
          <span>Start break</span>
          <span>Skip</span>
        </div>
      </div>
      <div className={styles.toggles}>
        <Toggle row label="Break prompts" description="When a Pomodoro ends." checked={alerts.breaks} onChange={(v) => setAlerts({ breaks: v })} />
        <Toggle row label="Context changes" description="Entering deep focus, or getting stuck." checked={alerts.context} onChange={(v) => setAlerts({ context: v })} />
        <Toggle row label="Overload warnings" description="When load stays above your fatigue line. At most every 5 min." checked={alerts.overload} onChange={(v) => setAlerts({ overload: v })} />
      </div>
    </div>
  );
}
