import { CircleAlert, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { getSessions } from "../../api/client";
import { startOfToday } from "../../live/useToday";
import { asContext } from "../../lib/domain";
import { clock, minutes } from "../../lib/format";
import type { SessionSummary } from "../../types";
import { Button } from "../Button";
import { Card } from "../Card";
import { ContextPill } from "../ContextPill";
import { EmptyState } from "../EmptyState";
import { SkeletonLines, SkeletonRegion } from "../Skeleton";
import styles from "./TodaySessions.module.css";

/** Today's sessions table under the timers. */
export function TodaySessions() {
  const [rows, setRows] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState(false);
  const load = () =>
    getSessions({ since: Math.floor(startOfToday() / 1000) })
      .then((s) => {
        setRows(s);
        setError(false);
      })
      .catch(() => setError(true));
  useEffect(() => {
    load();
    const t = window.setInterval(load, 60000);
    return () => window.clearInterval(t);
  }, []);

  const total = (rows ?? []).reduce((a, s) => a + s.duration_minutes, 0);
  return (
    <Card title="Today’s sessions" titleId="sessions-title" meta={rows?.length ? <span className={styles.num}>{rows.length} · {minutes(total)}</span> : undefined}>
      {error && !rows ? (
        <EmptyState
          compact
          icon={CircleAlert}
          tone="critical"
          title="Couldn't load today's sessions"
          body="Your data is safe. Try again in a moment."
          actions={
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load}>
              Try again
            </Button>
          }
        />
      ) : (
        <SkeletonRegion loading={rows == null} label="Loading sessions" fallback={<SkeletonLines count={3} height={18} />}>
          {rows && rows.length === 0 ? (
            <p className={styles.none}>No sessions yet today. Start a Pomodoro or focus mode and it shows up here.</p>
          ) : (
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Started</th>
                    <th scope="col" className={styles.right}>
                      Length
                    </th>
                    <th scope="col" className={styles.right}>
                      Avg load
                    </th>
                    <th scope="col">Mostly</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? [])
                    .slice()
                    .reverse()
                    .map((s) => (
                      <tr key={s.session_index}>
                        <td className={styles.strong}>{clock(s.start_ts * 1000)}</td>
                        <td className={styles.right}>{minutes(s.duration_minutes)}</td>
                        <td className={styles.right}>{Math.round(s.avg_load_score * 100)}%</td>
                        <td>
                          <ContextPill context={asContext(s.dominant_context)} size="sm" />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </SkeletonRegion>
      )}
    </Card>
  );
}
