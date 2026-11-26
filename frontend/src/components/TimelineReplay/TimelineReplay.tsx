/* Timeline replay of one past session: the context-coloured chart with its playhead,
   the transport, and the session's numbers. The screen owns the replay state so the
   event log below can follow the playhead. */
import { useId } from "react";
import { History as HistoryIcon } from "lucide-react";
import type { SessionSummary } from "../../types";
import { asContext, CTX } from "../../lib/domain";
import type { ReplayTick } from "../../lib/history";
import { Card } from "../Card";
import { ContextPill } from "../ContextPill";
import { EmptyState } from "../EmptyState";
import { Skeleton } from "../Skeleton";
import { CHART_HEIGHT } from "../ChartStyle";
import { PlaybackControls, handlePlaybackKey } from "./PlaybackControls";
import { ReplayChart } from "./ReplayChart";
import { SessionPicker } from "./SessionPicker";
import { SessionStats } from "./SessionStats";
import type { Replay } from "./useReplay";
import styles from "./TimelineReplay.module.css";
import { LoadError } from "../LoadError";

interface Props {
  sessions: SessionSummary[];
  session: SessionSummary | null;
  onSelect: (s: SessionSummary) => void;
  ticks: ReplayTick[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  replay: Replay;
  /** Rows in the event log, for the Events number. */
  events: number;
  thresholds: { high: number; fatigue: number };
}

export function ReplayError({ onRetry, title = "Timeline replay" }: { onRetry: () => void; title?: string }) {
  return (
    <Card title={title} titleId="replay-title">
      <LoadError
        title="Something went wrong on our side"
        body="Your data is safe. We could not load your history just now."
        offlineWhat="This session loads"
        onRetry={onRetry}
      />
    </Card>
  );
}

export function NoSessions({ title = "Timeline replay" }: { title?: string }) {
  return (
    <Card title={title} titleId="replay-title">
      <EmptyState icon={HistoryIcon} title="No sessions to replay" body="Sessions appear here after your first 10 minutes of tracked work." />
    </Card>
  );
}

/** Keyboard hint read with the chart: the shortcuts from handoff.md. */
export const REPLAY_KEYS = "Space plays or pauses. Left and right arrows step 2 seconds. Home and End jump to the start and end. 1, 2, 5 and 0 set the speed.";

export function TimelineReplay({ sessions, session, onSelect, ticks, loading, error, onRetry, replay, events, thresholds }: Props) {
  const hintId = useId();

  if (!session) return <NoSessions />;
  if (error) return <ReplayError onRetry={onRetry} />;

  const ctx = asContext(session.dominant_context);
  const empty = !loading && ticks.length < 2;

  return (
    <Card title="Timeline replay" titleId="replay-title" meta={<SessionPicker sessions={sessions} value={session.start_ts} onChange={onSelect} />} aria-busy={loading || undefined}>
      <div className={styles.body} onKeyDown={(e) => handlePlaybackKey(e, replay.controls)}>
        <div className={styles.main}>
          {loading ? (
            <>
              <Skeleton shape="chart" height={CHART_HEIGHT.md} />
              <Skeleton height={88} radius="md" />
            </>
          ) : empty ? (
            <EmptyState compact icon={HistoryIcon} title="Nothing to replay in this session" body="CLR kept too few readings from it to draw a timeline." />
          ) : (
            <>
              <div className={styles.chart} tabIndex={0} role="group" aria-label="Replay chart" aria-describedby={hintId}>
                <ReplayChart ticks={ticks} index={replay.index} thresholds={thresholds} onSeekTime={replay.seekTime} />
              </div>
              <span id={hintId} className="sr-only">
                {REPLAY_KEYS}
              </span>
              <PlaybackControls {...replay.controls} />
            </>
          )}
        </div>
        <aside className={styles.side} aria-label="This session">
          <div className={styles.sideHead}>
            <h3 className={styles.sideTitle}>This session</h3>
            <ContextPill context={ctx} size="sm" label={`Mostly ${CTX[ctx].label.toLowerCase()}`} />
          </div>
          {loading ? <Skeleton shape="tile" /> : <SessionStats session={session} ticks={ticks} events={events} />}
        </aside>
      </div>
    </Card>
  );
}
