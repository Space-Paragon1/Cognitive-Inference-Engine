/* Recent sessions: date and start, length, average load and the dominant context as
   a mini ring. On desktop a row selects the replay; on phones it opens the session. */
import { useState } from "react";
import { ChevronRight, History as HistoryIcon, RefreshCw } from "lucide-react";
import type { SessionSummary } from "../../types";
import { asContext, CTX } from "../../lib/domain";
import { clock, minutes, pct } from "../../lib/format";
import { dayLabel, isRunning } from "../../lib/history";
import { Button } from "../Button";
import { Card } from "../Card";
import { EmptyState } from "../EmptyState";
import { LoadGauge } from "../LoadGauge";
import { SkeletonRow } from "../Skeleton";
import styles from "./SessionList.module.css";

interface Props {
  sessions: SessionSummary[] | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  selected?: number | null;
  onSelect: (s: SessionSummary) => void;
  /** Phone rows open a page, so they get a chevron. */
  asLinks?: boolean;
  /** Rows shown before "Show all". */
  initial?: number;
  /** No card head (the phone list sits under the switch). */
  bare?: boolean;
}

export function SessionList({ sessions, loading, error, onRetry, selected, onSelect, asLinks = false, initial = 6, bare = false }: Props) {
  const [all, setAll] = useState(false);
  const title = bare ? undefined : "Sessions";
  const meta = bare ? undefined : "Last 14 days";

  if (loading && !sessions) {
    return (
      <Card title={title} meta={meta} titleId="sessions-title" className={bare ? styles.bare : undefined} aria-busy>
        <div className={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </Card>
    );
  }

  if (error && !sessions) {
    return (
      <Card title={title} meta={meta} titleId="sessions-title">
        <EmptyState
          compact
          tone="critical"
          icon={RefreshCw}
          title="Couldn't load your sessions"
          body="Your data is safe. Try again in a moment."
          actions={
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  }

  const list = sessions ?? [];
  if (!list.length) {
    return (
      <Card title={title} meta={meta} titleId="sessions-title">
        <EmptyState compact icon={HistoryIcon} title="No sessions yet" body="Sessions appear here after your first 10 minutes of tracked work." />
      </Card>
    );
  }

  const shown = all ? list : list.slice(0, initial);
  return (
    <Card title={title} meta={meta} titleId="sessions-title" className={bare ? styles.bare : undefined}>
      <ul className={styles.list} aria-labelledby={bare ? undefined : "sessions-title"} aria-label={bare ? "Sessions" : undefined}>
        {shown.map((s) => {
          const ctx = asContext(s.dominant_context);
          const running = isRunning(s);
          const current = selected === s.start_ts;
          return (
            <li key={s.start_ts}>
              <button type="button" className={styles.row} aria-current={current || undefined} onClick={() => onSelect(s)}>
                <span aria-hidden="true" className={styles.ring}>
                  <LoadGauge variant="mini" size={36} load={s.avg_load_score} context={ctx} confidence={1} showNumber={false} />
                </span>
                <span className={styles.text}>
                  <b>
                    {dayLabel(s.start_ts)} · {clock(s.start_ts * 1000)}
                  </b>
                  <small>
                    {minutes(s.duration_minutes)} · avg {pct(s.avg_load_score)} · {running ? "running" : `mostly ${CTX[ctx].label.toLowerCase()}`}
                  </small>
                </span>
                {asLinks && <ChevronRight size={18} aria-hidden="true" className={styles.chev} />}
              </button>
            </li>
          );
        })}
      </ul>
      {list.length > initial && (
        <button type="button" className={styles.more} aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer" : `Show all ${list.length} sessions`}
        </button>
      )}
    </Card>
  );
}
