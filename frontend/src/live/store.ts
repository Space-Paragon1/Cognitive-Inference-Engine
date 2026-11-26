/* One live CognitiveState for the whole app (design/handoff.md, "Live data").
   The engine pushes a reading every 2 s over the WebSocket. This store owns the
   socket, the connection state machine and the last 5 minutes of points.
   Components read it through useLive(selector) so each re-renders only when the
   slice it uses changes. */
import { createStateWebSocket, getLoadHistory, getState } from "../api/client";
import { asContext } from "../lib/domain";
import type { CognitiveContext, CognitiveState } from "../types";
import type { ConnectionState } from "../types/ui";

export interface LoadPoint {
  /** ms since epoch. */
  t: number;
  load: number;
  context: CognitiveContext;
  confidence: number;
}

export interface LiveSnapshot {
  /** Latest reading, or null before the first one arrives. */
  state: CognitiveState | null;
  status: ConnectionState;
  /** True until the first reading arrives (or we know we are offline). */
  loading: boolean;
  /** When the last reading arrived (ms since epoch). */
  lastReadingAt: number | null;
  /** The last 150 readings (5 minutes at one every 2 s), oldest first. */
  points: LoadPoint[];
  /** The socket was refused with 4001: the session needs a new sign-in. */
  authFailed: boolean;
}

export const MAX_POINTS = 150;
const TICK_MS = 2000;
/** No message for longer than this: Reconnecting. */
const STALE_MS = 4000;
/** No message for longer than this: Offline. */
const OFFLINE_MS = 30000;
/** Reconnecting stays on screen at least this long, so it never flickers. */
const MIN_RECONNECTING_MS = 1000;
const BACKOFF_S = [1, 2, 4, 8, 15];

type Listener = () => void;
type TickListener = (state: CognitiveState) => void;

function toPoint(s: CognitiveState, at: number): LoadPoint {
  return { t: at, load: s.load_score, context: asContext(s.context), confidence: s.confidence };
}

export class LiveStore {
  private snap: LiveSnapshot = {
    state: null,
    status: "live",
    loading: true,
    lastReadingAt: null,
    points: [],
    authFailed: false,
  };
  private listeners = new Set<Listener>();
  private tickListeners = new Set<TickListener>();
  private ws: WebSocket | null = null;
  private retryTimer: number | null = null;
  private liveTimer: number | null = null;
  private watchdog: number | null = null;
  private attempt = 0;
  private reconnectingSince: number | null = null;
  private started = false;
  private disposed = false;

  get = (): LiveSnapshot => this.snap;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  /** Called once per reading, for alert logic (overload counter, context toasts). */
  onTick = (fn: TickListener): (() => void) => {
    this.tickListeners.add(fn);
    return () => this.tickListeners.delete(fn);
  };

  private set(patch: Partial<LiveSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.disposed = false;

    // Seed the gauge and the live chart while the socket connects.
    getState()
      .then((s) => {
        if (!this.snap.state) this.set({ state: s, loading: false, lastReadingAt: Date.now() });
      })
      .catch(() => {});
    getLoadHistory(300)
      .then((h) => {
        if (this.snap.points.length > 0 || !h.scores.length) return;
        const now = Date.now();
        const scores = h.scores.slice(-MAX_POINTS);
        const points = scores.map((v, i) => ({
          t: now - (scores.length - 1 - i) * TICK_MS,
          load: v,
          context: "unknown" as CognitiveContext,
          confidence: 1,
        }));
        this.set({ points });
      })
      .catch(() => {});

    this.connect();
    this.watchdog = window.setInterval(this.checkStale, 500);
    window.addEventListener("online", this.onOnline);
    window.addEventListener("offline", this.onOffline);
  }

  stop() {
    this.disposed = true;
    this.started = false;
    if (this.retryTimer) window.clearTimeout(this.retryTimer);
    if (this.liveTimer) window.clearTimeout(this.liveTimer);
    if (this.watchdog) window.clearInterval(this.watchdog);
    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("offline", this.onOffline);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }

  /** Reconnect now (the Retry button on the offline banner). */
  retry = () => {
    if (this.snap.authFailed) return;
    if (this.retryTimer) window.clearTimeout(this.retryTimer);
    this.attempt = 0;
    this.connect();
  };

  private connect = () => {
    if (this.disposed) return;
    this.retryTimer = null;
    const prev = this.ws;
    this.ws = null;
    prev?.close();

    let ws: WebSocket;
    try {
      ws = createStateWebSocket(this.onMessage);
    } catch {
      this.onSocketClosed(1006);
      return;
    }
    this.ws = ws;
    ws.addEventListener("close", (e) => {
      if (this.ws !== ws) return;
      this.onSocketClosed(e.code);
    });
  };

  private onSocketClosed(code: number) {
    if (this.disposed) return;
    this.ws = null;
    this.reconnectingSince = null;
    if (this.liveTimer) window.clearTimeout(this.liveTimer);
    // 4001 = bad or expired token: reconnecting won't help until the user signs in again.
    if (code === 4001) {
      this.set({ status: "offline", loading: false, authFailed: true });
      return;
    }
    this.set({ status: "offline", loading: false });
    const delay = BACKOFF_S[Math.min(this.attempt, BACKOFF_S.length - 1)] * 1000;
    this.attempt += 1;
    this.retryTimer = window.setTimeout(this.connect, delay);
  }

  private onMessage = (s: CognitiveState) => {
    const now = Date.now();
    this.attempt = 0;
    const points = this.snap.points.length >= MAX_POINTS ? this.snap.points.slice(1) : this.snap.points.slice();
    points.push(toPoint(s, now));

    let status: ConnectionState = "live";
    if (this.snap.status === "reconnecting" && this.reconnectingSince != null) {
      const shown = now - this.reconnectingSince;
      if (shown < MIN_RECONNECTING_MS) {
        status = "reconnecting";
        if (this.liveTimer) window.clearTimeout(this.liveTimer);
        this.liveTimer = window.setTimeout(() => {
          this.reconnectingSince = null;
          if (this.snap.lastReadingAt && Date.now() - this.snap.lastReadingAt <= STALE_MS) this.set({ status: "live" });
        }, MIN_RECONNECTING_MS - shown);
      } else {
        this.reconnectingSince = null;
      }
    } else {
      this.reconnectingSince = null;
    }

    this.set({ state: s, status, loading: false, lastReadingAt: now, points });
    this.tickListeners.forEach((l) => l(s));
  };

  private checkStale = () => {
    const last = this.snap.lastReadingAt;
    if (last == null) return;
    const gap = Date.now() - last;
    if (gap > OFFLINE_MS && this.snap.status !== "offline") {
      this.reconnectingSince = null;
      this.set({ status: "offline" });
    } else if (gap > STALE_MS && this.snap.status === "live") {
      this.reconnectingSince = Date.now();
      this.set({ status: "reconnecting" });
    }
  };

  private onOnline = () => this.retry();

  private onOffline = () => {
    this.reconnectingSince = null;
    this.set({ status: "offline", loading: false });
  };
}
