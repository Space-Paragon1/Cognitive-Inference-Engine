/* Dev-only mock engine: `VITE_MOCK=1 npm run dev`. Replaces fetch and WebSocket
   with an in-memory engine so every screen and state can be checked without the
   Python engine. Never bundled into production (main.tsx imports it behind
   import.meta.env.DEV).

   Scenarios: add ?mock=<name> to the URL (remembered in sessionStorage):
     live (default) · high · fatigue · stuck · low · lowconf · nodata · empty
     reconnecting · offline · error
   ?mockauth=out starts signed out. Sample student: Sam, sam@uni.edu. */
import type {
  ActionDirective,
  CognitiveContext,
  CognitiveState,
  DailyStats,
  Device,
  FocusState,
  PomodoroState,
  SessionSummary,
  Settings,
  Task,
  TimelineEntry,
} from "../types";

type Scenario =
  | "live"
  | "high"
  | "fatigue"
  | "stuck"
  | "low"
  | "lowconf"
  | "nodata"
  | "empty"
  | "reconnecting"
  | "offline"
  | "error";

const params = new URLSearchParams(window.location.search);
const fromUrl = params.get("mock");
if (fromUrl) sessionStorage.setItem("clr_mock", fromUrl);
const scenario = (sessionStorage.getItem("clr_mock") ?? "live") as Scenario;
if (params.get("mockauth") === "out") localStorage.removeItem("clr_token");

const BAND: Record<string, { base: number; ctx: CognitiveContext; conf: number }> = {
  live: { base: 0.62, ctx: "deep_focus", conf: 0.82 },
  high: { base: 0.78, ctx: "shallow_work", conf: 0.8 },
  fatigue: { base: 0.9, ctx: "fatigue", conf: 0.85 },
  stuck: { base: 0.72, ctx: "stuck", conf: 0.78 },
  low: { base: 0.3, ctx: "recovering", conf: 0.8 },
  lowconf: { base: 0.48, ctx: "shallow_work", conf: 0.35 },
};
const band = BAND[scenario] ?? BAND.live;
const now = () => Date.now() / 1000;
const t0 = now();

let tick = 0;
function liveState(): CognitiveState {
  tick++;
  if (scenario === "nodata") {
    return {
      load_score: 0,
      context: "unknown",
      confidence: 0,
      breakdown: { intrinsic: 0, extraneous: 0, germane: 0 },
      timestamp: now(),
      active: false,
      sources: {},
      estimator: "v1",
    };
  }
  const wobble = Math.sin(tick / 4) * 0.04 + Math.sin(tick / 11) * 0.03;
  const load = Math.max(0.02, Math.min(0.99, band.base + wobble));
  return {
    load_score: load,
    context: band.ctx,
    confidence: band.conf,
    breakdown: { intrinsic: load * 0.42, extraneous: load * 0.24, germane: load * 0.34 },
    timestamp: now(),
    active: true,
    sources: { browser: now() - 3, ide: now() - 5 },
    estimator: "ml",
  };
}
let current = liveState();

/* ---------- In-memory engine ---------- */
const settings: Settings = {
  short_break_seconds: 300,
  long_break_seconds: 1200,
  high_load_threshold: 0.75,
  fatigue_threshold: 0.85,
  session_gap_minutes: 10,
};
const defaults: Settings = { ...settings };

let tasks: Task[] =
  scenario === "empty" || scenario === "nodata"
    ? []
    : [
        { id: "t1", title: "Linear algebra problem set 4", difficulty: "hard", estimated_minutes: 50, tags: ["MATH 221"] },
        { id: "t2", title: "Reply to group project thread", difficulty: "easy", estimated_minutes: 10, tags: ["CS 310"] },
        { id: "t3", title: "Read chapter 7: memory hierarchies", difficulty: "medium", estimated_minutes: 35, tags: ["CS 310"] },
        { id: "t4", title: "Review lecture notes from Tuesday", difficulty: "review", estimated_minutes: 20, tags: [] },
      ];

let focus: FocusState = { active: false, elapsed_minutes: 0, duration_minutes: 50, block_tabs: true, reason: "" };
let focusStart = 0;
let pomo: { phase: PomodoroState["phase"]; start: number; duration: number; done: number } = {
  phase: "idle",
  start: 0,
  duration: 0,
  done: 0,
};

function pomodoroMinutes(load: number) {
  if (load >= settings.fatigue_threshold) return 10;
  if (load >= settings.high_load_threshold) return 15;
  if (load >= 0.45) return 25;
  return 35;
}

function pomodoroState(): PomodoroState {
  if (pomo.phase !== "idle") {
    const elapsed = now() - pomo.start;
    if (elapsed >= pomo.duration) {
      if (pomo.phase === "work") {
        pomo.done += 1;
        const long = pomo.done % 4 === 0;
        pomo = { ...pomo, phase: long ? "long_break" : "short_break", start: now(), duration: long ? settings.long_break_seconds : settings.short_break_seconds };
      } else {
        pomo = { ...pomo, phase: "work", start: now(), duration: pomodoroMinutes(current.load_score) * 60 };
      }
    }
  }
  const elapsed = pomo.phase === "idle" ? 0 : now() - pomo.start;
  return {
    phase: pomo.phase,
    elapsed_seconds: Math.round(elapsed),
    remaining_seconds: pomo.phase === "idle" ? 0 : Math.max(0, Math.round(pomo.duration - elapsed)),
    sessions_completed: pomo.done,
    duration_seconds: pomo.duration,
  };
}

function focusState(): FocusState {
  if (focus.active) {
    const elapsed = (now() - focusStart) / 60;
    if (elapsed >= focus.duration_minutes) focus = { ...focus, active: false, elapsed_minutes: 0 };
    else focus = { ...focus, elapsed_minutes: elapsed };
  }
  return focus;
}

const RULES: Partial<Record<CognitiveContext, ActionDirective[]>> = {
  stuck: [
    { action_type: "suppress_notifications", params: {}, priority: 1, reason: "Student is stuck — eliminate interruptions" },
    { action_type: "suggest_task", params: { type: "review", difficulty: "easy" }, priority: 2, reason: "Surface prerequisite material" },
    { action_type: "block_distracting_tabs", params: {}, priority: 2, reason: "Limit scope of context switches" },
    { action_type: "shorten_focus_interval", params: { minutes: 10 }, priority: 3, reason: "Reduce pressure by shortening session" },
  ],
  deep_focus: [
    { action_type: "suppress_notifications", params: {}, priority: 1, reason: "Protect deep focus window" },
    { action_type: "block_distracting_tabs", params: {}, priority: 2, reason: "Reduce extraneous load" },
  ],
  fatigue: [
    { action_type: "recommend_break", params: { duration_min: 15 }, priority: 1, reason: "Cognitive recovery needed" },
    { action_type: "suppress_notifications", params: {}, priority: 1, reason: "Reduce stimulus during recovery" },
    { action_type: "delay_hard_tasks", params: {}, priority: 2, reason: "Defer high-difficulty work until recovery" },
  ],
  shallow_work: [
    { action_type: "suggest_task", params: { type: "current", difficulty: "medium" }, priority: 3, reason: "Bring attention back to primary task" },
  ],
  recovering: [
    { action_type: "schedule_hard_task", params: {}, priority: 4, reason: "Low load is ideal for high-difficulty material" },
    { action_type: "allow_notifications", params: {}, priority: 5, reason: "Student has capacity for minor interruptions" },
  ],
};

const CONTEXTS: CognitiveContext[] = ["deep_focus", "shallow_work", "stuck", "fatigue", "recovering"];
function sessions(): SessionSummary[] {
  if (scenario === "empty" || scenario === "nodata") return [];
  const out: SessionSummary[] = [];
  const day = 86400;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const base = today.getTime() / 1000;
  for (let d = 6; d >= 0; d--) {
    const n = d === 0 ? 2 : 1 + (d % 3);
    for (let i = 0; i < n; i++) {
      const start = base - d * day + (14 + i * 3) * 3600 + (d * 7 % 40) * 60;
      const dur = 25 + ((d * 13 + i * 17) % 70);
      const avg = 0.38 + ((d * 7 + i * 5) % 40) / 100;
      const dist: Record<string, number> = {};
      CONTEXTS.forEach((c, k) => (dist[c] = Math.max(0, ((d + k * 3 + i) % 6) / 15)));
      dist.deep_focus += 0.3;
      const sum = Object.values(dist).reduce((a, b) => a + b, 0);
      Object.keys(dist).forEach((k) => (dist[k] = dist[k] / sum));
      const dominant = Object.entries(dist).sort((a, b) => b[1] - a[1])[0][0];
      if (start + dur * 60 > now()) continue;
      out.push({
        session_index: out.length,
        start_ts: start,
        end_ts: start + dur * 60,
        duration_minutes: dur,
        tick_count: dur * 30,
        avg_load_score: avg,
        peak_load_score: Math.min(0.97, avg + 0.22),
        context_distribution: dist,
        dominant_context: dominant,
      });
    }
  }
  return out;
}

function daily(): DailyStats[] {
  const byDay = new Map<string, SessionSummary[]>();
  for (const s of sessions()) {
    const key = new Date(s.start_ts * 1000).toISOString().slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }
  return [...byDay.entries()].map(([date, ss]) => {
    const mins = ss.reduce((a, s) => a + s.duration_minutes, 0);
    const dist: Record<string, number> = {};
    ss.forEach((s) => Object.entries(s.context_distribution).forEach(([k, v]) => (dist[k] = (dist[k] ?? 0) + (v * s.duration_minutes) / mins)));
    return {
      date,
      tick_count: ss.reduce((a, s) => a + s.tick_count, 0),
      session_count: ss.length,
      avg_load_score: ss.reduce((a, s) => a + s.avg_load_score * s.duration_minutes, 0) / mins,
      peak_load_score: Math.max(...ss.map((s) => s.peak_load_score)),
      total_session_minutes: mins,
      focus_minutes: Math.round(mins * (dist.deep_focus ?? 0.4)),
      context_distribution: dist,
    };
  });
}

function timeline(since?: number, until?: number): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  const end = until ?? now();
  const start = since ?? end - 3600;
  const sources = ["browser", "ide", "desktop"];
  const events: Record<string, string[]> = {
    browser: ["tab_switch", "scroll", "page_focus"],
    ide: ["compile_error", "keystroke_burst", "file_save"],
    desktop: ["window_change", "idle_start", "idle_end"],
  };
  let k = 0;
  for (let t = start; t < end && out.length < 600; t += 6) {
    const src = sources[k % 3];
    const ev = events[src][(k >> 1) % 3];
    const load = Math.max(0.05, Math.min(0.97, 0.5 + Math.sin(k / 9) * 0.25 + Math.sin(k / 3) * 0.05));
    const ctx: CognitiveContext = load > 0.86 ? "fatigue" : load > 0.72 ? "stuck" : load > 0.5 ? "deep_focus" : load > 0.35 ? "shallow_work" : "recovering";
    out.push({ id: k, timestamp: t, source: src, event_type: ev, load_score: load, context: ctx, metadata_json: "{}" });
    k++;
  }
  return out;
}

let devices: Device[] =
  scenario === "nodata"
    ? []
    : [
        { id: 1, name: "Chrome on MacBook", kind: "browser", created_at: t0 - 86400 * 20, last_seen_at: t0 - 3 },
        { id: 2, name: "VS Code", kind: "ide", created_at: t0 - 86400 * 12, last_seen_at: t0 - 5 },
      ];
let pairing: { code: string; expires_at: number } | null = null;

/* ---------- fetch ---------- */
const realFetch = window.fetch.bind(window);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, window.location.origin);
  if (url.origin !== window.location.origin || (!url.pathname.startsWith("/api") && !url.pathname.startsWith("/auth"))) {
    return realFetch(input, init);
  }
  const path = url.pathname.replace(/^\/api/, "");
  const method = (init?.method ?? "GET").toUpperCase();
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  await delay(scenario === "live" ? 120 : 250);

  if (path.startsWith("/auth/")) {
    if (path === "/auth/login" || path === "/auth/register") {
      if (body?.password === "wrong") return json({ detail: "Incorrect email or password" }, 401);
      return json({ access_token: "mock-token", token_type: "bearer" });
    }
    if (path === "/auth/me") {
      const auth = new Headers(init?.headers).get("Authorization");
      return auth ? json({ id: 1, email: "sam@uni.edu", created_at: t0 - 86400 * 30 }) : json({ detail: "Unauthorized" }, 401);
    }
    if (path === "/auth/forgot-password") return json({ ok: true });
    if (path === "/auth/reset-password") return json({ access_token: "mock-token", token_type: "bearer" });
  }

  if (scenario === "offline") throw new TypeError("Failed to fetch");
  if (scenario === "error") return json({ detail: "Internal error" }, 500);

  switch (`${method} ${path}`) {
    case "GET /state":
      return json(current);
    case "GET /timeline/load-history": {
      if (scenario === "nodata") return json({ scores: [], window_seconds: 300, count: 0 });
      const scores = Array.from({ length: 150 }, (_, i) => Math.max(0.05, band.base + Math.sin((i - 150) / 4) * 0.04 + Math.sin((i - 150) / 11) * 0.03));
      return json({ scores, window_seconds: 300, count: 150 });
    }
    case "GET /timeline":
      if (scenario === "nodata" || scenario === "empty") return json([]);
      return json(timeline(Number(url.searchParams.get("since")) || undefined, Number(url.searchParams.get("until")) || undefined));
    case "GET /timeline/sessions": {
      const since = Number(url.searchParams.get("since")) || 0;
      const until = Number(url.searchParams.get("until")) || Infinity;
      return json(sessions().filter((s) => s.start_ts >= since && s.start_ts < until));
    }
    case "GET /timeline/stats/daily": {
      const since = Number(url.searchParams.get("since")) || 0;
      return json(daily().filter((d) => new Date(d.date).getTime() / 1000 >= since - 86400));
    }
    case "GET /actions/focus":
      return json(focusState());
    case "POST /actions/focus/start":
      focusStart = now();
      focus = { active: true, elapsed_minutes: 0, duration_minutes: body.duration_minutes, block_tabs: body.block_tabs, reason: "manual" };
      return json(focus);
    case "POST /actions/focus/stop":
      focus = { ...focus, active: false, elapsed_minutes: 0 };
      return json(focus);
    case "GET /actions/pomodoro":
      return json(pomodoroState());
    case "POST /actions/pomodoro/start":
      pomo = { ...pomo, phase: "work", start: now(), duration: pomodoroMinutes(current.load_score) * 60 };
      return json(pomodoroState());
    case "POST /actions/pomodoro/stop":
      pomo = { phase: "idle", start: 0, duration: 0, done: pomo.done };
      return json(pomodoroState());
    case "GET /actions/tasks":
      return json({ tasks, recommended_duration_minutes: pomodoroMinutes(current.load_score) });
    case "POST /actions/tasks":
      tasks = [...tasks.filter((t) => t.id !== body.id), body];
      return json(body);
    case "GET /actions/directives":
      return json({
        directives: scenario === "empty" || scenario === "nodata" ? [] : RULES[current.context] ?? [],
        load_score: current.load_score,
        context: current.context,
      });
    case "POST /actions/dnd":
      return json({ enabled: body.enabled, ok: false });
    case "GET /settings":
      return json({ settings, defaults });
    case "PUT /settings":
      Object.assign(settings, body);
      return json({ settings });
    case "POST /devices/pairing-code":
      pairing = { code: String(100000 + Math.floor(Math.random() * 899999)).replace(/(\d{3})(\d{3})/, "$1-$2"), expires_at: now() + 600 };
      return json(pairing);
    case "GET /devices":
      return json(devices);
  }
  if (method === "DELETE" && path.startsWith("/actions/tasks/")) {
    const id = decodeURIComponent(path.split("/").pop() ?? "");
    tasks = tasks.filter((t) => t.id !== id);
    return json({ status: "removed" });
  }
  if (method === "DELETE" && path.startsWith("/devices/")) {
    const id = Number(path.split("/").pop());
    devices = devices.filter((d) => d.id !== id);
    return json({ status: "revoked" });
  }
  return json({ detail: `Mock has no ${method} ${path}` }, 404);
};

/* ---------- WebSocket ---------- */
class MockSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  private timer: number | null = null;
  private sent = 0;
  constructor(public url: string) {
    super();
    window.setTimeout(() => {
      if (scenario === "offline") {
        this.finish(1006);
        return;
      }
      this.readyState = 1;
      this.dispatchEvent(new Event("open"));
      this.timer = window.setInterval(() => {
        if (scenario === "reconnecting" && this.sent >= 3) return; // goes silent
        current = liveState();
        this.sent++;
        this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(current) }));
      }, 2000);
    }, 300);
  }
  send() {}
  close() {
    this.finish(1000);
  }
  private finish(code: number) {
    if (this.timer) window.clearInterval(this.timer);
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.dispatchEvent(new CloseEvent("close", { code }));
  }
}
(window as unknown as { WebSocket: unknown }).WebSocket = MockSocket;

console.info(`[mock engine] scenario "${scenario}". Change with ?mock=live|high|fatigue|stuck|low|lowconf|nodata|empty|reconnecting|offline|error`);
