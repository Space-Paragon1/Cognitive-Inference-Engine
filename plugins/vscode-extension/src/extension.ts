/**
 * CLR VSCode Extension — entry point.
 * Registers listeners for IDE events and forwards them to the CLR engine.
 */

import * as vscode from "vscode";
import { makeEvent } from "./events";
import { TelemetryClient } from "./telemetry";

let client: TelemetryClient | null = null;
let lastKeystrokeTime = 0;
let activeFile = "";

export function activate(context: vscode.ExtensionContext): void {
  const cfg = vscode.workspace.getConfiguration("clr");
  client = new TelemetryClient(
    cfg.get<string>("engineUrl", "http://127.0.0.1:8765"),
    5000
  );

  if (!cfg.get<boolean>("telemetryEnabled", true)) {
    client.setEnabled(false);
  }

  // ── Keystroke cadence ──────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (!e.contentChanges.length) return;
      const now = Date.now();
      const interval = lastKeystrokeTime ? now - lastKeystrokeTime : 0;
      lastKeystrokeTime = now;
      client?.push(makeEvent("KEYSTROKE", { intervalMs: interval }));
    })
  );

  // ── File save ──────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      client?.push(makeEvent("FILE_SAVE", {
        language: doc.languageId,
        file: doc.fileName,
      }));
    })
  );

  // ── Active editor change ───────────────────────────────────────────────
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor) return;
      const file = editor.document.fileName;
      if (file !== activeFile) {
        client?.push(makeEvent("FILE_SWITCH", {
          language: editor.document.languageId,
          file,
        }));
        activeFile = file;
      }
    })
  );

  // ── Diagnostics (compile errors) ───────────────────────────────────────
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics((e) => {
      for (const uri of e.uris) {
        const diags = vscode.languages.getDiagnostics(uri);
        const errors = diags.filter(
          (d) => d.severity === vscode.DiagnosticSeverity.Error
        );
        if (errors.length > 0) {
          client?.push(makeEvent("COMPILE_ERROR", {
            errorCount: errors.length,
            file: uri.fsPath,
            language: vscode.window.activeTextEditor?.document.languageId ?? "unknown",
          }));
        }
      }
    })
  );

  // ── Debug session ──────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession(() => {
      client?.push(makeEvent("DEBUG_START", {}));
    }),
    vscode.debug.onDidTerminateDebugSession(() => {
      client?.push(makeEvent("DEBUG_STOP", {}));
    })
  );

  // ── Toggle command ─────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("clr.toggleTelemetry", () => {
      const current = cfg.get<boolean>("telemetryEnabled", true);
      cfg.update("telemetryEnabled", !current, vscode.ConfigurationTarget.Global);
      client?.setEnabled(!current);
      vscode.window.showInformationMessage(
        `CLR Telemetry ${!current ? "enabled" : "disabled"}`
      );
    })
  );

  // ── Config change ──────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("clr.engineUrl")) {
        const newUrl = vscode.workspace
          .getConfiguration("clr")
          .get<string>("engineUrl", "http://127.0.0.1:8765");
        client?.setEngineUrl(newUrl);
      }
    })
  );

  vscode.window.setStatusBarMessage("$(brain) CLR connected", 3000);
}

export function deactivate(): void {
  client?.dispose();
}
