import { ChartColumn, Gauge, History, ListChecks, Moon, Settings, Sun, Timer, WifiOff } from "lucide-react";
import type { MouseEvent } from "react";
import type { Icon, Route, SidebarProps } from "../../types/ui";
import { CTX } from "../../lib/domain";
import { initials, clock, mmss } from "../../lib/format";
import { href } from "../../lib/router";
import { sourcesLine } from "../../lib/sources";
import { gaugeValueText, LoadGauge } from "../LoadGauge";
import { MiniPlayer } from "../ControlPanel/MiniPlayer";
import { isBreak } from "../ControlPanel/Timer";
import { Button } from "../Button";
import { Logo } from "../Logo";
import styles from "./Sidebar.module.css";

type Props = SidebarProps & {
  /** Still waiting for the first reading. */
  loading?: boolean;
  lastReadingAt?: number | null;
  sourceCount?: number;
  taskCount?: number;
  email?: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  timerPaused?: boolean;
  onTimerToggle?: () => void;
};

export const NAV: { route: Exclude<Route, "more">; label: string; icon: Icon }[] = [
  { route: "now", label: "Now", icon: Gauge },
  { route: "focus", label: "Focus", icon: Timer },
  { route: "tasks", label: "Tasks", icon: ListChecks },
  { route: "history", label: "History", icon: History },
  { route: "insights", label: "Insights", icon: ChartColumn },
  { route: "settings", label: "Settings", icon: Settings },
];

/** Desktop navigation: brand, live card, six sections, the running timer and the account. */
export function Sidebar({
  active,
  load,
  context,
  confidence,
  status,
  timer,
  collapsed = false,
  onNavigate,
  loading = false,
  lastReadingAt,
  sourceCount = 0,
  taskCount,
  email,
  theme,
  onToggleTheme,
  timerPaused = false,
  onTimerToggle,
}: Props) {
  const go = (route: Route) => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(route);
  };
  const noData = load == null && !loading;
  const stale = load != null && status !== "live";
  const ctx = CTX[noData ? "unknown" : context];
  const CtxIcon = ctx.icon;
  const valueText = gaugeValueText(load, context, confidence);

  const meta =
    status === "offline" ? (
      <>
        <WifiOff size={12} aria-hidden="true" />
        {lastReadingAt ? `Offline · last ${clock(lastReadingAt)}` : "Offline"}
      </>
    ) : status === "reconnecting" ? (
      <>
        <WifiOff size={12} aria-hidden="true" />
        Reconnecting…
      </>
    ) : (
      <>
        <b className={styles.liveDot} aria-hidden="true" />
        Live · {sourcesLine(sourceCount)}
      </>
    );

  const themeLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <aside className={[styles.sidebar, collapsed && styles.rail].filter(Boolean).join(" ")} aria-label="Sidebar">
      <a className={styles.brand} href={href("now")} onClick={go("now")} aria-label={collapsed ? "Cognitive Load Router, Now" : undefined}>
        <Logo size={28} />
        {!collapsed && <span>Cognitive Load Router</span>}
      </a>

      <a
        className={[styles.live, collapsed && styles.liveRail, stale && styles.stale].filter(Boolean).join(" ")}
        data-ctx={noData ? "unknown" : context}
        href={href("now")}
        onClick={go("now")}
        aria-label={`${valueText}. ${status === "live" ? "Live" : status === "reconnecting" ? "Reconnecting" : "Offline"}. Open Now`}
      >
        <span aria-hidden="true" className={styles.liveRing}>
          <LoadGauge variant="mini" size={44} load={noData ? null : load} context={context} confidence={confidence} status={status} showNumber={!noData} />
        </span>
        {collapsed ? (
          <span className={styles.tip} aria-hidden="true">
            {noData ? "No data yet" : `${Math.round((load ?? 0) * 100)}% · ${ctx.label}`}
          </span>
        ) : noData ? (
          <span className={styles.liveText} aria-hidden="true">
            <span className={styles.liveCtx} data-muted="">
              No data yet
            </span>
            <span className={styles.liveMeta}>Connect a source to start</span>
          </span>
        ) : (
          <span className={styles.liveText} aria-hidden="true">
            <span className={styles.liveCtx}>
              <CtxIcon size={16} />
              {loading ? "Connecting…" : ctx.label}
            </span>
            <span className={styles.liveMeta}>{meta}</span>
          </span>
        )}
      </a>

      <nav className={styles.nav} aria-label="Main">
        {NAV.map((n) => {
          const NavIcon = n.icon;
          const current = n.route === active;
          const count = n.route === "tasks" && taskCount ? taskCount : null;
          return (
            <a
              key={n.route}
              href={href(n.route)}
              onClick={go(n.route)}
              aria-current={current ? "page" : undefined}
              aria-label={collapsed ? (count ? `${n.label}, ${count}` : n.label) : undefined}
              className={styles.navItem}
            >
              <NavIcon size={20} aria-hidden="true" />
              {!collapsed && <span>{n.label}</span>}
              {!collapsed && count != null && <span className={styles.count}>{count}</span>}
              {collapsed && count != null && <span className={styles.railCount} aria-hidden="true" />}
              {collapsed && (
                <span className={styles.tip} aria-hidden="true">
                  {n.label}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      <div className={styles.foot}>
        {timer &&
          (collapsed ? (
            <a
              className={[styles.railTimer, isBreak(timer.phase) && styles.railBreak].filter(Boolean).join(" ")}
              href={href("focus")}
              onClick={go("focus")}
              aria-label={`${timer.phase === "focus_mode" ? "Focus mode" : isBreak(timer.phase) ? "Break" : "Focus"}, ${mmss(timer.remainingSeconds)} left${timerPaused ? ", paused" : ""}. Open timer`}
            >
              <svg viewBox="0 0 48 48" width="36" height="36" aria-hidden="true">
                <circle className={styles.railTrack} cx="24" cy="24" r="20" fill="none" strokeWidth="4" />
                <circle
                  className={styles.railArc}
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  strokeWidth="4"
                  pathLength={100}
                  strokeDasharray={`${(timer.totalSeconds ? (timer.remainingSeconds / timer.totalSeconds) * 100 : 0).toFixed(1)} 100`}
                  strokeLinecap="round"
                  transform="rotate(-90 24 24)"
                />
              </svg>
              <span className={styles.railTime} aria-hidden="true">
                {Math.ceil(timer.remainingSeconds / 60)}
              </span>
              <span className={styles.tip} aria-hidden="true">
                {mmss(timer.remainingSeconds)} left
              </span>
            </a>
          ) : (
            <MiniPlayer
              compact
              phase={timer.phase}
              remainingSeconds={timer.remainingSeconds}
              totalSeconds={timer.totalSeconds}
              paused={timerPaused}
              onToggle={onTimerToggle}
              onExpand={() => onNavigate("focus")}
            />
          ))}
        <div className={[styles.account, collapsed && styles.accountRail].filter(Boolean).join(" ")}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(email)}
          </span>
          {!collapsed && <span className={styles.email}>{email}</span>}
          <Button variant="ghost" size="sm" iconOnly icon={theme === "dark" ? Sun : Moon} aria-label={themeLabel} onClick={onToggleTheme} />
        </div>
      </div>
    </aside>
  );
}
