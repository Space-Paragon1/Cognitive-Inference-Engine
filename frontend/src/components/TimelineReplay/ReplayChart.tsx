/* The replay chart: the session's load in context-coloured segments, solid up to the
   playhead and dashed at 50% after it, with a 2px ink playhead, a dot on the curve
   and a tooltip card for the tick under it. Click anywhere to seek. */
import { useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import type { CognitiveContext } from "../../types";
import { CTX } from "../../lib/domain";
import { pct } from "../../lib/format";
import { clockSeconds, clockShort, contextsIn, downsample, segmentSeries, tickAt } from "../../lib/history";
import type { ReplayTick, SeriesPoint } from "../../lib/history";
import { ChartFrame, ChartTooltipCard, ContextLegend, DataTable, axisProps, gridProps, thresholdProps, useChartColors } from "../ChartStyle";
import styles from "./ReplayChart.module.css";

const Y_WIDTH = 40;
const RIGHT = 8;

interface Props {
  ticks: ReplayTick[];
  index: number;
  thresholds: { high: number; fatigue: number };
  onSeekTime: (t: number) => void;
  height?: "sm" | "md" | "lg";
  /** Number of clock labels along the x-axis. */
  xTicks?: number;
}

export function ReplayChart({ ticks, index, thresholds, onSeekTime, height = "md", xTicks = 5 }: Props) {
  const c = useChartColors();
  const [hover, setHover] = useState(false);
  const start = ticks[0]?.t ?? 0;
  const end = ticks[ticks.length - 1]?.t ?? 0;
  const span = Math.max(1, end - start);
  const drawn = useMemo(() => downsample(ticks), [ticks]);
  const tick = ticks[index];
  const split = tick ? tickAt(drawn, tick.t) : 0;
  const { rows, keys } = useMemo(
    () => segmentSeries(drawn.map((k) => ({ x: k.t - start, time: k.t, load: k.load, context: k.context, confidence: k.confidence })), split),
    [drawn, start, split]
  );
  const contexts = useMemo(() => contextsIn(ticks), [ticks]);
  const minutes = useMemo(() => perMinute(ticks), [ticks]);

  if (!tick) return null;
  const x = tick.t - start;
  const frac = x / span;
  const dotY = drawn[split]?.load ?? tick.load;
  const axis = Array.from({ length: xTicks }, (_, i) => Math.round((span * i) / (xTicks - 1)));
  const lows = ticks.filter((k) => k.confidence < 0.5).length;
  const loads = ticks.map((k) => k.load);
  const summary = `Load from ${clockSeconds(start)} to ${clockSeconds(end)}, between ${pct(Math.min(...loads))} and ${pct(Math.max(...loads))}. Playhead at ${clockSeconds(tick.t)}: ${pct(tick.load)}, ${CTX[tick.context].label.toLowerCase()}.${lows ? " Dashed stretches are low-confidence estimates." : ""}`;

  return (
    <ChartFrame
      ariaLabel={summary}
      height={height}
      legend={<ContextLegend contexts={contexts} />}
      table={
        <DataTable
          caption="Average load per minute in this session"
          rowKey={(r) => String(r.t)}
          rows={minutes}
          columns={[
            { key: "t", label: "Minute", strong: true, render: (r) => clockShort(r.t) },
            { key: "load", label: "Avg load", numeric: true, render: (r) => pct(r.load) },
            { key: "ctx", label: "Mostly", render: (r) => CTX[r.context].label },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 8, right: RIGHT, bottom: 0, left: 0 }}
          onMouseMove={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={(s) => {
            if (s?.activeLabel != null) onSeekTime(start + Number(s.activeLabel));
          }}
        >
          <CartesianGrid {...gridProps(c)} />
          <XAxis dataKey="x" type="number" domain={[0, span]} ticks={axis} tickFormatter={(v: number) => clockShort(start + v)} {...axisProps(c)} />
          <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v: number) => pct(v)} width={Y_WIDTH} {...axisProps(c)} />
          <ReferenceLine y={thresholds.high} {...thresholdProps(c, `High ${pct(thresholds.high)}`, true)} />
          <ReferenceLine y={thresholds.fatigue} {...thresholdProps(c, `Fatigue ${pct(thresholds.fatigue)}`)} />
          {keys.map((k) => (
            <Line
              key={k}
              dataKey={k}
              type="monotone"
              stroke={c.ctx[k.slice(2) as CognitiveContext]}
              strokeWidth={2}
              strokeOpacity={k[0] === "u" ? 0.5 : 1}
              strokeDasharray={k[0] === "u" ? "4 4" : k[0] === "l" ? "2 4" : undefined}
              strokeLinecap="round"
              dot={false}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
          <ReferenceLine x={x} stroke={c.ink} strokeWidth={2} ifOverflow="hidden" />
          <ReferenceDot x={x} y={dotY} r={5} fill={c.ink} stroke={c.surface} strokeWidth={2} isFront />
          <Tooltip cursor={{ stroke: c.inkSubtle, strokeWidth: 1 }} content={<ReplayTip />} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      {!hover && (
        <div
          className={styles.playheadTip}
          data-edge={frac < 0.15 ? "start" : frac > 0.85 ? "end" : undefined}
          style={{ left: `calc(${Y_WIDTH}px + (100% - ${Y_WIDTH + RIGHT}px) * ${frac.toFixed(4)})` }}
          aria-hidden="true"
        >
          <ChartTooltipCard title={clockSeconds(tick.t)} value={`${pct(tick.load)} load`} context={tick.context} />
        </div>
      )}
    </ChartFrame>
  );
}

function ReplayTip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as SeriesPoint;
  return <ChartTooltipCard title={clockSeconds(p.time as number)} value={`${pct(p.load)} load`} context={p.context} />;
}

/** Average load and most common context per minute, for the table view. */
function perMinute(ticks: ReplayTick[]) {
  const out: { t: number; load: number; context: CognitiveContext }[] = [];
  let bucket: ReplayTick[] = [];
  const flush = () => {
    if (!bucket.length) return;
    const counts = new Map<CognitiveContext, number>();
    bucket.forEach((k) => counts.set(k.context, (counts.get(k.context) ?? 0) + 1));
    out.push({ t: bucket[0].t, load: bucket.reduce((a, k) => a + k.load, 0) / bucket.length, context: [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] });
    bucket = [];
  };
  for (const k of ticks) {
    if (bucket.length && Math.floor(k.t / 60) !== Math.floor(bucket[0].t / 60)) flush();
    bucket.push(k);
  }
  flush();
  return out;
}
