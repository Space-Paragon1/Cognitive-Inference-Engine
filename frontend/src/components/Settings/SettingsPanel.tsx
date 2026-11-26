/* SettingsPanel: one group per section. Engine settings (breaks, thresholds, session
   gap) save on their own through SettingsState (400 ms after the last change);
   notifications, vibration and the theme are kept on this device. */
import { useState } from "react";
import type { ReactNode } from "react";
import { Bell, Copy, Download, Gauge, Globe, History as HistoryIcon, Lock, LogOut, Palette, Timer, Trash2, User } from "lucide-react";
import type { Icon } from "../../types/ui";
import type { SourceKind } from "../../types/ui";
import { engineUrlForPlugins } from "../../api/client";
import { exportMyData } from "../../api/privacy";
import { useAuth } from "../../auth/AuthContext";
import { useSettings } from "../../live/SettingsState";
import { usePrefs } from "../../live/PrefsState";
import type { ThemeChoice } from "../../live/PrefsState";
import { usePairing } from "../../live/usePairing";
import { fullDate, initials, pct } from "../../lib/format";
import { saveFile } from "../../lib/files";
import { Banner } from "../Banner";
import { Button } from "../Button";
import { SegmentedControl } from "../SegmentedControl";
import { Slider } from "../Slider";
import { SourceCard } from "../SourceCard";
import { Toggle } from "../Toggle";
import { useToast } from "../Toast";
import { DeleteDataSheet } from "./DeleteDataSheet";
import styles from "./SettingsPanel.module.css";

export type SectionId = "pomodoro" | "thresholds" | "sessions" | "notifications" | "sources" | "account" | "privacy";

export const SECTIONS: { id: SectionId; label: string; icon: Icon }[] = [
  { id: "pomodoro", label: "Pomodoro", icon: Timer },
  { id: "thresholds", label: "Load thresholds", icon: Gauge },
  { id: "sessions", label: "Sessions", icon: HistoryIcon },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "sources", label: "Connected sources", icon: Globe },
  { id: "account", label: "Account", icon: User },
  { id: "privacy", label: "Privacy", icon: Lock },
];

export const sectionDomId = (id: SectionId) => `settings-${id}`;

/** "card": desktop card with the heading inside. "group": phone overline heading above a card. */
type Variant = "card" | "group";

function Section({ id, title, desc, variant, plain = false, children }: { id: SectionId; title: string; desc?: string; variant: Variant; plain?: boolean; children: ReactNode }) {
  const headingId = `${sectionDomId(id)}-title`;
  if (variant === "group") {
    return (
      <section id={sectionDomId(id)} className={styles.group} aria-labelledby={headingId}>
        <h2 id={headingId} className={styles.overline}>
          {title}
        </h2>
        {desc && <p className={styles.groupDesc}>{desc}</p>}
        {plain ? children : <div className={styles.groupCard}>{children}</div>}
      </section>
    );
  }
  return (
    <section id={sectionDomId(id)} className={styles.card} aria-labelledby={headingId} tabIndex={-1}>
      <div>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
        {desc && <p className={styles.desc}>{desc}</p>}
      </div>
      {children}
    </section>
  );
}

const minutesOf = (s: number) => Math.round(s / 60);

export function PomodoroSection({ variant }: { variant: Variant }) {
  const { settings, defaults, update } = useSettings();
  if (!settings || !defaults) return null;
  return (
    <Section id="pomodoro" variant={variant} title="Pomodoro" desc="Focus length adapts to your load (10, 15, 25 or 35 min). Breaks are yours to set.">
      <div className={styles.pair}>
        <Slider
          label="Short break"
          value={minutesOf(settings.short_break_seconds)}
          defaultValue={minutesOf(defaults.short_break_seconds)}
          min={1}
          max={15}
          unit=" min"
          onChange={(v) => update({ short_break_seconds: v * 60 })}
          onReset={() => update({ short_break_seconds: defaults.short_break_seconds })}
        />
        <Slider
          label="Long break"
          value={minutesOf(settings.long_break_seconds)}
          defaultValue={minutesOf(defaults.long_break_seconds)}
          min={5}
          max={40}
          unit=" min"
          help="After every 4 sessions."
          onChange={(v) => update({ long_break_seconds: v * 60 })}
          onReset={() => update({ long_break_seconds: defaults.long_break_seconds })}
        />
      </div>
    </Section>
  );
}

export function ThresholdSection({ variant }: { variant: Variant }) {
  const { settings, defaults, update } = useSettings();
  if (!settings || !defaults) return null;
  const high = Math.round(settings.high_load_threshold * 100);
  const fatigue = Math.round(settings.fatigue_threshold * 100);
  // Moving high load pushes the fatigue floor; fatigue always stays at least 1 point above.
  const setHigh = (v: number) => update(v >= fatigue ? { high_load_threshold: v / 100, fatigue_threshold: Math.min(99, v + 1) / 100 } : { high_load_threshold: v / 100 });
  return (
    <Section id="thresholds" variant={variant} title="Load thresholds" desc="Where “high load” and “fatigue” begin for you. Fatigue always sits above high load.">
      <div className={styles.zones} aria-hidden="true">
        <span className={styles.zoneNormal} style={{ flex: high }}>
          Normal · below {high}%
        </span>
        <span data-ctx="shallow_work" className={styles.zoneEdge} style={{ flex: Math.max(fatigue - high, 8) }}>
          High<span className={styles.zonePct}> · {high}%</span>
        </span>
        <span data-ctx="fatigue" className={styles.zoneEdge} style={{ flex: Math.max(100 - fatigue, 8) }}>
          Fatigue<span className={styles.zonePct}> · {fatigue}%</span>
        </span>
      </div>
      <p className="sr-only">
        Normal below {high}%, high from {high}%, fatigue from {fatigue}%.
      </p>
      <div className={styles.pair}>
        <Slider
          label="High load"
          value={high}
          defaultValue={Math.round(defaults.high_load_threshold * 100)}
          min={50}
          max={95}
          unit="%"
          onChange={setHigh}
          onReset={() => setHigh(Math.round(defaults.high_load_threshold * 100))}
        />
        <Slider
          label="Fatigue"
          value={fatigue}
          defaultValue={Math.round(defaults.fatigue_threshold * 100)}
          min={60}
          max={99}
          unit="%"
          blockBelow={high + 1}
          help={`Can’t go below ${high + 1}%.`}
          onChange={(v) => update({ fatigue_threshold: Math.max(v, high + 1) / 100 })}
          onReset={() => update({ fatigue_threshold: Math.max(Math.round(defaults.fatigue_threshold * 100), high + 1) / 100 })}
        />
      </div>
    </Section>
  );
}

export function SessionSection({ variant }: { variant: Variant }) {
  const { settings, defaults, update } = useSettings();
  if (!settings || !defaults) return null;
  return (
    <Section id="sessions" variant={variant} title="Sessions">
      <div className={styles.single}>
        <Slider
          label="Session gap"
          value={settings.session_gap_minutes}
          defaultValue={defaults.session_gap_minutes}
          min={2}
          max={60}
          unit=" min"
          help="Idle longer than this ends a session."
          onChange={(v) => update({ session_gap_minutes: v })}
          onReset={() => update({ session_gap_minutes: defaults.session_gap_minutes })}
        />
      </div>
    </Section>
  );
}

export function NotificationSection({ variant }: { variant: Variant }) {
  const { alerts, setAlerts, vibrate, setVibrate, themeChoice, setThemeChoice } = usePrefs();
  const { thresholds } = useSettings();
  return (
    <Section id="notifications" variant={variant} title="Notifications" desc={variant === "card" ? "On this device." : undefined}>
      <div className={styles.rows}>
        <Toggle row label="Break prompts" description="When a Pomodoro ends." checked={alerts.breaks} onChange={(v) => setAlerts({ breaks: v })} />
        <Toggle row label="Context changes" description="Deep focus, stuck, recovering." checked={alerts.context} onChange={(v) => setAlerts({ context: v })} />
        <Toggle row label="Overload warnings" description={`When load stays above ${pct(thresholds.fatigue)}. At most every 5 min.`} checked={alerts.overload} onChange={(v) => setAlerts({ overload: v })} />
        <Toggle row label="Vibrate" description="Haptics on timer buttons and alerts." checked={vibrate} onChange={setVibrate} />
        {variant === "card" && (
          <div className={styles.themeRow}>
            <span className={styles.themeLabel}>
              <Palette size={18} aria-hidden="true" />
              Theme
            </span>
            <ThemeSwitch value={themeChoice} onChange={setThemeChoice} />
          </div>
        )}
      </div>
    </Section>
  );
}

export function ThemeSwitch({ value, onChange }: { value: ThemeChoice; onChange: (v: ThemeChoice) => void }) {
  return (
    <SegmentedControl
      size="sm"
      label="Theme"
      value={value}
      onChange={onChange}
      options={[
        { value: "system", label: "System" },
        { value: "dark", label: "Dark" },
        { value: "light", label: "Light" },
      ]}
    />
  );
}

const KINDS: { kind: SourceKind; recommended?: boolean; optional?: boolean }[] = [
  { kind: "browser", recommended: true },
  { kind: "vscode" },
  { kind: "desktop" },
  { kind: "lms", optional: true },
];

/** The four source cards with their pairing flow, shared by Settings and onboarding. */
export function SourceList({ descriptions }: { descriptions?: Partial<Record<SourceKind, string>> }) {
  const pairing = usePairing();
  const [lastKind, setLastKind] = useState<SourceKind>("browser");
  const connect = (kind: SourceKind) => {
    setLastKind(kind);
    pairing.connect(kind);
  };
  return (
    <>
      {pairing.failed && (
        <Banner tone="critical" title="Couldn't create a pairing code." body="Check your connection." action={{ label: "Retry", onClick: () => connect(lastKind) }} />
      )}
      {pairing.devicesError && !pairing.devices && <Banner tone="critical" title="Couldn't load your sources." body="Try again in a moment." />}
      {KINDS.map(({ kind, recommended, optional }) => (
        <SourceCard
          key={kind}
          kind={kind}
          desc={pairing.stateFor(kind) === "connected" ? undefined : descriptions?.[kind]}
          state={pairing.stateFor(kind)}
          code={pairing.waiting?.kind === kind ? pairing.waiting.code : undefined}
          codeExpiresIn={pairing.waiting?.kind === kind ? pairing.codeExpiresIn : undefined}
          recommended={recommended && pairing.stateFor(kind) !== "connected"}
          optional={optional}
          connecting={pairing.connecting === kind}
          lastSeen={pairing.lastSeen(kind)}
          onConnect={() => connect(kind)}
          onCancel={pairing.cancel}
          onDisconnect={() => pairing.disconnect(kind)}
        />
      ))}
    </>
  );
}

export function SourcesSection({ variant }: { variant: Variant }) {
  const toast = useToast();
  const url = engineUrlForPlugins();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.show({ title: "Engine address copied." });
    } catch {
      toast.show({ title: "Couldn't copy.", body: url, tone: "critical" });
    }
  };
  return (
    <Section id="sources" variant={variant} plain title="Connected sources" desc="CLR reads how you work, not what you work on.">
      <div className={styles.sources}>
        <SourceList />
        <div className={styles.engine}>
          <span>
            Extensions connect to <code>{url}</code>
          </span>
          <Button variant="ghost" size="sm" icon={Copy} onClick={copy}>
            Copy
          </Button>
        </div>
      </div>
    </Section>
  );
}

export function AccountSection({ variant }: { variant: Variant }) {
  const { user, logout } = useAuth();
  return (
    <Section id="account" variant={variant} title="Account">
      <div className={styles.account}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(user?.email)}
        </span>
        <span className={styles.who}>
          <b>{user?.email}</b>
          {user?.created_at ? <small>Member since {fullDate(user.created_at * 1000)}</small> : null}
        </span>
        <Button variant="secondary" size="sm" icon={LogOut} onClick={logout}>
          Sign out
        </Button>
      </div>
    </Section>
  );
}

export function PrivacySection({ variant }: { variant: Variant }) {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);

  const doExport = async () => {
    setBusy(true);
    try {
      const { json, csv } = await exportMyData(user);
      const day = new Date().toISOString().slice(0, 10);
      await saveFile(`clr-export-${day}.json`, json, "application/json");
      await saveFile(`clr-timeline-${day}.csv`, csv, "text/csv");
      toast.show({ title: "Your data is ready.", body: "Saved as JSON and CSV.", tone: "positive" });
    } catch {
      toast.show({ title: "Couldn't export your data.", body: "Check your connection and try again.", tone: "critical" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section id="privacy" variant={variant} plain title="Privacy">
      <div className={styles.privacy}>
        <div className={styles.privacyCard}>
          <p className={styles.small}>Download everything CLR has stored about you as JSON and CSV.</p>
          <Button variant="secondary" icon={Download} block={variant === "group"} loading={busy} loadingLabel="Preparing…" onClick={doExport}>
            Export my data
          </Button>
        </div>
        <div className={styles.dangerCard}>
          <p className={styles.small}>
            <b>Delete my data</b>
            <br />
            <span>Removes everything, including your account.</span>
          </p>
          <Button variant="danger" icon={Trash2} block={variant === "group"} onClick={() => setSheet(true)}>
            Delete my data
          </Button>
        </div>
      </div>
      <DeleteDataSheet open={sheet} onClose={() => setSheet(false)} />
    </Section>
  );
}
