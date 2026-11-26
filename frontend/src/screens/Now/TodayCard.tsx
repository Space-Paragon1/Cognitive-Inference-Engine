import { CircleAlert, Gauge, History, RefreshCw, Timer } from "lucide-react";
import { useToday } from "../../live/useToday";
import { clock, minutes, pctNum } from "../../lib/format";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { Skeleton, SkeletonRegion } from "../../components/Skeleton";
import { ContextBar, StatTile } from "../../components/StatsCard/StatTile";
import styles from "./TodayCard.module.css";

/** Today at a glance: focus time, average load, sessions and the context mix. */
export function TodayCard() {
  const { today, loading, error, retry } = useToday();
  const meta = today?.since ? `Since ${clock(today.since)}` : undefined;
  const none = today != null && today.sessions === 0;

  return (
    <Card title="Today at a glance" titleId="today-title" meta={meta}>
      {error && !today ? (
        <EmptyState
          compact
          level={3}
          icon={CircleAlert}
          tone="critical"
          title="Couldn't load today"
          body="Your data is safe. Try again in a moment."
          actions={
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={retry}>
              Try again
            </Button>
          }
        />
      ) : (
        <SkeletonRegion
          loading={loading}
          label="Loading today"
          fallback={
            <div className={styles.tiles}>
              <Skeleton shape="tile" height={64} />
              <Skeleton shape="tile" height={64} />
              <Skeleton shape="tile" height={64} />
            </div>
          }
        >
          <div className={styles.tiles}>
            <StatTile plain label="Focus" icon={Timer} value={today && !none ? minutes(today.focusMinutes) : "–"} />
            <StatTile plain label="Avg load" icon={Gauge} value={today?.avgLoad != null && !none ? String(pctNum(today.avgLoad)) : "–"} unit={today?.avgLoad != null && !none ? "%" : undefined} />
            <StatTile plain label="Sessions" icon={History} value={today && !none ? String(today.sessions) : "–"} />
          </div>
          {none ? (
            <p className={styles.none}>No sessions yet today. They show up here as you work.</p>
          ) : (
            <ContextBar distribution={today?.distribution ?? {}} legend />
          )}
        </SkeletonRegion>
      )}
    </Card>
  );
}
