import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDailyStats } from "../../api/client";
import type { DailyStats } from "../../types";
import css from "./Analytics.module.css";

// ── Constants ─────────────────────────────────────────────────────────────────

const CTX_COLOR: Record<string, string> = {
  deep_focus:   "#4af0a0",
  shallow_work: "#f0c040",
  stuck:        "#f05a4a",
  fatigue:      "#b066cc",
  recovering:   "#4ab0f0",
  unknown:      "#333",
};

const CTX_ORDER = [
  "deep_focus", "shallow_work", "recovering", "fatigue", "stuck", "unknown",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMin(min: number): string {
  if (min < 1) return "—";
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function loadColor(score: number): string {
  return score > 0.7 ? "#f05a4a" : score > 0.45 ? "#f0c040" : "#4af0a0";
}

function bestFocusDay(stats: DailyStats[]): DailyStats | null {
  if (!stats.length) return null;
  return stats.reduce((best, d) => d.focus_minutes > best.focus_minutes ? d : best, stats[0]);
}

// ── Custom tooltips ───────────────────────────────────────────────────────────

function FocusTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className={css.tooltip}>
      <div className={css.tooltipLabel}>{label}</div>
      <div className={css.tooltipValue}>Focus: {fmtMin(payload[0].value)}</div>
    </div>
  );
}

function CtxTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const relevant = payload.filter((p) => p.value > 0);
  return (
    <div className={css.tooltip}>
      <div className={css.tooltipLabel}>{label}</div>
      {relevant.map((p) => (
        <div key={p.name} className={css.tooltipRow}>
          <span className={css.tooltipDot} style={{ background: p.fill }} />
          <span>{p.name.replace(/_/g, " ")}: {pct(p.value / 100)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryTile({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className={css.tile}>
      <div className={css.tileLabel}>{label}</div>
      <div className={css.tileValue} style={{ color: color ?? "#fff" }}>{value}</div>
      {sub && <div className={css.tileSub}>{sub}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AnalyticsPanelProps {
  onClose: () => void;
}

export function AnalyticsPanel({ onClose }: AnalyticsPanelProps) {
  const [weekStats, setWeekStats] = useState<DailyStats[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const midnightUtc = new Date();
    midnightUtc.setUTCHours(0, 0, 0, 0);
    const since = midnightUtc.getTime() / 1000 - 6 * 86_400;

    getDailyStats({ since })
      .then(setWeekStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const focusData = weekStats.map((d) => ({
    day: shortDay(d.date),
    focus: Math.round(d.focus_minutes),
    load: d.avg_load_score,
  }));

  const ctxData = weekStats.map((d) => {
    const row: Record<string, number | string> = { day: shortDay(d.date) };
    for (const ctx of CTX_ORDER) {
      row[ctx] = Math.round((d.context_distribution[ctx] ?? 0) * 100);
    }
    return row;
  });

  const totalFocus = weekStats.reduce((s, d) => s + d.focus_minutes, 0);
  const best       = bestFocusDay(weekStats);
  const avgLoad    = weekStats.length
    ? weekStats.reduce((s, d) => s + d.avg_load_score, 0) / weekStats.length
    : 0;
  const avgEff     = weekStats.length
    ? weekStats
        .filter((d) => d.total_session_minutes > 0)
        .reduce((s, d) => s + d.focus_minutes / d.total_session_minutes, 0) /
      (weekStats.filter((d) => d.total_session_minutes > 0).length || 1)
    : 0;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className={css.backdrop} onClick={onClose} />
      <div className={css.drawer}>

        <div className={css.header}>
          <span className={css.title}>Weekly Analytics</span>
          <button type="button" className={css.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={css.body}>
          {loading ? (
            <div className={css.empty}>Loading…</div>
          ) : weekStats.length === 0 ? (
            <div className={css.empty}>No data yet this week</div>
          ) : (
            <>
              {/* Summary tiles */}
              <div className={css.tilesRow}>
                <SummaryTile
                  label="Total focus"
                  value={fmtMin(totalFocus)}
                  sub="last 7 days"
                  color="#4af0a0"
                />
                <SummaryTile
                  label="Best focus day"
                  value={best ? shortDay(best.date) : "—"}
                  sub={best ? fmtMin(best.focus_minutes) : undefined}
                  color="#4ab0f0"
                />
                <SummaryTile
                  label="Avg load"
                  value={pct(avgLoad)}
                  color={loadColor(avgLoad)}
                />
                <SummaryTile
                  label="Focus efficiency"
                  value={avgEff > 0 ? pct(avgEff) : "—"}
                  sub="focus / session time"
                />
              </div>

              {/* Focus minutes per day */}
              <div className={css.section}>
                <div className={css.sectionTitle}>Daily focus time</div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={focusData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barSize={22}>
                    <CartesianGrid vertical={false} stroke="#1a1a30" />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "#555", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#555", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => v === 0 ? "0" : `${v}m`}
                    />
                    <Tooltip content={<FocusTooltip />} cursor={{ fill: "#1a1a30" }} />
                    <Bar dataKey="focus" radius={[4, 4, 0, 0]}>
                      {focusData.map((entry, i) => (
                        <Cell key={i} fill={loadColor(entry.load)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Stacked context distribution */}
              <div className={css.section}>
                <div className={css.sectionTitle}>Context breakdown per day</div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={ctxData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barSize={22}>
                    <CartesianGrid vertical={false} stroke="#1a1a30" />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "#555", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "#555", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<CtxTooltip />} cursor={{ fill: "#1a1a30" }} />
                    {CTX_ORDER.map((ctx) => (
                      <Bar key={ctx} dataKey={ctx} stackId="a" fill={CTX_COLOR[ctx]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div className={css.legend}>
                  {CTX_ORDER.filter((c) => c !== "unknown").map((ctx) => (
                    <span key={ctx} className={css.legendItem} style={{ color: CTX_COLOR[ctx] }}>
                      ■ {ctx.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>

              {/* Per-day breakdown table */}
              <div className={css.section}>
                <div className={css.sectionTitle}>Day-by-day</div>
                <div className={css.table}>
                  <div className={css.tableHead}>
                    <span>Day</span>
                    <span>Focus</span>
                    <span>Session</span>
                    <span>Avg load</span>
                    <span>Sessions</span>
                  </div>
                  {[...weekStats].reverse().map((d) => (
                    <div key={d.date} className={css.tableRow}>
                      <span className={css.tableDay}>{shortDay(d.date)}</span>
                      <span style={{ color: "#4af0a0" }}>{fmtMin(d.focus_minutes)}</span>
                      <span style={{ color: "#888" }}>{fmtMin(d.total_session_minutes)}</span>
                      <span style={{ color: loadColor(d.avg_load_score) }}>{pct(d.avg_load_score)}</span>
                      <span style={{ color: "#888" }}>{d.session_count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
