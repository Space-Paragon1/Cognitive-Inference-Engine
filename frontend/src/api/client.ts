import type {
  ActiveActions,
  AuthUser,
  CognitiveState,
  DailyStats,
  Device,
  FocusState,
  PairingCode,
  PomodoroState,
  SessionSummary,
  Settings,
  SettingsResponse,
  Task,
  TaskQueue,
  TimelineEntry,
  TokenResponse,
} from "../types";

// VITE_API_URL is set to the Railway backend URL in production.
// In dev: empty → requests go through Vite's proxy at /api (strips the prefix).
// In prod (mobile/Railway): requests go directly to the backend — no /api prefix needed.
const API_ROOT = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const BASE = API_ROOT || "/api";

// ── Token storage ────────────────────────────────────────────────────────────

const TOKEN_KEY = "clr_token";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

// ── WebSocket ────────────────────────────────────────────────────────────────

function getWsBaseUrl(): string {
  if (API_ROOT) {
    return API_ROOT.replace(/^https/, "wss").replace(/^http/, "ws");
  }
  return `ws://${window.location.hostname}:8765`;
}

/**
 * Open the live state stream. The token is sent as the first message rather
 * than in the URL, so it never shows up in proxy or server logs.
 */
export function createStateWebSocket(onMessage: (s: CognitiveState) => void): WebSocket {
  const ws = new WebSocket(`${getWsBaseUrl()}/state/ws`);
  ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ type: "auth", token: getAuthToken() ?? "" }));
  });
  ws.addEventListener("message", (e) => onMessage(JSON.parse(e.data) as CognitiveState));
  return ws;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

/** A failed auth request, with the status so the forms can word the error. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Seconds from Retry-After on a 429. */
    public retryAfter: number | null = null
  ) {
    super(message);
    this.name = "HttpError";
  }
}

async function authPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_ROOT}/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: unknown };
    const retry = Number(res.headers.get("Retry-After"));
    throw new HttpError(res.status, typeof data.detail === "string" ? data.detail : `${res.status} ${res.statusText}`, Number.isFinite(retry) && retry > 0 ? retry : null);
  }
  return res.json() as Promise<T>;
}

export const login = (email: string, password: string) => authPost<TokenResponse>("login", { email, password });

export const register = (email: string, password: string) => authPost<TokenResponse>("register", { email, password });

export const getMe = () =>
  fetch(`${API_ROOT}/auth/me`, { headers: authHeaders() }).then((r) => {
    if (!r.ok) throw new Error("Unauthorized");
    return r.json() as Promise<AuthUser>;
  });

export async function forgotPassword(email: string): Promise<void> {
  await authPost<unknown>("forgot-password", { email });
}

export const resetPassword = (token: string, newPassword: string) => authPost<TokenResponse>("reset-password", { token, new_password: newPassword });

// ── State ──────────────────────────────────────────────────────────────────

export const getState = () => get<CognitiveState>("/state");

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

export const getSessions = (params?: {
  since?: number;
  until?: number;
  gap_minutes?: number;
}) => {
  const q = new URLSearchParams();
  if (params?.since) q.set("since", String(params.since));
  if (params?.until) q.set("until", String(params.until));
  if (params?.gap_minutes) q.set("gap_minutes", String(params.gap_minutes));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return get<SessionSummary[]>(`/timeline/sessions${qs}`);
};

export const getDailyStats = (params?: { since?: number; until?: number }) => {
  const q = new URLSearchParams();
  if (params?.since) q.set("since", String(params.since));
  if (params?.until) q.set("until", String(params.until));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return get<DailyStats[]>(`/timeline/stats/daily${qs}`);
};

// ── Actions ────────────────────────────────────────────────────────────────

export const getFocusState = () => get<FocusState>("/actions/focus");
export const startFocus = (durationMinutes = 25, blockTabs = true) =>
  post<FocusState>("/actions/focus/start", { duration_minutes: durationMinutes, block_tabs: blockTabs });
export const stopFocus = () => post<FocusState>("/actions/focus/stop");

export const getPomodoro = () => get<PomodoroState>("/actions/pomodoro");
export const startPomodoro = () => post<PomodoroState>("/actions/pomodoro/start");
export const stopPomodoro = () => post<PomodoroState>("/actions/pomodoro/stop");

export const getTasks = () => get<TaskQueue>("/actions/tasks");
export const addTask = (task: Omit<Task, "tags"> & { tags?: string[] }) =>
  post<Task>("/actions/tasks", { ...task, tags: task.tags ?? [] });
export const removeTask = (id: string) => del(`/actions/tasks/${id}`);

export const getDirectives = () => get<ActiveActions>("/actions/directives");

// ── Settings ────────────────────────────────────────────────────────────────

export const getSettings = () => get<SettingsResponse>("/settings");
export async function putSettings(patch: Partial<Settings>): Promise<{ settings: Settings }> {
  const res = await fetch(`${BASE}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: unknown };
    throw new Error(typeof data.detail === "string" ? data.detail : `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<{ settings: Settings }>;
}

// ── Devices (plugin pairing) ────────────────────────────────────────────────

export const createPairingCode = () => post<PairingCode>("/devices/pairing-code");
export const listDevices = () => get<Device[]>("/devices");
export const revokeDevice = (id: number) => del(`/devices/${id}`);

/** The engine URL plugins should be pointed at (shown next to the pairing code). */
export function engineUrlForPlugins(): string {
  return API_ROOT || "http://127.0.0.1:8765";
}

// ── Do Not Disturb ──────────────────────────────────────────────────────────

export const setDnD = (enabled: boolean) =>
  post<{ enabled: boolean; ok: boolean }>("/actions/dnd", { enabled });
