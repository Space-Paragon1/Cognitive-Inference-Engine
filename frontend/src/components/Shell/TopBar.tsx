import { BellOff, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { useGaugeState, useSources } from "../../live/LiveState";
import { usePrefs } from "../../live/PrefsState";
import { lastFocusChoice, useTimer } from "../../live/TimerState";
import { navigate } from "../../lib/router";
import { Button } from "../Button";
import { ConnectionStatus } from "../ConnectionStatus";
import { useToast } from "../Toast";
import styles from "./TopBar.module.css";

interface Props {
  title: string;
  sub?: ReactNode;
  headingId?: string;
  actions?: ReactNode;
}

/** Desktop top bar: page title and subtitle on the left, actions on the right. */
export function TopBar({ title, sub, headingId, actions }: Props) {
  return (
    <header className={styles.topbar}>
      <div className={styles.title}>
        <h1 id={headingId} tabIndex={-1}>
          {title}
        </h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className={styles.actions}>{actions ?? <TopBarActions />}</div>
    </header>
  );
}

/** Live status with source chips; re-renders only when the status or sources change. */
export function LiveStatus({ showSources = false }: { showSources?: boolean }) {
  const { status, lastReadingAt } = useGaugeState();
  const sources = useSources();
  const seen = lastReadingAt ? Math.max(0, (Date.now() - lastReadingAt) / 1000) : undefined;
  return <ConnectionStatus status={status} lastSeenSeconds={seen} sources={showSources ? sources : undefined} />;
}

export function DndButton() {
  const { dnd, dndBusy, setDnd } = usePrefs();
  const toast = useToast();
  return (
    <Button
      variant="ghost"
      iconOnly
      icon={BellOff}
      pressed={dnd}
      disabled={dndBusy}
      aria-label="Do Not Disturb"
      onClick={async () => {
        const ok = await setDnd(!dnd);
        if (!ok) toast.show({ key: "dnd", title: "Couldn't change Do Not Disturb", body: "Check your connection and try again.", tone: "critical" });
      }}
    />
  );
}

export function StartFocusButton() {
  const timer = useTimer();
  const toast = useToast();
  if (timer.focus?.active) {
    return (
      <Button variant="secondary" icon={Timer} onClick={() => navigate("focus")}>
        View focus
      </Button>
    );
  }
  return (
    <Button
      variant="primary"
      icon={Timer}
      onClick={async () => {
        const c = lastFocusChoice();
        try {
          await timer.startFocus(c.minutes, c.blockTabs);
        } catch {
          toast.show({ key: "focus", title: "Couldn't start focus mode", body: "Check your connection and try again.", tone: "critical" });
        }
      }}
    >
      Start focus
    </Button>
  );
}

/** The default actions: Live status, Do Not Disturb and Start focus. */
export function TopBarActions() {
  return (
    <>
      <LiveStatus />
      <DndButton />
      <StartFocusButton />
    </>
  );
}
