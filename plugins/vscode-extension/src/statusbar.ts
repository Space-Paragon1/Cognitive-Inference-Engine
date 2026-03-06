/**
 * StatusBarController — shows the current cognitive load score and context
 * in the VSCode status bar, polling the engine every 5 seconds.
 */

import * as http from "http";
import * as https from "https";
import * as vscode from "vscode";

interface EngineState {
  load_score: number;
  context: string;
  confidence: number;
}

export class StatusBarController {
  private readonly item: vscode.StatusBarItem;
  private timer: NodeJS.Timeout | null = null;

  constructor(private engineUrl: string) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.tooltip = "Cognitive Load Router — click to open dashboard";
    this.item.command = "clr.openDashboard";
    this.item.text = "$(brain) CLR …";
    this.item.show();
  }

  start(intervalMs = 5000): void {
    this.poll();
    this.timer = setInterval(() => this.poll(), intervalMs);
  }

  setEngineUrl(url: string): void {
    this.engineUrl = url;
    this.poll();
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.item.dispose();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    try {
      const state = await this.fetchState();
      const pct = Math.round(state.load_score * 100);
      const context = state.context.replace(/_/g, " ");
      this.item.text = `${this.iconFor(state.load_score)} ${pct}% ${context}`;
      this.item.backgroundColor = this.bgFor(state.load_score);
    } catch {
      this.item.text = "$(brain) CLR offline";
      this.item.backgroundColor = undefined;
    }
  }

  private iconFor(score: number): string {
    if (score < 0.4) return "$(check)";
    if (score < 0.7) return "$(warning)";
    return "$(error)";
  }

  private bgFor(score: number): vscode.ThemeColor | undefined {
    if (score >= 0.7) {
      return new vscode.ThemeColor("statusBarItem.errorBackground");
    }
    if (score >= 0.4) {
      return new vscode.ThemeColor("statusBarItem.warningBackground");
    }
    return undefined;
  }

  private fetchState(): Promise<EngineState> {
    return new Promise((resolve, reject) => {
      const url = new URL("/state", this.engineUrl);
      const lib = url.protocol === "https:" ? https : http;

      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: "GET",
        },
        (res) => {
          let raw = "";
          res.on("data", (chunk) => (raw += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(raw) as EngineState);
            } catch {
              reject(new Error("JSON parse failed"));
            }
          });
        }
      );
      req.on("error", reject);
      req.setTimeout(3000, () => req.destroy());
      req.end();
    });
  }
}
