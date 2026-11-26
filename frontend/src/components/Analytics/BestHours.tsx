/* "Your best hours": focus by weekday and hour from --heat-0 to --heat-4, with the
   peak cell ringed and a Less → More scale. Marked Preview: the grid is estimated
   from sessions until the engine sends hourly data. */
import { useState } from "react";
import { DAY_SHORT, hourLabel, hourRange } from "../../lib/insights";
import type { HeatGrid } from "../../lib/insights";
import { Badge } from "../Badge";
import { Card } from "../Card";
import { DataTable } from "../ChartStyle";
import styles from "./BestHours.module.css";

const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function short(h: number) {
  return `${h % 12 || 12}${h % 24 >= 12 ? "p" : "a"}`;
}

export function BestHours({ grid, compact = false }: { grid: HeatGrid; compact?: boolean }) {
  const [asTable, setAsTable] = useState(false);
  const [from, to] = hourRange(grid, compact ? 8 : 7, 23);
  const hrs = Array.from({ length: to - from }, (_, i) => from + i);
  const peak = grid.peak;
  const summary = peak
    ? `Focus by day and hour, estimated from your sessions. Most focus on ${DAY_LONG[peak.day]} around ${hourLabel(peak.hour)}.`
    : "Focus by day and hour. No focus time tracked this week.";
  const rows = DAY_SHORT.map((d, i) => {
    const row = grid.minutes[i];
    const best = row.reduce((b, v, h) => (v > row[b] ? h : b), 0);
    return { day: DAY_LONG[i], key: d, best: row[best] > 0.5 ? hourLabel(best) : "–", minutes: Math.round(row.reduce((a, v) => a + v, 0)) };
  });

  return (
    <Card title="Your best hours" titleId="best-hours-title" meta={<Badge>Preview</Badge>}>
      {asTable ? (
        <DataTable
          caption="Focus by day, estimated from your sessions"
          rowKey={(r) => r.key}
          rows={rows}
          columns={[
            { key: "d", label: "Day", strong: true, render: (r) => r.day },
            { key: "b", label: "Best hour", render: (r) => r.best },
            { key: "m", label: "Focus", numeric: true, render: (r) => `${r.minutes} min` },
          ]}
        />
      ) : (
        <div role="img" aria-label={summary}>
          <div className={styles.heat} style={{ gridTemplateColumns: `32px repeat(${hrs.length}, minmax(0, 1fr))` }}>
            <span />
            {hrs.map((h, i) => (
              <span key={h} className={styles.hour}>
                {i % 3 === 0 ? short(h) : ""}
              </span>
            ))}
            {DAY_SHORT.map((d, di) => (
              <Row key={d} label={d} levels={hrs.map((h) => grid.level[di][h])} peakAt={peak && peak.day === di ? hrs.indexOf(peak.hour) : -1} />
            ))}
          </div>
        </div>
      )}
      <div className={styles.foot}>
        {!asTable && (
          <span className={styles.scale} aria-hidden="true">
            Less
            {[0, 1, 2, 3, 4].map((l) => (
              <i key={l} className={styles[`l${l}`]} />
            ))}
            More focus
          </span>
        )}
        <button type="button" className={styles.link} aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? "View as chart" : "View as table"}
        </button>
      </div>
      <p className={styles.note}>Estimated from your sessions.</p>
    </Card>
  );
}

function Row({ label, levels, peakAt }: { label: string; levels: number[]; peakAt: number }) {
  return (
    <>
      <span className={styles.day}>{label}</span>
      {levels.map((l, i) => (
        <span key={i} className={[styles.cell, styles[`l${l}`], i === peakAt && styles.peak].filter(Boolean).join(" ")} />
      ))}
    </>
  );
}
