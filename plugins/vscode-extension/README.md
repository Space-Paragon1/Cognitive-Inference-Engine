# Cognitive Load Router for VS Code

Sends coding activity to your Cognitive Load Router engine and shows your current load in the status bar.

## Connect

1. Run **CLR: Connect to Engine** from the Command Palette.
2. Enter the code shown in the CLR app under Settings → Connected sources.

The extension uses the hosted engine. To use an engine running on this computer instead, set `clr.engineUrl` to `http://127.0.0.1:8765` in Settings first.

The status bar item shows your load once the engine has a few seconds of activity.

## What it sends

- The time between keystrokes, never the keys themselves
- File saves and switches: the file name and its language
- The number of compile errors in a file
- Debugging starting and stopping, tests passing or failing, task names

It never sends your code. The engine uses these events for five minutes to estimate your load and keeps only the score.

Turn sending off at any time with **CLR: Toggle Telemetry**, or remove this editor with **CLR: Disconnect**.

## Build the installer

```bash
npm install
npm run package
```

This writes `clr-vscode.vsix`. Install it from the Extensions view (… menu → Install from VSIX).
