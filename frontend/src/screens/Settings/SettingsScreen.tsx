/* Settings (handoff.md: section nav 3 · cards 9). Changes save on their own; the top
   bar shows "Saved". Phones get grouped sections, with Privacy and Connected sources
   as their own pages (#/settings/privacy, #/settings/sources). */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { useSettings } from "../../live/SettingsState";
import { navigate } from "../../lib/router";
import { Card } from "../../components/Card";
import { SkeletonRow } from "../../components/Skeleton";
import { Cell, ConnectionBanner, Grid, Page, useShell } from "../../components/Shell";
import {
  AccountSection,
  NotificationSection,
  PomodoroSection,
  PrivacySection,
  SECTIONS,
  SaveStatus,
  SessionSection,
  SettingsNav,
  SourcesSection,
  ThresholdSection,
  sectionDomId,
} from "../../components/Settings";
import type { SectionId } from "../../components/Settings";
import styles from "./SettingsScreen.module.css";
import { LoadError } from "../../components/LoadError";

const OFFLINE = "Changes are kept on this device and save when you are back.";
const isSection = (v: string | null): v is SectionId => SECTIONS.some((s) => s.id === v);

function reduceMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** The engine-backed sections: skeleton rows while loading, one error card if they can't load. */
function EngineSections({ variant }: { variant: "card" | "group" }) {
  const { settings, loading, loadError, reload } = useSettings();
  if (loading && !settings) {
    return (
      <Card aria-busy>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </Card>
    );
  }
  if (loadError && !settings) {
    return (
      <Card>
        <LoadError compact title="Couldn't load your settings" body="Your settings are safe. Try again in a moment." offlineWhat="Your settings load" onRetry={reload} />
      </Card>
    );
  }
  return (
    <>
      <PomodoroSection variant={variant} />
      <ThresholdSection variant={variant} />
      <SessionSection variant={variant} />
    </>
  );
}

export function SettingsScreen({ sub }: { sub: string | null }) {
  const { layout } = useShell();
  const { saveState } = useSettings();
  const mobile = layout === "mobile";
  const banner = <ConnectionBanner offlineBody={OFFLINE} />;
  // Phones keep the load pill in the top bar and swap in the save status while it
  // matters: "Saved" shows for 3 s, the other states until they resolve.
  const [showSave, setShowSave] = useState(false);
  useLayoutEffect(() => {
    if (saveState === "idle") {
      setShowSave(false);
      return;
    }
    setShowSave(true);
    if (saveState !== "saved") return;
    const t = window.setTimeout(() => setShowSave(false), 3000);
    return () => window.clearTimeout(t);
  }, [saveState]);
  const mobileRight = showSave ? <SaveStatus /> : undefined;

  if (mobile) {
    if (sub === "privacy") {
      return (
        <Page title="Privacy" banner={banner}>
          <PrivacySection variant="group" />
        </Page>
      );
    }
    if (sub === "sources") {
      return (
        <Page title="Connected sources" banner={banner}>
          <SourcesSection variant="group" />
        </Page>
      );
    }
    return (
      <Page title="Settings" banner={banner} mobileRight={mobileRight}>
        <div className={styles.stack}>
          <EngineSections variant="group" />
          <NotificationSection variant="group" />
          <SourcesSection variant="group" />
          <Card className={styles.linkCard}>
            <button type="button" className={styles.linkRow} onClick={() => navigate("settings", "privacy")}>
              <Lock size={20} aria-hidden="true" />
              <span>
                <b>Privacy</b>
                <small>Export or delete your data</small>
              </span>
              <ChevronRight size={18} aria-hidden="true" className={styles.chev} />
            </button>
          </Card>
        </div>
      </Page>
    );
  }

  return <DesktopSettings sub={sub} banner={banner} />;
}

function DesktopSettings({ sub, banner }: { sub: string | null; banner: ReactNode }) {
  const [current, setCurrent] = useState<SectionId>(isSection(sub) ? sub : "pomodoro");
  const picking = useRef(0);
  const ready = useSettings().settings != null;

  const scrollTo = useCallback((id: SectionId, focus: boolean) => {
    const el = document.getElementById(sectionDomId(id));
    if (!el) return;
    picking.current = Date.now();
    setCurrent(id);
    el.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
    if (focus) el.focus({ preventScroll: true });
  }, []);

  // Open on the section in the link (#/settings/sources).
  useEffect(() => {
    if (isSection(sub)) window.setTimeout(() => scrollTo(sub, false), 50);
    // Only on arrival: later section picks update the link themselves.
  }, []);

  // Mark the section in view.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(sectionDomId(s.id))).filter((e): e is HTMLElement => !!e);
    const seen = new Map<string, boolean>();
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.isIntersecting));
        if (Date.now() - picking.current < 800) return;
        const first = SECTIONS.find((s) => seen.get(sectionDomId(s.id)));
        if (first) setCurrent(first.id);
      },
      { rootMargin: "-88px 0px -55% 0px" }
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [ready]);

  const pick = (id: SectionId) => {
    scrollTo(id, true);
    navigate("settings", id, { replace: true });
  };

  return (
    <Page title="Settings" sub="Changes save as you go" banner={banner} actions={<SaveStatus />}>
      <Grid>
        <Cell span={3} tablet={8} className={styles.navCell}>
          <SettingsNav current={current} onPick={pick} />
        </Cell>
        <Cell span={9} tablet={8}>
          <div className={styles.cards}>
            <EngineSections variant="card" />
            <NotificationSection variant="card" />
            <SourcesSection variant="card" />
            <AccountSection variant="card" />
            <PrivacySection variant="card" />
          </div>
        </Cell>
      </Grid>
    </Page>
  );
}
