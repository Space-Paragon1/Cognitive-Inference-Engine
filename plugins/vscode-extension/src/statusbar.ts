/**
 * StatusBarController: the VSCodeStatusBar item (design/components/VSCodeStatusBar).
 *
 * One right-aligned item, priority 100, in the form `$(icon) NN% Context`. The text
 * keeps the theme's own status-bar colours, so it works in every theme; only fatigue
 * sets a background, the theme's warning colour.
 *
 * Live load comes from the engine WebSocket (/state/ws, which accepts this editor's
 * device token) when the editor's runtime has a WebSocket, and from GET /state every
 * 2 s when it doesn't. The item renders at most every 2 s and never animates.
 */

import * as vscode from "vscode";
import { engineRequest } from "./engineClient";

interface EngineState {
  load_score: number;
  context: string;
  confidence: number;
  active?: boolean;
}

interface PomodoroState {
  phase: string;
  remaining_seconds: number;
}

interface DirectivesOut {
  directives: { action_type: string }[];
}

/** Codicons stand in for the Lucide icons the app uses. */
const CONTEXTS: Record<string, { label: string; icon: string }> = {
  deep_focus: { label: "Deep focus", icon: "target" },
  shallow_work: { label: "Shallow work", icon: "layers" },
  stuck: { label: "Stuck", icon: "sync" },
  fatigue: { label: "Fatigue", icon: "coffee" },
  recovering: { label: "Recovering", icon: "pulse" },
  unknown: { label: "Warming up", icon: "circle-large-outline" },
};

const DIRECTIVES: Record<string, { label: string; icon: string }> = {
  recommend_break: { label: "Take a break", icon: "coffee" },
  suppress_notifications: { label: "Notifications silenced", icon: "bell-slash" },
  block_distracting_tabs: { label: "Distracting tabs blocked", icon: "shield" },
  suggest_task: { label: "Suggested task", icon: "checklist" },
  shorten_focus_interval: { label: "Shorter focus session", icon: "watch" },
  delay_hard_tasks: { label: "Hard tasks deferred", icon: "fold-down" },
};

const RENDER_MS = 2000;
const POLL_MS = 2000;
const EXTRAS_MS = 10000;
const OFFLINE_AFTER_MS = 5000;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];

/** The parts of the WebSocket API this file uses (VS Code's Node may not ship one). */
interface WsLike {
  onopen: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number }) => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
}
type WsCtor = new (url: string) => WsLike;
const WebSocketImpl = (globalThis as { WebSocket?: WsCtor }).WebSocket;

type Status = "connecting" | "live" | "offline" | "unpaired";

export class StatusBarController {
  private readonly item: vscode.StatusBarItem;
  private status: Status = "connecting";
  private state: EngineState | null = null;
  private pomodoro: { phase: string; endsAt: number } | null = null;
  private directives: string[] = [];

  private ws: WsLike | null = null;
  private attempt = 0;
  private generation = 0;
  private pollTimer: NodeJS.Timeout | null = null;
  private extrasTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private offlineTimer: NodeJS.Timeout | null = null;
  private renderTimer: NodeJS.Timeout | null = null;
  private clockTimer: NodeJS.Timeout | null = null;
  private lastRender = 0;

  constructor(
    private engineUrl: string,
    private getToken: () => Promise<string | undefined>,
    private onUnauthorized: () => void = () => {}
  ) {
    this.item = vscode.window.createStatusBarItem("clr.load", vscode.StatusBarAlignment.Right, 100);
    this.item.name = "Cognitive Load Router";
    this.item.text = "$(circle-large-outline) CLR";
    this.item.command = "clr.openDashboard";
    this.item.show();
  }

  start(): void {
    void this.connect();
  }

  setEngineUrl(url: string): void {
    this.engineUrl = url;
    void this.connect();
  }

  /** Reconnect now, e.g. after pairing or unpairing this editor. */
  refresh(): void {
    void this.connect();
  }

  dispose(): void {
    this.stop();
    if (this.renderTimer) clearTimeout(this.renderTimer);
    this.item.dispose();
  }

  // ── Connection ───────────────────────────────────────────────────────────

  private stop(): void {
    this.generation++;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    for (const t of [this.pollTimer, this.extrasTimer, this.retryTimer, this.offlineTimer]) if (t) clearTimeout(t);
    this.pollTimer = this.extrasTimer = this.retryTimer = this.offlineTimer = null;
  }

  private async connect(): Promise<void> {
    this.stop();
    const gen = this.generation;
    const token = await this.getToken();
    if (gen !== this.generation) return;
    if (!token) {
      this.setStatus("unpaired");
      return;
    }
    if (this.status === "unpaired") this.setStatus("connecting");
    void this.pollExtras(token, gen);
    if (WebSocketImpl) this.openSocket(token, gen);
    else void this.pollState(token, gen);
  }

  private openSocket(token: string, gen: number): void {
    let ws: WsLike;
    try {
      const url = new URL("/state/ws", this.engineUrl);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocketImpl!(url.toString());
    } catch {
      this.retry(token, gen);
      return;
    }
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token }));
    ws.onmessage = (ev) => {
      try {
        this.state = JSON.parse(String(ev.data)) as EngineState;
      } catch {
        return;
      }
      this.attempt = 0;
      this.setStatus("live");
    };
    ws.onerror = () => {};
    ws.onclose = (ev) => {
      if (gen !== this.generation) return;
      this.ws = null;
      if (ev.code === 4001) {
        this.setStatus("unpaired");
        this.onUnauthorized();
        return;
      }
      this.retry(token, gen);
    };
  }

  /** Reconnect with backoff; show "offline" only once the gap outlasts a blip. */
  private retry(token: string, gen: number): void {
    const wait = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    this.attempt++;
    if (!this.offlineTimer && this.status !== "offline") {
      this.offlineTimer = setTimeout(() => {
        this.offlineTimer = null;
        if (gen === this.generation && this.status !== "live") this.setStatus("offline");
      }, OFFLINE_AFTER_MS);
    }
    if (this.status === "live") this.status = "connecting";
    this.retryTimer = setTimeout(() => gen === this.generation && this.openSocket(token, gen), wait);
  }

  /** Fallback for runtimes without a WebSocket: GET /state every 2 s. */
  private async pollState(token: string, gen: number): Promise<void> {
    try {
      const res = await engineRequest(this.engineUrl, "/state", { token, timeoutMs: 3000 });
      if (gen !== this.generation) return;
      if (res.status === 401) {
        this.setStatus("unpaired");
        this.onUnauthorized();
        return;
      }
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      this.state = JSON.parse(res.body) as EngineState;
      this.setStatus("live");
    } catch {
      if (gen !== this.generation) return;
      this.setStatus("offline");
    }
    this.pollTimer = setTimeout(() => void this.pollState(token, gen), POLL_MS);
  }

  /**
   * The Pomodoro clock and the active directives for the tooltip.
   * TODO(backend): /actions/pomodoro and /actions/directives accept only a signed-in
   * user's token, not a device token, so until they do these stay empty and the item
   * shows load and context alone.
   */
  private async pollExtras(token: string, gen: number): Promise<void> {
    const get = async <T>(path: string): Promise<T | null> => {
      try {
        const res = await engineRequest(this.engineUrl, path, { token, timeoutMs: 3000 });
        return res.status === 200 ? (JSON.parse(res.body) as T) : null;
      } catch {
        return null;
      }
    };
    const [pomo, dirs] = await Promise.all([get<PomodoroState>("/actions/pomodoro"), get<DirectivesOut>("/actions/directives")]);
    if (gen !== this.generation) return;
    this.pomodoro = pomo && pomo.phase !== "idle" ? { phase: pomo.phase, endsAt: Date.now() + pomo.remaining_seconds * 1000 } : null;
    this.directives = dirs ? dirs.directives.map((d) => d.action_type).filter((t) => t in DIRECTIVES) : [];
    this.scheduleRender();
    this.extrasTimer = setTimeout(() => void this.pollExtras(token, gen), EXTRAS_MS);
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  private setStatus(status: Status): void {
    if (status === "live" && this.offlineTimer) {
      clearTimeout(this.offlineTimer);
      this.offlineTimer = null;
    }
    this.status = status;
    this.scheduleRender();
  }

  /** At most one render every 2 s. */
  private scheduleRender(): void {
    if (this.renderTimer) return;
    const wait = Math.max(0, RENDER_MS - (Date.now() - this.lastRender));
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      this.lastRender = Date.now();
      this.render();
    }, wait);
  }

  private render(): void {
    const item = this.item;
    item.backgroundColor = undefined;
    if (this.clockTimer) clearTimeout(this.clockTimer);
    this.clockTimer = null;

    if (this.status === "unpaired") {
      item.text = "$(plug) Connect CLR";
      item.tooltip = "Connect this editor to Cognitive Load Router";
      item.command = "clr.connect";
      item.accessibilityInformation = { label: "Connect this editor to Cognitive Load Router", role: "button" };
      return;
    }
    item.command = "clr.openDashboard";
    if (this.status === "offline") {
      item.text = "$(debug-disconnect) CLR offline";
      item.tooltip = `Can't reach CLR at ${hostOf(this.engineUrl)}. Retrying every few seconds.\n\nClick to open CLR`;
      item.accessibilityInformation = { label: "CLR offline", role: "button" };
      return;
    }
    const s = this.state;
    if (!s) {
      item.text = "$(circle-large-outline) CLR";
      item.tooltip = "Connecting to CLR";
      item.accessibilityInformation = { label: "Connecting to CLR", role: "button" };
      return;
    }
    if (s.active === false) {
      item.text = "$(circle-large-outline) Warming up";
      item.tooltip = "Still learning how you work today. Give it a minute or two.\n\nClick to open CLR";
      item.accessibilityInformation = { label: "CLR is warming up, no reading yet", role: "button" };
      return;
    }

    const ctx = CONTEXTS[s.context] ?? CONTEXTS.unknown;
    const load = Math.round(s.load_score * 100);
    const conf = Math.round(s.confidence * 100);
    const rough = s.confidence < 0.5 ? "≈" : "";
    const fatigue = s.context === "fatigue";
    let text = `$(${ctx.icon}) ${rough}${load}% ${ctx.label}`;
    if (fatigue) text += " · take a break";
    const clock = this.pomodoroClock();
    if (clock) text += ` · $(watch) ${clock}`;
    item.text = text;
    if (fatigue) item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");

    const tip = new vscode.MarkdownString(undefined, true);
    tip.appendMarkdown(`Load ${load}% · ${ctx.label} · confidence ${conf}%`);
    if (this.directives.length) {
      tip.appendMarkdown("\n\n" + this.directives.map((t) => `$(${DIRECTIVES[t].icon}) ${DIRECTIVES[t].label}`).join("  \n"));
    }
    tip.appendMarkdown("\n\nClick to open CLR");
    item.tooltip = tip;
    item.accessibilityInformation = {
      label: `Cognitive load ${load} percent, ${ctx.label.toLowerCase()}, confidence ${conf} percent${clock ? `, Pomodoro ${clock} left` : ""}`,
      role: "button",
    };
    // Keep the countdown current, still no more than every 2 s.
    if (clock) this.clockTimer = setTimeout(() => this.scheduleRender(), RENDER_MS);
  }

  private pomodoroClock(): string | null {
    if (!this.pomodoro) return null;
    const left = Math.max(0, Math.round((this.pomodoro.endsAt - Date.now()) / 1000));
    const time = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    return this.pomodoro.phase === "work" ? time : `${time} break`;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
