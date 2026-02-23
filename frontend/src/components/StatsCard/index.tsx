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
import { getDailyStats, getSessions } from "../../api/client";
import type { DailyStats, SessionSummary } from "../../types";
import css from "./StatsCard.module.css";

const CTX_COLOR: Record<string, string> = {
  deep_focus: "#4af0a0",
  shallow_work: "#f0c040",
  stuck: "#f05a4a",
  fatigue: "#b066cc",
  recovering: "#4ab0f0",
  unknown: "#555",
};

function fmtMin(min: number): string {
  if (min < 1) return "< 1 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit",
  });
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
}

function loadColor(score: number): string {
  return score > 0.7 ? "#f05a4a" : score > 0.45 ? "#f0c040" : "#4af0a0";
}

// ── Sub-components ──────────────────────────────────────────────────────────

function MiniStat({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className={css.miniStat}>
      <div className={css.miniStatLabel}>{label}</div>
      <div className={css.miniStatValue} style={{ color: color ?? "#fff" }}>{value}</div>
      {sub && <div className={css.miniStatSub}>{sub}</div>}
    </div>
  );
}

function SessionRow({ session }: { session: SessionSummary }) {
  const color = CTX_COLOR[session.dominant_context] ?? "#aaa";
  return (
    <div className={css.sessionRow}>
      <div className={css.sessionDot} style={{ background: color }} />
      <div className={css.sessionRange}>
        {fmtTime(session.start_ts)} – {fmtTime(session.end_ts)}
      </div>
      <div className={css.sessionDuration} style={{ color }}>
        {fmtMin(session.duration_minutes)}
      </div>
      <div className={css.sessionLoad}>
        {Math.round(session.avg_load_score * 100)}%
      </div>
    </div>
  );
}

function ContextBar({ dist }: { dist: Record<string, number> }) {
  const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  return (
    <div className={css.ctxBarWrap}>
      <div className={css.ctxBarTrack}>
        {sorted.map(([ctx, frac]) => (
          <div
            key={ctx}
            title={`${ctx.replace(/_/g, " ")}: ${Math.round(frac * 100)}%`}
            style={{ width: `${frac * 100}%`, background: CTX_COLOR[ctx] ?? "#444" }}
          />
        ))}
      </div>
      <div className={css.ctxLegend}>
        {sorted.filter(([, f]) => f > 0.04).map(([ctx, frac]) => (
          <span key={ctx} className={css.ctxLegendItem} style={{ color: CTX_COLOR[ctx] ?? "#aaa" }}>
            ■ {ctx.replace(/_/g, " ")} {Math.round(frac * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function WeekTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className={css.tooltip}>
      <div className={css.tooltipLabel}>{label}</div>
      <div className={css.tooltipValue}>Avg load: {payload[0].value}%</div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function StatsCard() {
  const [today, setToday] = useState<DailyStats | null>(null);
  const [weekStats, setWeekStats] = useState<DailyStats[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    const midnightUtc = new Date();
    midnightUtc.setUTCHours(0, 0, 0, 0);
    const todaySince = midnightUtc.getTime() / 1000;
    const weekSince = todaySince - 6 * 86_400;

    function refresh() {
      getDailyStats({ since: weekSince }).then((data) => {
        setWeekStats(data);
        if (data.length > 0) setToday(data[data.length - 1]);
      }).catch(() => {});
      getSessions({ since: todaySince }).then(setSessions).catch(() => {});
    }

    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  const barData = weekStats.map((d) => ({
    day: shortDay(d.date),
    load: Math.round(d.avg_load_score * 100),
  }));

  return (
    <div>
      <h3 className={css.heading}>Today's Stats</h3>

      {today ? (
        <>
          <div className={css.statsRow}>
            <MiniStat
              label="Focus"
              value={fmtMin(today.focus_minutes)}
              sub={`of ${fmtMin(today.total_session_minutes)}`}
              color="#4af0a0"
            />
            <MiniStat
              label="Avg load"
              value={`${Math.round(today.avg_load_score * 100)}%`}
              sub={`peak ${Math.round(today.peak_load_score * 100)}%`}
              color={loadColor(today.avg_load_score)}
            />
            <MiniStat
              label="Sessions"
              value={String(today.session_count)}
              sub={`${today.tick_count} ticks`}
            />
          </div>
          <ContextBar dist={today.context_distribution} />
        </>
      ) : (
        <p className={css.empty}>No data yet today</p>
      )}

      {barData.length > 1 && (
        <div className={css.weekChartWrap}>
          <div className={css.sectionLabel}>7-day avg load</div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }} barSize={14}>
              <CartesianGrid vertical={false} stroke="#1e1e3a" />
              <XAxis dataKey="day" tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<WeekTooltip />} cursor={{ fill: "#1e1e3a" }} />
              <Bar dataKey="load" radius={[3, 3, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={loadColor(entry.load / 100)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {sessions.length > 0 && (
        <div>
          <div className={css.sectionLabel}>Sessions today</div>
          <div className={css.sessionList}>
            {[...sessions].reverse().map((s) => (
              <SessionRow key={s.session_index} session={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
