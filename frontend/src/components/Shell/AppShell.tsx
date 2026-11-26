import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useDirectives } from "../../live/DirectivesState";
import { useGaugeState, useSources } from "../../live/LiveState";
import { usePrefs } from "../../live/PrefsState";
import { useTasks } from "../../live/TasksState";
import { useRunningTimer } from "../../live/TimerState";
import { useDirectiveCards } from "../../live/useDirectiveCards";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { mobileTab, navigate, parentRoute } from "../../lib/router";
import { countSending } from "../../lib/sources";
import type { Route } from "../../types/ui";
import { BottomSheet } from "../BottomSheet";
import { MiniPlayer } from "../ControlPanel/MiniPlayer";
import { DirectivesFeed } from "../DirectivesFeed/DirectiveCard";
import { Sidebar } from "../Sidebar";
import { TabBar } from "../TabBar";
import { ShellContext } from "./ShellContext";
import type { Layout } from "./ShellContext";
import styles from "./AppShell.module.css";

interface Props {
  route: Route;
  children: ReactNode;
}

export function useLayout(): Layout {
  const wide = useMediaQuery("(min-width: 1280px)");
  const notPhone = useMediaQuery("(min-width: 768px)");
  return wide ? "desktop" : notPhone ? "rail" : "mobile";
}

/** Sidebar or rail on desktop and tablet; top bar, tab bar and mini-player on phones. */
export function AppShell({ route, children }: Props) {
  const layout = useLayout();
  const mobile = layout === "mobile";
  const [bellOpen, setBellOpen] = useState(false);
  const { unseen, markSeen } = useDirectives();
  const timer = useRunningTimer();
  const showMini = mobile && timer != null && route !== "focus";

  const parent = parentRoute(route, mobile);
  const shell = useMemo(
    () => ({
      layout,
      onBack: parent ? () => navigate(parent, null, { replace: true }) : undefined,
      openNotifications: () => {
        setBellOpen(true);
        markSeen();
      },
      unseen,
    }),
    [layout, parent, markSeen, unseen]
  );

  return (
    <ShellContext.Provider value={shell}>
      <div className={styles.shell} data-layout={layout} data-mini={showMini || undefined}>
        <a className={styles.skip} href="#main">
          Skip to content
        </a>
        {!mobile && <ShellSidebar route={route} collapsed={layout === "rail"} />}
        <div className={styles.main}>{children}</div>
        {showMini && timer && (
          <div className={styles.mini}>
            <MiniPlayer
              phase={timer.phase}
              remainingSeconds={timer.remainingSeconds}
              totalSeconds={timer.totalSeconds}
              paused={timer.paused}
              onToggle={timer.toggle}
              onExpand={() => navigate("focus")}
            />
          </div>
        )}
        {mobile && <TabBar active={mobileTab(route)} onNavigate={(r) => navigate(r)} />}
      </div>
      {mobile && <NotificationsSheet open={bellOpen} onClose={() => setBellOpen(false)} />}
    </ShellContext.Provider>
  );
}

function ShellSidebar({ route, collapsed }: { route: Route; collapsed: boolean }) {
  const g = useGaugeState();
  const sources = useSources();
  const { tasks } = useTasks();
  const { user } = useAuth();
  const { theme, toggleTheme } = usePrefs();
  const timer = useRunningTimer();
  return (
    <Sidebar
      active={route === "more" ? "now" : route}
      load={g.load}
      context={g.context}
      confidence={g.confidence}
      status={g.status}
      loading={g.loading}
      lastReadingAt={g.lastReadingAt}
      sourceCount={countSending(sources)}
      taskCount={tasks.length}
      email={user?.email}
      theme={theme}
      onToggleTheme={toggleTheme}
      collapsed={collapsed}
      timer={timer ?? undefined}
      timerPaused={timer?.paused}
      onTimerToggle={timer?.toggle}
      onNavigate={(r) => navigate(r)}
    />
  );
}

/** The bell on mobile: everything CLR is doing right now. */
function NotificationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cards } = useDirectiveCards();
  return (
    <BottomSheet open={open} title="What CLR is doing" onClose={onClose}>
      <DirectivesFeed directives={cards} bare limit={20} />
    </BottomSheet>
  );
}
