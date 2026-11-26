/* The alert engine (ScreenAlerts): context-change toasts, the overload warning,
   break prompts, and the same messages as system notifications while CLR is in the
   background. Rules from handoff.md:
   - a context toast only after the new context holds for 3 readings (6 s);
   - overload after 3 readings in a row above the fatigue line, then a 5-minute hold;
   - Do Not Disturb mutes everything except the timer ending;
   - haptics belong to the timer (TimerState), none on context changes. */
import { useEffect, useRef, useState } from "react";
import { Coffee, Wind } from "lucide-react";
import type { CognitiveContext, CognitiveState } from "../../types";
import { CTX } from "../../lib/domain";
import { postNotification } from "../../lib/notify";
import { navigate, useRoute } from "../../lib/router";
import { pct } from "../../lib/format";
import { useLiveTicks } from "../../live/LiveState";
import { usePrefs } from "../../live/PrefsState";
import { useSettings } from "../../live/SettingsState";
import { useTimer } from "../../live/TimerState";
import { BottomSheet } from "../BottomSheet";
import { Button } from "../Button";
import { useLayout } from "../Shell";
import { useToast } from "../Toast";
import styles from "./Alerts.module.css";

const HOLD_TICKS = 3;
const OVERLOAD_HOLD_MS = 5 * 60_000;
const REST_MINUTES = 5;
/** Below this the estimate is rough, so CLR doesn't announce it. */
const MIN_CONFIDENCE = 0.5;

const CONTEXT_TOAST: Partial<Record<CognitiveContext, { title: string; body: string; notice: string }>> = {
  deep_focus: {
    title: "Deep focus activated",
    body: "You are in the zone. Notifications are silenced until you surface.",
    notice: "Notifications are silenced until you surface.",
  },
  shallow_work: { title: "Shallow work", body: CTX.shallow_work.blurb, notice: "Good for lighter tasks." },
  stuck: { title: "You seem stuck", body: CTX.stuck.blurb, notice: "A fresh angle might help." },
  fatigue: { title: "Signs of fatigue", body: CTX.fatigue.blurb, notice: "Resting counts as progress." },
  recovering: { title: "Recovering", body: CTX.recovering.blurb, notice: "Ease back in gently." },
};

const hidden = () => document.visibilityState === "hidden";
const minutesText = (m: number) => `${m} minute${m === 1 ? "" : "s"}`;

interface BreakPrompt {
  session: number;
  breakMinutes: number;
  long: boolean;
}

export function Alerts() {
  const toast = useToast();
  const timer = useTimer();
  const { thresholds } = useSettings();
  const prefs = usePrefs();
  const { route } = useRoute();
  const mobile = useLayout() === "mobile";
  const [prompt, setPrompt] = useState<BreakPrompt | null>(null);

  // Latest values for the tick and phase callbacks, without re-subscribing.
  const now = useRef({ toast, timer, thresholds, prefs, route, mobile });
  now.current = { toast, timer, thresholds, prefs, route, mobile };

  const ctx = useRef<{ shown: CognitiveContext | null; candidate: CognitiveContext | null; count: number }>({ shown: null, candidate: null, count: 0 });
  const over = useRef<{ count: number; since: number; last: number }>({ count: 0, since: 0, last: -Infinity });
  const workSeconds = useRef(25 * 60);

  if (timer.pomodoro?.phase === "work") workSeconds.current = timer.pomodoro.duration_seconds;

  useLiveTicks((s: CognitiveState) => {
    const { toast, timer, thresholds, prefs } = now.current;
    const muted = prefs.dnd;
    const resting = timer.rest != null || timer.pomodoro?.phase === "short_break" || timer.pomodoro?.phase === "long_break";
    const sure = s.confidence >= MIN_CONFIDENCE;

    /* Context changes */
    const c = ctx.current;
    if (s.context === c.candidate) c.count += 1;
    else {
      c.candidate = s.context;
      c.count = 1;
    }
    if (c.count === HOLD_TICKS && c.candidate !== c.shown) {
      const prev = c.shown;
      c.shown = c.candidate;
      // The first context after opening the app is the starting point, not a change.
      const copy = c.shown ? CONTEXT_TOAST[c.shown] : undefined;
      if (prev && prev !== "unknown" && copy && sure && !muted && prefs.alerts.context) {
        if (hidden()) void postNotification({ title: copy.title, body: copy.notice, tag: "context" });
        else toast.show({ key: "context", context: c.shown ?? undefined, title: copy.title, body: copy.body });
      }
    }

    /* Overload */
    const o = over.current;
    const t = Date.now();
    if (s.load_score > thresholds.fatigue && sure) {
      if (o.count === 0) o.since = t;
      o.count += 1;
    } else o.count = 0;
    if (o.count >= HOLD_TICKS && t - o.last >= OVERLOAD_HOLD_MS) {
      o.last = t;
      if (muted || resting || !prefs.alerts.overload) return;
      const line = pct(thresholds.fatigue);
      const mins = Math.floor((t - o.since) / 60_000);
      const body =
        mins >= 1
          ? `It has stayed above ${line} for ${minutesText(mins)}. A short break now usually makes the next stretch easier.`
          : `Load is above your fatigue line (${line}). A short break now usually makes the next stretch easier.`;
      if (hidden()) {
        void postNotification({
          title: "Your load has been high for a while",
          body: mins >= 1 ? `Above ${line} for ${minutesText(mins)}. A short break could help.` : `Above ${line}. A short break could help.`,
          tag: "overload",
        });
      }
      const id = toast.show({
        key: "overload",
        urgent: true,
        context: "fatigue",
        icon: Wind,
        title: "Your load has been high for a while",
        body,
        duration: null,
        actions: [
          {
            label: "Take 5 minutes",
            primary: true,
            onClick: () => {
              toast.dismiss(id);
              timer.startRest(REST_MINUTES);
              navigate("focus");
            },
          },
          { label: "Not now", onClick: () => toast.dismiss(id) },
        ],
      });
    }
  });

  /* Pomodoro phase changes. The timer ending is never muted by Do Not Disturb. */
  useEffect(
    () =>
      timer.onPhaseChange((ch) => {
        const { toast, timer, prefs, route, mobile } = now.current;
        if (!prefs.alerts.breaks) return;
        const brk = ch.to === "short_break" || ch.to === "long_break";
        if (ch.from === "work" && brk) {
          const breakMinutes = Math.round((timer.pomodoro?.duration_seconds ?? 300) / 60);
          const session = ch.sessionsCompleted;
          if (hidden()) {
            void postNotification({ title: "Break time", body: `Focus session ${session} is done. Your ${breakMinutes}-minute break has started.`, tag: "phase" });
            return;
          }
          // The Focus screen turns into the break by itself.
          if (route === "focus") return;
          if (mobile) {
            setPrompt({ session, breakMinutes, long: ch.to === "long_break" });
            return;
          }
          const id = toast.show({
            key: "phase",
            tone: "rest",
            icon: Coffee,
            title: "Break time",
            body: `Focus session ${session} is done. Your ${breakMinutes}-minute break has started.`,
            duration: null,
            actions: [
              {
                label: "Start break",
                primary: true,
                onClick: () => {
                  toast.dismiss(id);
                  navigate("focus");
                },
              },
              {
                label: "Skip",
                onClick: () => {
                  toast.dismiss(id);
                  void timer.skip();
                },
              },
            ],
          });
        } else if (brk === false && (ch.from === "short_break" || ch.from === "long_break") && ch.to === "work") {
          const focusMinutes = Math.round((timer.pomodoro?.duration_seconds ?? 1500) / 60);
          setPrompt(null);
          if (hidden()) void postNotification({ title: "Break is over", body: `Your next ${focusMinutes}-minute focus session has started.`, tag: "phase" });
          else if (route !== "focus") toast.show({ key: "phase", tone: "accent", title: "Break is over", body: `Your next ${focusMinutes}-minute focus session has started.` });
        }
      }),
    [timer.onPhaseChange]
  );

  const close = () => setPrompt(null);
  return (
    <BottomSheet
      open={prompt != null}
      title="Break time"
      onClose={close}
      actions={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              close();
              void timer.skip();
            }}
          >
            Skip break
          </Button>
          <Button
            variant="rest"
            onClick={() => {
              close();
              navigate("focus");
            }}
          >
            Start break
          </Button>
        </>
      }
    >
      {prompt && (
        <div className={styles.prompt} data-tone="rest">
          <span className={styles.art} aria-hidden="true">
            <Coffee size={28} />
          </span>
          <p className={styles.body}>
            Focus session {prompt.session} is done. {Math.round(workSeconds.current / 60)} minutes of work. Nice.
          </p>
          <p className={styles.length}>
            <b>{prompt.breakMinutes} min</b>
            {prompt.long ? "long break" : "short break"}
          </p>
        </div>
      )}
    </BottomSheet>
  );
}
