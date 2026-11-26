/* Context mix per day: 100% stacked bars in the fixed context order, 2px surface gaps
   between segments, and a legend that names every context. */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import type { CognitiveContext } from "../../types";
import { CTX, CTX_ORDER } from "../../lib/domain";
import { pct } from "../../lib/format";
import type { DayRow } from "../../lib/insights";
import { ChartFrame, ChartTooltipCard, ContextLegend, DataTable, axisProps, gridProps, useChartColors } from "../ChartStyle";

interface Props {
  days: DayRow[];
  height?: "sm" | "md";
}

interface Row {
  short: string;
  day: DayRow;
  share: Partial<Record<CognitiveContext, number>>;
  [key: string]: unknown;
}

export function ContextMixChart({ days, height = "md" }: Props) {
  const c = useChartColors();
  const present = CTX_ORDER.filter((k) => days.some((d) => (d.distribution[k] ?? 0) > 0.005));
  const data: Row[] = days.map((d) => {
    const total = present.reduce((a, k) => a + (d.distribution[k] ?? 0), 0);
    const share: Partial<Record<CognitiveContext, number>> = {};
    present.forEach((k) => (share[k] = total ? (d.distribution[k] ?? 0) / total : 0));
    return { short: d.short, day: d, share, ...share };
  });
  const minutes = days.reduce((a, d) => a + d.trackedMinutes, 0);
  const week = (k: CognitiveContext) => (minutes ? days.reduce((a, d) => a + (d.distribution[k] ?? 0) * d.trackedMinutes, 0) / minutes : 0);
  const summary = present.length
    ? `Context mix per day this week. Across the week: ${present.map((k) => `${CTX[k].label} ${pct(week(k))}`).join(", ")}.`
    : "Context mix per day this week. Nothing tracked yet.";

  return (
    <ChartFrame
      ariaLabel={summary}
      height={height}
      legend={<ContextLegend contexts={present} />}
      table={
        <DataTable
          caption="Share of tracked time in each context, per day"
          rowKey={(r) => r.day.date}
          rows={data}
          columns={[
            { key: "d", label: "Day", strong: true, render: (r: Row) => r.day.short },
            ...present.map((k) => ({ key: k, label: CTX[k].label, numeric: true, render: (r: Row) => (r.day.sessions ? pct(r.share[k] ?? 0) : "–") })),
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps(c)} />
          <XAxis dataKey="short" interval={0} {...axisProps(c)} />
          <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v: number) => pct(v)} width={40} {...axisProps(c)} />
          <Tooltip cursor={{ fill: c.grid, opacity: 0.4 }} content={<MixTip present={present} />} isAnimationActive={false} />
          {present.map((k) => (
            <Bar key={k} dataKey={k} stackId="mix" fill={c.ctx[k]} stroke={c.surface} strokeWidth={2} maxBarSize={28} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function MixTip({ active, payload, present }: TooltipProps<number, string> & { present: CognitiveContext[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Row;
  if (!row.day.sessions || !present.length) return <ChartTooltipCard title={row.day.long} value="Nothing tracked" />;
  const top = present.reduce((b, k) => ((row.share[k] ?? 0) > (row.share[b] ?? 0) ? k : b), present[0]);
  return <ChartTooltipCard title={row.day.long} value={`${pct(row.share[top] ?? 0)} ${CTX[top].label.toLowerCase()}`} context={top} />;
}
