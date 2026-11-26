/* The live load chart: the last 5 minutes (150 readings) from the one live store.
   Segments take their context's colour, low-confidence stretches are dashed, and a
   soft fill in the current context sits under the line. It pauses with the socket. */
import { useMemo } from "react";
import { Activity, WifiOff } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import { hasData, shallowEqual, useLive } from "../../live/LiveState";
import { useSettings } from "../../live/SettingsState";
import { navigate } from "../../lib/router";
import { CTX } from "../../lib/domain";
import { clock, pct } from "../../lib/format";
import { clockSeconds, segmentSeries } from "../../lib/history";
import type { SeriesPoint } from "../../lib/history";
import type { CognitiveContext } from "../../types";
import { Button } from "../Button";
import { Card } from "../Card";
import { EmptyState } from "../EmptyState";
import { Skeleton } from "../Skeleton";
import { LiveStatus } from "../Shell/TopBar";
import { CHART_HEIGHT, ChartFrame, ChartTooltipCard, DataTable, axisProps, gridProps, thresholdProps, useChartColors } from "../ChartStyle";
import styles from "./CognitiveTimeline.module.css";

const WINDOW_S = 300;

interface Props {
  /** Chart height. Default "sm" (160px) on phones, "md" otherwise. */
  height?: "sm" | "md";
  titleId?: string;
}

export function CognitiveTimeline({ height = "md", titleId = "live-chart-title" }: Props) {
  const c = useChartColors();
  const { thresholds } = useSettings();
  const live = useLive((s) => ({ points: s.points, status: s.status, loading: s.loading, noData: !hasData(s.state), last: s.lastReadingAt }), shallowEqual);
  const { points, status, loading, noData } = live;

  const chart = useMemo(() => {
    if (!points.length) return null;
    const end = points[points.length - 1].t;
    const input = points.map((p) => ({ x: (p.t - end) / 1000, time: p.t / 1000, load: p.load, context: p.context, confidence: p.confidence }));
    return { ...segmentSeries(input, input.length - 1), current: points[points.length - 1].context };
  }, [points]);

  const paused = status === "reconnecting" || status === "offline";
  const meta = <LiveStatus />;

  if (loading) {
    return (
      <Card title="Live · last 5 min" titleId={titleId} meta={meta} aria-busy>
        <Skeleton shape="chart" height={CHART_HEIGHT[height]} />
      </Card>
    );
  }

  if (!chart || (noData && points.length < 2)) {
    // Not connected to the engine is not the same as no source sending.
    if (paused) {
      return (
        <Card title="Live · last 5 min" titleId={titleId} meta={meta}>
          <EmptyState
            compact
            tone="neutral"
            icon={status === "offline" ? WifiOff : Activity}
            title="Live load is paused"
            body={status === "offline" ? "The chart picks up when you are back online." : "The chart picks up as soon as CLR reconnects."}
          />
        </Card>
      );
    }
    return (
      <Card title="Live · last 5 min" titleId={titleId} meta={meta}>
        <EmptyState
          compact
          icon={Activity}
          title="Connect a source to see your load"
          body="CLR reads how you work, not what you work on."
          actions={
            <Button variant="secondary" size="sm" onClick={() => navigate("settings", "sources")}>
              Connect a source
            </Button>
          }
        />
      </Card>
    );
  }

  const loads = points.map((p) => p.load);
  const now = loads[loads.length - 1];
  const summary = `Load over the last 5 minutes. Now ${pct(now)}, ${CTX[chart.current].label.toLowerCase()}, between ${pct(Math.min(...loads))} and ${pct(Math.max(...loads))}.${paused ? " Paused while reconnecting." : ""}`;
  // Every 15th reading (30 s) for the table view, newest first.
  const sample = points.filter((_, i) => (points.length - 1 - i) % 15 === 0).reverse();

  return (
    <Card title="Live · last 5 min" titleId={titleId} meta={meta}>
      <ChartFrame
        ariaLabel={summary}
        height={height}
        table={
          <DataTable
            caption="Load over the last 5 minutes, every 30 seconds"
            rowKey={(p) => String(p.t)}
            rows={sample}
            columns={[
              { key: "t", label: "Time", strong: true, render: (p) => clockSeconds(p.t / 1000) },
              { key: "load", label: "Load", numeric: true, render: (p) => pct(p.load) },
              { key: "ctx", label: "Context", render: (p) => CTX[p.context].label },
            ]}
          />
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart.rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps(c)} />
            <XAxis
              dataKey="x"
              type="number"
              domain={[-WINDOW_S, 0]}
              ticks={[-WINDOW_S, 0]}
              tickFormatter={(v: number) => (v === 0 ? "now" : "−5 min")}
              {...axisProps(c)}
            />
            <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v: number) => pct(v)} width={40} {...axisProps(c)} />
            <ReferenceLine y={thresholds.high} {...thresholdProps(c, `High ${pct(thresholds.high)}`, true)} />
            <ReferenceLine y={thresholds.fatigue} {...thresholdProps(c, `Fatigue ${pct(thresholds.fatigue)}`)} />
            <Area dataKey="load" type="monotone" stroke="none" fill={c.ctxSoft[chart.current]} fillOpacity={1} isAnimationActive={false} activeDot={false} />
            {chart.keys.map((k) => (
              <Line
                key={k}
                dataKey={k}
                type="monotone"
                stroke={c.ctx[k.slice(2) as CognitiveContext]}
                strokeWidth={2}
                strokeDasharray={k[0] === "l" ? "2 4" : undefined}
                strokeLinecap="round"
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            <Tooltip cursor={{ stroke: c.inkSubtle, strokeWidth: 1 }} content={<LiveTip />} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
      {paused && live.last && <p className={styles.paused}>Paused. Showing readings up to {clock(live.last)}.</p>}
    </Card>
  );
}

function LiveTip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as SeriesPoint;
  return <ChartTooltipCard title={clockSeconds(p.time as number)} value={`${pct(p.load)} load`} context={p.context} />;
}
