/* Focus time per day: one bar per weekday, the best day in full accent with a direct
   label ("3.4 h best"), the rest at 55%. */
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import type { DayRow } from "../../lib/insights";
import { hours } from "../../lib/insights";
import { ChartFrame, ChartTooltipCard, DataTable, axisProps, gridProps, useChartColors } from "../ChartStyle";

interface Props {
  days: DayRow[];
  height?: "sm" | "md";
}

type Row = DayRow & { h: number };

export function DailyFocusChart({ days, height = "md" }: Props) {
  const c = useChartColors();
  const data: Row[] = days.map((d) => ({ ...d, h: d.focusMinutes / 60 }));
  const best = data.reduce<Row | null>((b, d) => (d.h > (b?.h ?? 0) ? d : b), null);
  const top = Math.max(4, Math.ceil(Math.max(...data.map((d) => d.h))));
  const ticks = Array.from({ length: top + 1 }, (_, i) => i).filter((v) => top <= 6 || v % 2 === 0);
  const total = data.reduce((a, d) => a + d.h, 0);
  const summary = best
    ? `Focus time per day this week, ${hours(total)} hours in all. Best day ${best.long}, ${hours(best.h)} hours.`
    : "Focus time per day this week. No focus time yet.";

  return (
    <ChartFrame
      ariaLabel={summary}
      height={height}
      table={
        <DataTable
          caption="Focus time per day this week"
          rowKey={(d) => d.date}
          rows={data}
          columns={[
            { key: "d", label: "Day", strong: true, render: (d) => d.long },
            { key: "h", label: "Focus", numeric: true, render: (d) => `${hours(d.h)} h` },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps(c)} />
          <XAxis dataKey="short" {...axisProps(c)} tick={<DayTick best={best?.short ?? null} fill={c.inkSubtle} ink={c.ink} />} interval={0} />
          <YAxis domain={[0, top]} ticks={ticks} tickFormatter={(v: number) => `${v}h`} width={34} {...axisProps(c)} />
          <Tooltip cursor={{ fill: c.grid, opacity: 0.4 }} content={<DayTip />} isAnimationActive={false} />
          <Bar dataKey="h" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.date} fill={c.accent} fillOpacity={best && d.short === best.short ? 1 : 0.55} />
            ))}
            <LabelList
              dataKey="h"
              position="top"
              content={(p) => {
                const { x, y, width, index } = p as { x: number; y: number; width: number; index: number };
                if (!best || data[index]?.short !== best.short) return null;
                return (
                  <text x={x + width / 2} y={y - 8} textAnchor="middle" fill={c.ink} fontSize={12} fontWeight={600}>
                    {hours(best.h)} h best
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function DayTick(props: { x?: number; y?: number; payload?: { value: string }; best: string | null; fill: string; ink: string }) {
  const { x = 0, y = 0, payload, best, fill, ink } = props;
  const isBest = payload?.value === best;
  return (
    <text x={x} y={y + 12} textAnchor="middle" fontSize={12} fill={isBest ? ink : fill} fontWeight={isBest ? 600 : 400}>
      {payload?.value}
    </text>
  );
}

function DayTip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Row;
  return <ChartTooltipCard title={d.long} value={`${hours(d.h)} h focus`} context={d.top ?? undefined} />;
}
