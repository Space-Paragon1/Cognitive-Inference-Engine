/* Pure helpers for Insights: weeks, KPIs, the best-hours grid and the reflection. */
import type { CognitiveContext, DailyStats, SessionSummary } from "../types";
import { CTX, CTX_ORDER, asContext } from "./domain";
import { pct } from "./format";

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Monday 00:00 (local) of the week `offset` weeks from this one (0 = this week, -1 = last). */
export function weekStart(offset = 0, now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow + offset * 7);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Local "YYYY-MM-DD", the key daily stats use. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "17 – 23 November", or "27 October – 2 November" across months. */
export function weekLabel(start: Date): string {
  const end = addDays(start, 6);
  const month = (d: Date) => d.toLocaleDateString("en-GB", { month: "long" });
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${end.getDate()} ${month(end)}`
    : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`;
}

export interface DayRow {
  index: number;
  short: string;
  long: string;
  date: string;
  focusMinutes: number;
  sessions: number;
  trackedMinutes: number;
  avgLoad: number | null;
  peak: number | null;
  distribution: Partial<Record<CognitiveContext, number>>;
  top: CognitiveContext | null;
  /** The day has not happened yet. */
  future: boolean;
}

export function dayRows(start: Date, stats: DailyStats[], now = new Date()): DayRow[] {
  const byDate = new Map(stats.map((s) => [s.date, s]));
  return DAY_SHORT.map((short, i) => {
    const d = addDays(start, i);
    const s = byDate.get(dateKey(d));
    const dist: Partial<Record<CognitiveContext, number>> = {};
    if (s) for (const [k, v] of Object.entries(s.context_distribution)) dist[asContext(k)] = v;
    const top = s && s.session_count ? (CTX_ORDER.filter((k) => (dist[k] ?? 0) > 0).sort((a, b) => (dist[b] ?? 0) - (dist[a] ?? 0))[0] ?? null) : null;
    return {
      index: i,
      short,
      long: DAY_LONG[i],
      date: dateKey(d),
      focusMinutes: s?.focus_minutes ?? 0,
      sessions: s?.session_count ?? 0,
      trackedMinutes: s?.total_session_minutes ?? 0,
      avgLoad: s && s.session_count ? s.avg_load_score : null,
      peak: s && s.session_count ? s.peak_load_score : null,
      distribution: dist,
      top,
      future: d > now,
    };
  });
}

export interface Kpis {
  focusHours: number;
  vsLastWeek: number | null;
  best: DayRow | null;
  avgLoad: number | null;
  efficiency: number | null;
}

export function kpis(days: DayRow[], lastWeekFocusMinutes: number | null): Kpis {
  const focus = days.reduce((a, d) => a + d.focusMinutes, 0);
  const tracked = days.reduce((a, d) => a + d.trackedMinutes, 0);
  const best = days.reduce<DayRow | null>((b, d) => (d.focusMinutes > (b?.focusMinutes ?? 0) ? d : b), null);
  const avg = tracked ? days.reduce((a, d) => a + (d.avgLoad ?? 0) * d.trackedMinutes, 0) / tracked : null;
  const deep = tracked ? days.reduce((a, d) => a + (d.distribution.deep_focus ?? 0) * d.trackedMinutes, 0) / tracked : null;
  return {
    focusHours: focus / 60,
    vsLastWeek: lastWeekFocusMinutes == null ? null : (focus - lastWeekFocusMinutes) / 60,
    best,
    avgLoad: avg,
    efficiency: deep,
  };
}

/** "3.4" (one decimal under 10 hours, whole hours above). */
export function hours(h: number): string {
  return h >= 10 ? h.toFixed(1).replace(/\.0$/, "") : h.toFixed(1);
}

// ── Best hours ─────────────────────────────────────────────────────────────

export interface HeatGrid {
  /** [day 0–6][hour 0–23] focus minutes. */
  minutes: number[][];
  /** 0–4 per cell, for --heat-0 … --heat-4. */
  level: number[][];
  max: number;
  peak: { day: number; hour: number } | null;
}

/**
 * Focus minutes by weekday and hour, estimated from sessions: each session's minutes
 * in each hour it covers, weighted by its deep-focus share. TODO(backend): an hourly
 * endpoint would make this exact; the card is marked "Preview" until then.
 */
export function heatGrid(sessions: SessionSummary[], start: Date): HeatGrid {
  const minutes = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const weekStartS = start.getTime() / 1000;
  for (const s of sessions) {
    const share = s.context_distribution.deep_focus ?? 0;
    for (let t = s.start_ts; t < s.end_ts; ) {
      const d = new Date(t * 1000);
      const next = new Date(d);
      next.setMinutes(0, 0, 0);
      next.setHours(d.getHours() + 1);
      const until = Math.min(s.end_ts, next.getTime() / 1000);
      const day = Math.floor((t - weekStartS) / 86400);
      if (day >= 0 && day < 7) minutes[(d.getDay() + 6) % 7][d.getHours()] += ((until - t) / 60) * share;
      t = until;
    }
  }
  let max = 0;
  let peak: HeatGrid["peak"] = null;
  minutes.forEach((row, day) =>
    row.forEach((v, hour) => {
      if (v > max) {
        max = v;
        peak = { day, hour };
      }
    })
  );
  const level = minutes.map((row) => row.map((v) => (v <= 0.5 || !max ? 0 : Math.max(1, Math.ceil((v / max) * 4)))));
  return { minutes, level, max, peak };
}

/** "9 am", "12 pm" */
export function hourLabel(h: number): string {
  const hh = h % 12 || 12;
  return `${hh} ${h % 24 >= 12 ? "pm" : "am"}`;
}

/** The best run of `span` hours in a row of minutes: "9 – 11 am". */
export function bestWindow(row: number[], span = 2): string | null {
  let best = -1;
  let at = 0;
  for (let h = 0; h + span <= 24; h++) {
    const v = row.slice(h, h + span).reduce((a, b) => a + b, 0);
    if (v > best) {
      best = v;
      at = h;
    }
  }
  if (best <= 0) return null;
  const end = at + span;
  const a = at % 12 || 12;
  return (at >= 12) === (end % 24 >= 12) ? `${a} – ${hourLabel(end)}` : `${hourLabel(at)} – ${hourLabel(end)}`;
}

/** Hours to show: 7 am to 11 pm, widened if focus happened outside them. */
export function hourRange(grid: HeatGrid, from = 7, to = 23): [number, number] {
  let lo = from;
  let hi = to;
  grid.minutes.forEach((row) =>
    row.forEach((v, h) => {
      if (v > 0.5) {
        lo = Math.min(lo, h);
        hi = Math.max(hi, h + 1);
      }
    })
  );
  return [lo, Math.min(24, hi)];
}

// ── Reflection ─────────────────────────────────────────────────────────────

/**
 * Two or three sentences from the week's numbers. TODO(backend): the design calls for
 * an AI-written reflection; until an endpoint exists this is written from rules and the
 * card is marked "Preview".
 */
export interface Reflection {
  /** "9 and 11 am", shown in bold. */
  window: string | null;
  strongest: string | null;
  more: string | null;
}

export function reflection(days: DayRow[], grid: HeatGrid, high: number): Reflection | null {
  const tracked = days.filter((d) => d.sessions > 0);
  if (!tracked.length) return null;
  const weekRow = new Array<number>(24).fill(0);
  grid.minutes.forEach((r) => r.forEach((v, h) => (weekRow[h] += v)));
  const window = bestWindow(weekRow);
  const best = days.reduce((b, d) => (d.focusMinutes > b.focusMinutes ? d : b), days[0]);
  const stuckDay = tracked.reduce((b, d) => ((d.distribution.stuck ?? 0) > (b.distribution.stuck ?? 0) ? d : b), tracked[0]);
  const loadDay = tracked.reduce((b, d) => ((d.avgLoad ?? 0) > (b.avgLoad ?? 0) ? d : b), tracked[0]);
  let more: string | null = null;
  if ((stuckDay.distribution.stuck ?? 0) >= 0.15) {
    more = `On ${stuckDay.long} you got stuck more often. Starting those sessions after a short break could help.`;
  } else if ((loadDay.avgLoad ?? 0) >= high) {
    more = `Your load ran high on ${loadDay.long} (${pct(loadDay.avgLoad ?? 0)}). Shorter Pomodoros that day could help.`;
  }
  return {
    window: window ? window.replace(" – ", " and ") : null,
    strongest: best.focusMinutes > 0 ? `${best.long} was your strongest day, with ${hours(best.focusMinutes / 60)} hours.` : null,
    more,
  };
}

// ── CSV ────────────────────────────────────────────────────────────────────

export function weekCsv(days: DayRow[]): string {
  const head = "day,date,focus_hours,sessions,avg_load,peak_load,mostly";
  const rows = days.map((d) =>
    [d.long, d.date, (d.focusMinutes / 60).toFixed(2), d.sessions, d.avgLoad == null ? "" : Math.round(d.avgLoad * 100), d.peak == null ? "" : Math.round(d.peak * 100), d.top ? CTX[d.top].label : ""].join(",")
  );
  return [head, ...rows].join("\n");
}
