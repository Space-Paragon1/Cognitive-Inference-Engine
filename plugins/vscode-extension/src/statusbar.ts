/**
 * StatusBarController — shows the current cognitive load score and context
 * in the VSCode status bar, polling the engine every 5 seconds.
 */

import * as vscode from "vscode";
import { engineRequest } from "./engineClient";

interface EngineState {
  load_score: number;
  context: string;
  confidence: number;
  active?: boolean;
}

export class StatusBarController {
  private readonly item: vscode.StatusBarItem;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private engineUrl: string,
    private getToken: () => Promise<string | undefined>
  ) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.text = "$(pulse) CLR …";
    this.item.show();
  }

  start(intervalMs = 5000): void {
    void this.poll();
    this.timer = setInterval(() => void this.poll(), intervalMs);
  }

  setEngineUrl(url: string): void {
    this.engineUrl = url;
    void this.poll();
  }

  refresh(): void {
    void this.poll();
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.item.dispose();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private showDisconnected(): void {
    this.item.text = "$(plug) CLR: Connect";
    this.item.tooltip = "Cognitive Load Router — click to connect this editor to your account";
    this.item.command = "clr.connect";
    this.item.backgroundColor = undefined;
  }

  private async poll(): Promise<void> {
    const token = await this.getToken();
    if (!token) {
      this.showDisconnected();
      return;
    }
    try {
      const res = await engineRequest(this.engineUrl, "/state", { token, timeoutMs: 3000 });
      if (res.status === 401) {
        this.showDisconnected();
        return;
      }
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const state = JSON.parse(res.body) as EngineState;
      this.item.command = "clr.openDashboard";
      this.item.tooltip = "Cognitive Load Router — click to open dashboard";
      if (state.active === false) {
        this.item.text = "$(pulse) CLR waiting for activity";
        this.item.backgroundColor = undefined;
        return;
      }
      const pct = Math.round(state.load_score * 100);
      const context = state.context.replace(/_/g, " ");
      this.item.text = `${this.iconFor(state.load_score)} ${pct}% ${context}`;
      this.item.backgroundColor = this.bgFor(state.load_score);
    } catch {
      this.item.text = "$(pulse) CLR offline";
      this.item.tooltip = `Cannot reach the engine at ${this.engineUrl}`;
      this.item.command = "clr.openDashboard";
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
}
