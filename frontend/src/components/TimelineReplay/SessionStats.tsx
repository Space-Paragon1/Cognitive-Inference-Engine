/* Four numbers for the selected session: duration, events, average and peak load. */
import { Clock, Gauge, ListChecks, TrendingUp } from "lucide-react";
import type { SessionSummary } from "../../types";
import { clock, pctNum } from "../../lib/format";
import { WHILE } from "../../lib/history";
import type { ReplayTick } from "../../lib/history";
import { StatTile } from "../StatsCard/StatTile";
import styles from "./SessionStats.module.css";

interface Props {
  session: SessionSummary;
  ticks: ReplayTick[];
  events: number;
  /** Shorter labels and no icons, for phones. */
  compact?: boolean;
}

export function SessionStats({ session, ticks, events, compact = false }: Props) {
  let peak: ReplayTick | null = null;
  for (const k of ticks) if (!peak || k.load > peak.load) peak = k;
  const peakLoad = peak?.load ?? session.peak_load_score;
  const avg = ticks.length ? ticks.reduce((a, k) => a + k.load, 0) / ticks.length : session.avg_load_score;
  return (
    <div className={styles.kv}>
      <StatTile plain label="Duration" icon={compact ? undefined : Clock} value={String(Math.round(session.duration_minutes))} unit="min" />
      <StatTile plain label="Events" icon={compact ? undefined : ListChecks} value={String(events)} />
      <StatTile plain label={compact ? "Avg load" : "Average load"} icon={compact ? undefined : Gauge} value={String(pctNum(avg))} unit="%" />
      <StatTile
        plain
        label={compact ? "Peak" : "Peak load"}
        icon={compact ? undefined : TrendingUp}
        value={String(pctNum(peakLoad))}
        unit="%"
        sub={!compact && peak ? `at ${clock(peak.t * 1000)}, while ${WHILE[peak.context]}` : undefined}
      />
    </div>
  );
}
