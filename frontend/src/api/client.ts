import type {
  CognitiveState,
  FocusState,
  PomodoroState,
  Task,
  TaskQueue,
  TimelineEntry,
} from "../types";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

// ── State ──────────────────────────────────────────────────────────────────

export const getState = () => get<CognitiveState>("/state");

export function createStateWebSocket(onMessage: (s: CognitiveState) => void): WebSocket {
  const wsUrl = window.location.origin.replace(/^http/, "ws").replace("5173", "8765") + "/state/ws";
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (e) => onMessage(JSON.parse(e.data) as CognitiveState);
  return ws;
}

// ── Timeline ───────────────────────────────────────────────────────────────

export const getTimeline = (params?: {
  since?: number;
  until?: number;
  source?: string;
  limit?: number;
}) => {
  const q = new URLSearchParams();
  if (params?.since) q.set("since", String(params.since));
  if (params?.until) q.set("until", String(params.until));
  if (params?.source) q.set("source", params.source);
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return get<TimelineEntry[]>(`/timeline${qs}`);
};

export const getLoadHistory = (windowS = 300) =>
  get<{ scores: number[]; window_seconds: number; count: number }>(
    `/timeline/load-history?window_s=${windowS}`
  );

// ── Actions ────────────────────────────────────────────────────────────────

export const getFocusState = () => get<FocusState>("/actions/focus");
export const startFocus = (durationMinutes = 25, blockTabs = true) =>
  post<FocusState>("/actions/focus/start", { duration_minutes: durationMinutes, block_tabs: blockTabs });
export const stopFocus = () => post<FocusState>("/actions/focus/stop");

export const getPomodoro = () => get<PomodoroState>("/actions/pomodoro");
export const startPomodoro = () => post<PomodoroState>("/actions/pomodoro/start");

export const getTasks = () => get<TaskQueue>("/actions/tasks");
export const addTask = (task: Omit<Task, "tags"> & { tags?: string[] }) =>
  post<Task>("/actions/tasks", { ...task, tags: task.tags ?? [] });
export const removeTask = (id: string) => del(`/actions/tasks/${id}`);
