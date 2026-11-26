/**
 * CLR VSCode Extension — entry point.
 * Registers listeners for IDE events and forwards them to the CLR engine.
 */

import * as os from "os";
import * as vscode from "vscode";
import { engineRequest } from "./engineClient";
import { makeEvent } from "./events";
import { StatusBarController } from "./statusbar";
import { TelemetryClient } from "./telemetry";

// The device token lives in VS Code's SecretStorage (OS keychain), not in settings.
const TOKEN_KEY = "clr.deviceToken";

let client: TelemetryClient | null = null;
let statusBar: StatusBarController | null = null;
let lastKeystrokeTime = 0;
let activeFile = "";
let warnedUnauthorized = false;

function currentEngineUrl(): string {
  return vscode.workspace
    .getConfiguration("clr")
    .get<string>("engineUrl", "http://127.0.0.1:8765")
    .replace(/\/+$/, "");
}

export function activate(context: vscode.ExtensionContext): void {
  const cfg = vscode.workspace.getConfiguration("clr");
  const engineUrl = currentEngineUrl();
  const getToken = async () => context.secrets.get(TOKEN_KEY);

  const onUnauthorized = () => {
    statusBar?.refresh();
    if (warnedUnauthorized) return;
    warnedUnauthorized = true;
    void vscode.window
      .showWarningMessage(
        "Cognitive Load Router: this editor was disconnected from your account.",
        "Reconnect"
      )
      .then((choice) => {
        if (choice === "Reconnect") void vscode.commands.executeCommand("clr.connect");
      });
  };

  client = new TelemetryClient(engineUrl, getToken, onUnauthorized, 5000);

  if (!cfg.get<boolean>("telemetryEnabled", true)) {
    client.setEnabled(false);
  }

  // ── Status bar ─────────────────────────────────────────────────────────
  statusBar = new StatusBarController(engineUrl, getToken);
  statusBar.start(5000);
  context.subscriptions.push({ dispose: () => statusBar?.dispose() });

  // ── Connect / disconnect ───────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("clr.connect", async () => {
      const url = currentEngineUrl();
      const code = await vscode.window.showInputBox({
        title: "Connect to Cognitive Load Router",
        prompt: `Open the dashboard → Settings → Connect a device, then enter the code. Engine: ${url}`,
        placeHolder: "XXXX-XXXX",
        ignoreFocusOut: true,
      });
      if (!code) return;
      try {
        const res = await engineRequest(url, "/devices/claim", {
          method: "POST",
          body: { code: code.trim(), name: `VS Code on ${os.hostname()}`, kind: "ide" },
        });
        const data = JSON.parse(res.body || "{}");
        if (res.status !== 201) {
          throw new Error(data.detail ?? `Pairing failed (HTTP ${res.status})`);
        }
        await context.secrets.store(TOKEN_KEY, data.device_token);
        warnedUnauthorized = false;
        statusBar?.refresh();
        vscode.window.showInformationMessage(
          `Cognitive Load Router: connected as ${data.user_email}.`
        );
      } catch (e) {
        vscode.window.showErrorMessage(
          `Cognitive Load Router: ${(e as Error).message || "could not reach the engine"}`
        );
      }
    }),

    vscode.commands.registerCommand("clr.disconnect", async () => {
      const token = await getToken();
      if (token) {
        try {
          await engineRequest(currentEngineUrl(), "/devices/self", { method: "DELETE", token });
        } catch {
          // engine unreachable — still forget the token locally
        }
      }
      await context.secrets.delete(TOKEN_KEY);
      statusBar?.refresh();
      vscode.window.showInformationMessage("Cognitive Load Router: disconnected.");
    })
  );

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
      client?.push(
        makeEvent("FILE_SAVE", {
          language: doc.languageId,
          file: doc.fileName,
        })
      );
    })
  );

  // ── Active editor change ───────────────────────────────────────────────
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor) return;
      const file = editor.document.fileName;
      if (file !== activeFile) {
        client?.push(
          makeEvent("FILE_SWITCH", {
            language: editor.document.languageId,
            file,
          })
        );
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
          client?.push(
            makeEvent("COMPILE_ERROR", {
              errorCount: errors.length,
              file: uri.fsPath,
              language:
                vscode.window.activeTextEditor?.document.languageId ??
                "unknown",
            })
          );
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

  // ── Task execution (terminal commands + test results) ──────────────────
  context.subscriptions.push(
    vscode.tasks.onDidStartTask((e) => {
      const taskName = e.execution.task.name;
      const taskType = e.execution.task.definition.type;
      client?.push(
        makeEvent("TERMINAL_CMD", {
          command: taskName,
          taskType,
        })
      );
    })
  );

  context.subscriptions.push(
    vscode.tasks.onDidEndTaskProcess((e) => {
      const taskName = e.execution.task.name;
      const lowerName = taskName.toLowerCase();
      const isTestTask =
        lowerName.includes("test") ||
        lowerName.includes("spec") ||
        lowerName.includes("jest") ||
        lowerName.includes("pytest") ||
        lowerName.includes("mocha") ||
        lowerName.includes("vitest");

      if (!isTestTask) return;

      if (e.exitCode === 0) {
        client?.push(makeEvent("TEST_PASS", { task: taskName }));
      } else {
        client?.push(
          makeEvent("TEST_FAIL", {
            task: taskName,
            exitCode: e.exitCode ?? -1,
          })
        );
      }
    })
  );

  // ── Toggle telemetry command ───────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("clr.toggleTelemetry", () => {
      const current = cfg.get<boolean>("telemetryEnabled", true);
      cfg.update(
        "telemetryEnabled",
        !current,
        vscode.ConfigurationTarget.Global
      );
      client?.setEnabled(!current);
      vscode.window.showInformationMessage(
        `CLR Telemetry ${!current ? "enabled" : "disabled"}`
      );
    })
  );

  // ── Open dashboard command ─────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("clr.openDashboard", () => {
      const url = cfg.get<string>("dashboardUrl", "http://localhost:5173");
      vscode.env.openExternal(vscode.Uri.parse(url));
    })
  );

  // ── Config change ──────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("clr.engineUrl")) {
        const newUrl = currentEngineUrl();
        client?.setEngineUrl(newUrl);
        statusBar?.setEngineUrl(newUrl);
      }
    })
  );
}

export function deactivate(): void {
  client?.dispose();
  statusBar?.dispose();
}
