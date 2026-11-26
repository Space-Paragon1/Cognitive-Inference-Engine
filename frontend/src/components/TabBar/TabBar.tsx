import { ChartColumn, Gauge, ListChecks, Menu, Timer } from "lucide-react";
import type { MouseEvent } from "react";
import type { Icon, Route, TabBarProps } from "../../types/ui";
import { href } from "../../lib/router";
import styles from "./TabBar.module.css";

const TABS: { route: TabBarProps["active"]; label: string; icon: Icon }[] = [
  { route: "now", label: "Now", icon: Gauge },
  { route: "focus", label: "Focus", icon: Timer },
  { route: "tasks", label: "Tasks", icon: ListChecks },
  { route: "insights", label: "Insights", icon: ChartColumn },
  { route: "more", label: "More", icon: Menu },
];

/** Mobile bottom navigation: five tabs, 64px plus the gesture-bar inset. */
export function TabBar({ active, onNavigate }: TabBarProps) {
  const go = (route: Route) => (e: MouseEvent) => {
    e.preventDefault();
    onNavigate(route);
  };
  return (
    <nav className={styles.tabbar} aria-label="Main">
      {TABS.map((t) => {
        const TabIcon = t.icon;
        return (
          <a key={t.route} href={href(t.route)} onClick={go(t.route)} aria-current={t.route === active ? "page" : undefined} className={styles.tab}>
            <span className={styles.pill} aria-hidden="true">
              <TabIcon size={22} />
            </span>
            {t.label}
          </a>
        );
      })}
    </nav>
  );
}
