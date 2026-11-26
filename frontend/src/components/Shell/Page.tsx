import { useEffect, useId } from "react";
import type { ReactNode } from "react";
import { useGaugeState } from "../../live/LiveState";
import { navigate } from "../../lib/router";
import { MobileTopBar } from "../TabBar";
import { useShell } from "./ShellContext";
import { TopBar } from "./TopBar";
import styles from "./Page.module.css";

interface Props {
  /** Desktop title (the Now greeting) and mobile title, if different. */
  title: string;
  mobileTitle?: string;
  sub?: ReactNode;
  /** Desktop top-bar actions. Default: Live status, Do Not Disturb, Start focus. */
  actions?: ReactNode;
  /** Replaces the load pill and bell on mobile. */
  mobileRight?: ReactNode;
  /** Something between the top bar and the grid (connection banners). */
  banner?: ReactNode;
  children: ReactNode;
}

let firstPage = true;

/** One screen: the right top bar for the layout, then the padded content column. */
export function Page({ title, mobileTitle, sub, actions, mobileRight, banner, children }: Props) {
  const { layout, onBack, openNotifications } = useShell();
  const headingId = useId();

  // After navigation, move focus to the new page title so screen readers announce it.
  useEffect(() => {
    if (firstPage) {
      firstPage = false;
      return;
    }
    window.scrollTo(0, 0);
    document.getElementById(headingId)?.focus({ preventScroll: true });
  }, [headingId]);

  return (
    <>
      {layout === "mobile" ? (
        <MobileGaugeBar title={mobileTitle ?? title} headingId={headingId} onBack={onBack} onNotifications={openNotifications} right={mobileRight} />
      ) : (
        <TopBar title={title} sub={sub} headingId={headingId} actions={actions} />
      )}
      <div className={styles.content} id="main">
        {banner && <div className={styles.banner}>{banner}</div>}
        {children}
      </div>
    </>
  );
}

function MobileGaugeBar(props: { title: string; headingId: string; onBack?: () => void; onNotifications: () => void; right?: ReactNode }) {
  const g = useGaugeState();
  return (
    <MobileTopBar
      {...props}
      load={g.load}
      context={g.context}
      confidence={g.confidence}
      status={g.status}
      onOpenNow={() => navigate("now")}
    />
  );
}
