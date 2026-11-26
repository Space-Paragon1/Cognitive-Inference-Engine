/* Pure helpers for History: replay ticks, the event log, chart series and CSV.
   The engine stores one "inference_tick" row (source "engine") every 2 s while the
   student is observed; anything else in the timeline is a raw source event. */
import type { CognitiveContext, SessionSummary, TimelineEntry } from "../types";
import { CTX, CTX_ORDER, asContext } from "./domain";
import { pct } from "./format";
import { saveFile } from "./files";

export interface ReplayTick {
  /** Unix seconds. */
  t: number;
  load: number;
  context: CognitiveContext;
  confidence: number;
}

export interface LogRow {
  id: string;
  /** Unix seconds. */
  t: number;
  source: string;
  text: string;
  load: number;
  context: CognitiveContext;
}

/** Ticks below this confidence draw as a dashed line, like the gauge's dotted arc. */
export const LOW_CONFIDENCE = 0.5;

function meta(json: string): Record<string, unknown> {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function isTick(e: TimelineEntry) {
  return e.source === "engine" && e.event_type === "inference_tick";
}

export function toTicks(entries: TimelineEntry[]): ReplayTick[] {
  return entries
    .filter(isTick)
    .map((e) => {
      const c = meta(e.metadata_json).confidence;
      return { t: e.timestamp, load: e.load_score, context: asContext(e.context), confidence: typeof c === "number" ? c : 1 };
    })
    .sort((a, b) => a.t - b.t);
}

/** Index of the last tick at or before `t` (seconds), or 0. */
export function tickAt(ticks: ReplayTick[], t: number): number {
  let lo = 0;
  let hi = ticks.length - 1;
  if (hi < 0 || t <= ticks[0].t) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ticks[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// ── Times ──────────────────────────────────────────────────────────────────

/** "8:30:41 pm" */
export function clockSeconds(sec: number): string {
  const d = new Date(sec * 1000);
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")} ${d.getHours() >= 12 ? "pm" : "am"}`;
}

/** "8:12" (no am/pm), for axis ticks. */
export function clockShort(sec: number): string {
  const d = new Date(sec * 1000);
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "Today", "Yesterday" or "Mon 24". */
export function dayLabel(sec: number, now = new Date()): string {
  const d = new Date(sec * 1000);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const diff = Math.round((start.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${d.getDate()}`;
}

/** "Tue 25 Nov · 8:12 – 9:00 pm" */
export function sessionRange(s: SessionSummary): string {
  const a = new Date(s.start_ts * 1000);
  const date = `${a.toLocaleDateString("en-GB", { weekday: "short" })} ${a.getDate()} ${a.toLocaleDateString("en-GB", { month: "short" })}`;
  const start = clockShort(s.start_ts);
  const endD = new Date(s.end_ts * 1000);
  const sameHalf = (a.getHours() >= 12) === (endD.getHours() >= 12);
  const startFull = sameHalf ? start : `${start} ${a.getHours() >= 12 ? "pm" : "am"}`;
  return `${date} · ${startFull} – ${clockShort(s.end_ts)} ${endD.getHours() >= 12 ? "pm" : "am"}`;
}

/** "at 8:31 pm, while stuck": a context as a state you were in. */
export const WHILE: Record<CognitiveContext, string> = {
  deep_focus: "in deep focus",
  shallow_work: "in shallow work",
  stuck: "stuck",
  fatigue: "fatigued",
  recovering: "recovering",
  unknown: "warming up",
};

/** Sessions that ended within the last 2 minutes are still going. */
export function isRunning(s: SessionSummary, nowSec = Date.now() / 1000) {
  return nowSec - s.end_ts < 120;
}

// ── Event log ──────────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<string, string> = {
  engine: "Engine",
  browser: "Browser",
  ide: "VS Code",
  vscode: "VS Code",
  desktop: "Desktop",
  lms: "LMS",
};

function host(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Plain-language name for a raw source event. Only the site name is shown, never the page. */
function eventText(e: TimelineEntry): string {
  const m = meta(e.metadata_json);
  switch (e.event_type) {
    case "tab_switch": {
      const h = host(m.to_url);
      return h ? `Switched tab: ${h}` : "Switched tab";
    }
    case "navigation": {
      const h = host(m.url);
      return h ? `Opened ${h}` : "Opened a page";
    }
    case "scroll":
      return "Scrolled";
    case "window_change":
      return e.source === "ide" ? "Switched file" : "Switched window";
    case "idle_start":
      return "Went idle";
    case "idle_end":
      return "Back from idle";
    case "compile_error":
      return e.source === "lms" ? "Quiz answer marked wrong" : "Compile error";
    case "compile_success":
      return "Build passed";
    case "file_save":
      return "Saved a file";
    case "keystroke":
    case "keystroke_burst":
      return "Typing burst";
    case "debug_start":
      return "Started debugging";
    case "debug_stop":
      return "Stopped debugging";
    case "terminal_cmd":
      return "Ran a terminal command";
    default: {
      const s = e.event_type.replace(/_/g, " ");
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
  }
}

/** Repeats of one event from one source within this many seconds fold into one row. */
const FOLD_S = 60;
/** A new context must hold this many ticks (6 s) before it counts as a change. */
const HOLD_TICKS = 3;

/**
 * The event log: raw source events (folded: "Compile error (×3 in 40 s)") plus what
 * the engine saw in its own ticks: the session start, context changes, crossing
 * the high-load and fatigue lines, and the peak.
 */
export function buildLog(entries: TimelineEntry[], ticks: ReplayTick[], th: { high: number; fatigue: number }, running: boolean): LogRow[] {
  const rows: LogRow[] = [];
  const loadAt = (t: number) => (ticks.length ? ticks[tickAt(ticks, t)] : null);
  const push = (t: number, source: string, text: string) => {
    const k = loadAt(t);
    rows.push({ id: `${source}-${t}-${rows.length}`, t, source, text, load: k?.load ?? 0, context: k?.context ?? "unknown" });
  };

  // Raw source events, oldest first, with repeats folded.
  const raw = entries.filter((e) => !isTick(e)).sort((a, b) => a.timestamp - b.timestamp);
  for (let i = 0; i < raw.length; ) {
    const first = raw[i];
    const text = eventText(first);
    let j = i + 1;
    while (j < raw.length && raw[j].source === first.source && eventText(raw[j]) === text && raw[j].timestamp - first.timestamp <= FOLD_S) j++;
    const n = j - i;
    const span = Math.round(raw[j - 1].timestamp - first.timestamp);
    push(raw[j - 1].timestamp, SOURCE_LABEL[first.source] ?? first.source, n > 1 ? `${text} (×${n} in ${Math.max(span, 1)} s)` : text);
    i = j;
  }

  if (ticks.length) {
    push(ticks[0].t, "Engine", "Session started");
    let ctx = ticks[0].context;
    let band = ticks[0].load >= th.fatigue ? 2 : ticks[0].load >= th.high ? 1 : 0;
    let peak = 0;
    for (let i = 1; i < ticks.length; i++) {
      const k = ticks[i];
      if (k.load > ticks[peak].load) peak = i;
      if (k.context !== ctx) {
        const held = ticks.slice(i, i + HOLD_TICKS).every((x) => x.context === k.context);
        if (held) {
          ctx = k.context;
          push(k.t, "Engine", `Context → ${CTX[ctx].label}`);
        }
      }
      const b = k.load >= th.fatigue ? 2 : k.load >= th.high ? 1 : 0;
      if (b !== band) {
        const held = ticks.slice(i, i + 2).every((x) => (x.load >= th.fatigue ? 2 : x.load >= th.high ? 1 : 0) === b);
        if (held) {
          if (b > band) push(k.t, "Engine", b === 2 ? `Load went above ${pct(th.fatigue)} (fatigue)` : `Load went above ${pct(th.high)} (high)`);
          else push(k.t, "Engine", b === 1 ? `Load eased below ${pct(th.fatigue)}` : `Load eased below ${pct(th.high)}`);
          band = b;
        }
      }
    }
    push(ticks[peak].t, "Engine", `Peak load, ${pct(ticks[peak].load)}`);
    if (!running) push(ticks[ticks.length - 1].t, "Engine", "Session ended");
  }

  return rows.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
}

// ── Chart series ───────────────────────────────────────────────────────────

export interface SeriesPoint {
  x: number;
  load: number;
  context: CognitiveContext;
  confidence: number;
  [key: string]: number | string | null;
}

/**
 * One row per point with a value under `${style}_${context}` so each context draws
 * as its own coloured segment. Neighbouring points share their boundary so segments
 * join. Styles: "p" played and confident (solid), "l" played but low confidence
 * (dashed), "u" not played yet (dashed, 50%). `split` is the last played index;
 * pass points.length - 1 for live data.
 */
export function segmentSeries(points: { x: number; load: number; context: CognitiveContext; confidence: number }[], split: number) {
  const keys = new Set<string>();
  const rows: SeriesPoint[] = points.map((p) => ({ ...p }));
  const styleOf = (i: number) => (i > split ? "u" : points[i].confidence < LOW_CONFIDENCE ? "l" : "p");
  for (let i = 0; i < points.length; i++) {
    const own = `${styleOf(i)}_${points[i].context}`;
    rows[i][own] = points[i].load;
    keys.add(own);
    // Carry each segment one point forward so it meets the next one.
    if (i + 1 < points.length) {
      const next = `${styleOf(i + 1)}_${points[i + 1].context}`;
      if (next !== own) {
        if (i === split) {
          // The unplayed run starts at the playhead, so played never runs past it.
          rows[i][next] = points[i].load;
          keys.add(next);
        } else {
          rows[i + 1][own] = points[i + 1].load;
        }
      }
    }
  }
  const order = (k: string) => "plu".indexOf(k[0]) * 10 + CTX_ORDER.indexOf(k.slice(2) as CognitiveContext);
  return { rows, keys: [...keys].sort((a, b) => order(a) - order(b)) };
}

/** Average into at most `max` buckets so long sessions stay light to draw. */
export function downsample(ticks: ReplayTick[], max = 360): ReplayTick[] {
  if (ticks.length <= max) return ticks;
  const size = ticks.length / max;
  const out: ReplayTick[] = [];
  for (let b = 0; b < max; b++) {
    const part = ticks.slice(Math.floor(b * size), Math.floor((b + 1) * size));
    if (!part.length) continue;
    const counts = new Map<CognitiveContext, number>();
    part.forEach((p) => counts.set(p.context, (counts.get(p.context) ?? 0) + 1));
    const context = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    out.push({
      t: part[part.length - 1].t,
      load: part.reduce((a, p) => a + p.load, 0) / part.length,
      context,
      confidence: Math.min(...part.map((p) => p.confidence)),
    });
  }
  return out;
}

/** Contexts that appear, in the fixed CTX order. */
export function contextsIn(items: { context: CognitiveContext }[]): CognitiveContext[] {
  const seen = new Set(items.map((i) => i.context));
  return CTX_ORDER.filter((c) => seen.has(c));
}

// ── CSV ────────────────────────────────────────────────────────────────────

function cell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function logCsv(rows: LogRow[]): string {
  const head = "time,iso_time,source,event,load,context";
  const body = rows.map((r) => [clockSeconds(r.t), new Date(r.t * 1000).toISOString(), r.source, r.text, Math.round(r.load * 100), CTX[r.context].label].map(cell).join(","));
  return [head, ...body].join("\n");
}

/** Save a CSV (share sheet on phones, download elsewhere). */
export function saveCsv(name: string, csv: string): Promise<void> {
  return saveFile(name, csv, "text/csv");
}
