/* History: the live 5-minute chart, recent sessions, a replay of one session and its
   event log (handoff.md: Live chart 8 · Sessions 4 | Replay 12 | Event log 12).
   Phones split it into pages under Insights: list → #/history/<start> → …/log. */
import { useEffect, useId, useMemo } from "react";
import { ChevronRight, Download, ListChecks } from "lucide-react";
import type { SessionSummary } from "../../types";
import { useSettings } from "../../live/SettingsState";
import { useSessionList, useSessionTimeline } from "../../live/useHistory";
import { buildLog, isRunning, logCsv, saveCsv, sessionRange } from "../../lib/history";
import { navigate } from "../../lib/router";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { CognitiveTimeline } from "../../components/CognitiveTimeline";
import { Skeleton } from "../../components/Skeleton";
import { CHART_HEIGHT } from "../../components/ChartStyle";
import { Cell, ConnectionBanner, Grid, LiveStatus, Page, useShell } from "../../components/Shell";
import {
  EventLog,
  NoSessions,
  PlaybackControls,
  REPLAY_KEYS,
  ReplayChart,
  ReplayError,
  SessionList,
  SessionStats,
  TimelineReplay,
  handlePlaybackKey,
  rememberReplayTime,
  useReplay,
} from "../../components/TimelineReplay";
import { InsightsSwitch } from "./InsightsSwitch";
import styles from "./HistoryScreen.module.css";

const OFFLINE = "Sessions you have opened still replay. Live load is paused.";

function fileName(s: SessionSummary) {
  const d = new Date(s.start_ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `clr-session-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.csv`;
}

export function HistoryScreen({ sub }: { sub: string | null }) {
  const { layout } = useShell();
  const mobile = layout === "mobile";
  const { thresholds } = useSettings();
  const list = useSessionList();
  const sessions = list.sessions ?? [];

  const [part, page] = (sub ?? "").split("/");
  const wanted = Number(part) || null;
  const found = wanted != null ? sessions.find((s) => s.start_ts === wanted) ?? null : null;
  // Default replay: the latest finished session, else the running one.
  const fallback = sessions.find((s) => !isRunning(s)) ?? sessions[0] ?? null;
  const selected = found ?? (mobile ? null : fallback);
  const running = selected ? isRunning(selected) : false;

  // A phone link to a session that no longer exists goes back to the list.
  useEffect(() => {
    if (mobile && wanted != null && list.sessions && !found) navigate("history", null, { replace: true });
  }, [mobile, wanted, list.sessions, found]);

  const timeline = useSessionTimeline(selected, running);
  const replay = useReplay(timeline.ticks, selected?.start_ts ?? null);
  const rows = useMemo(() => buildLog(timeline.entries, timeline.ticks, thresholds, running), [timeline.entries, timeline.ticks, thresholds, running]);
  const exportCsv = () => selected && saveCsv(fileName(selected), logCsv(rows));
  const select = (s: SessionSummary) => navigate("history", String(s.start_ts), { replace: !mobile });
  const banner = <ConnectionBanner offlineBody={OFFLINE} />;
  const hintId = useId();

  if (mobile) {
    if (!selected) {
      return (
        <Page title="Insights" banner={banner}>
          <div className={styles.stack}>
            <InsightsSwitch value="history" />
            <CognitiveTimeline height="sm" />
            <SessionList bare asLinks initial={8} sessions={list.sessions} loading={list.loading} error={list.error} onRetry={list.retry} onSelect={select} />
          </div>
        </Page>
      );
    }

    if (page === "log") {
      return (
        <Page title="Event log" banner={banner}>
          {timeline.error ? (
            <ReplayError title="Event log" onRetry={timeline.retry} />
          ) : (
            <EventLog
              variant="list"
              rows={rows}
              loading={timeline.loading}
              currentT={null}
              playing={false}
              fileName={fileName(selected)}
              onSeek={(t) => {
                rememberReplayTime(selected.start_ts, t);
                navigate("history", String(selected.start_ts));
              }}
            />
          )}
        </Page>
      );
    }

    return (
      <Page
        title="Session"
        banner={banner}
        mobileRight={<Button variant="ghost" iconOnly icon={Download} aria-label="Export CSV" disabled={!rows.length} onClick={exportCsv} />}
      >
        <div className={styles.stack}>
          {timeline.error ? (
            <ReplayError title="Session" onRetry={timeline.retry} />
          ) : (
            <>
              <Card className={styles.replayCard} aria-busy={timeline.loading || undefined}>
                <span className={styles.caption}>{sessionRange(selected)}</span>
                {timeline.loading ? (
                  <Skeleton shape="chart" height={CHART_HEIGHT.sm} />
                ) : timeline.ticks.length > 1 ? (
                  <div className={styles.replayBody} onKeyDown={(e) => handlePlaybackKey(e, replay.controls)}>
                    <span id={hintId} className="sr-only">
                      {REPLAY_KEYS}
                    </span>
                    <div role="group" aria-label="Replay chart" aria-describedby={hintId}>
                      <ReplayChart ticks={timeline.ticks} index={replay.index} thresholds={thresholds} onSeekTime={replay.seekTime} height="sm" xTicks={3} />
                    </div>
                    <PlaybackControls {...replay.controls} />
                  </div>
                ) : (
                  <p className={styles.thin}>CLR kept too few readings from this session to draw a timeline.</p>
                )}
              </Card>
              <Card>{timeline.loading ? <Skeleton shape="tile" /> : <SessionStats compact session={selected} ticks={timeline.ticks} events={rows.length} />}</Card>
              <Card className={styles.linkCard}>
                <button type="button" className={styles.linkRow} onClick={() => navigate("history", `${selected.start_ts}/log`)}>
                  <ListChecks size={20} aria-hidden="true" />
                  <span>
                    <b>Event log</b>
                    <small>{timeline.loading ? "Loading…" : `${rows.length} event${rows.length === 1 ? "" : "s"}`}</small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" className={styles.chev} />
                </button>
              </Card>
            </>
          )}
        </div>
      </Page>
    );
  }

  let replayCell;
  if (list.loading && !list.sessions) {
    replayCell = (
      <Card title="Timeline replay" titleId="replay-title" aria-busy>
        <Skeleton shape="chart" height={CHART_HEIGHT.md} />
      </Card>
    );
  } else if (list.error && !list.sessions) {
    replayCell = <ReplayError onRetry={list.retry} />;
  } else if (!selected) {
    replayCell = <NoSessions />;
  } else {
    replayCell = (
      <TimelineReplay
        sessions={sessions}
        session={selected}
        onSelect={select}
        ticks={timeline.ticks}
        loading={timeline.loading}
        error={timeline.error}
        onRetry={timeline.retry}
        replay={replay}
        events={rows.length}
        thresholds={thresholds}
      />
    );
  }

  return (
    <Page title="History" sub="Replay a session, or scan the event log" banner={banner} actions={<LiveStatus />}>
      <Grid>
        <Cell span={8}>
          <CognitiveTimeline />
        </Cell>
        <Cell span={4} tablet={8}>
          <SessionList
            sessions={list.sessions}
            loading={list.loading}
            error={list.error}
            onRetry={list.retry}
            selected={selected?.start_ts ?? null}
            onSelect={select}
          />
        </Cell>
        <Cell span={12}>{replayCell}</Cell>
        {selected && !timeline.error && (
          <Cell span={12}>
            <EventLog
              rows={rows}
              loading={timeline.loading}
              currentT={replay.tick?.t ?? null}
              playing={replay.controls.playing}
              onSeek={replay.seekTime}
              fileName={fileName(selected)}
            />
          </Cell>
        )}
      </Grid>
    </Page>
  );
}
