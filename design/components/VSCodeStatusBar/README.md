The VS Code status-bar item format: one line with a codicon, load and context, plus its colours.

**Maps to** `plugins/vscode-extension/src/statusbar.ts`.

## Format
`$(icon) NN% Context`, right-aligned, priority 100. Examples:

| State | Text | Background |
|---|---|---|
| Deep focus | `$(target) 62% Deep focus` | none |
| Shallow work | `$(layers) 74% Shallow work` | none |
| Stuck | `$(sync) 81% Stuck` | none |
| Fatigue | `$(coffee) 88% Fatigue · take a break` | `statusBarItem.warningBackground` |
| Recovering | `$(pulse) 38% Recovering` | none |
| Warming up | `$(circle-large-outline) ≈21% Warming up` | none |
| Pomodoro running | `$(target) 62% Deep focus · $(watch) 11:24` | none |
| Offline | `$(debug-disconnect) CLR offline` | none |

## Rules
- Text uses the theme's own status-bar foreground. Don't set custom colours, so it works in every VS Code theme. Only fatigue gets a background, using the theme's warning colour.
- Tooltip (Markdown): "Load 62% · Deep focus · confidence 80%", then any active directives, then "Click to open CLR".
- Update at most every 2 s from the WebSocket. Never animate.
- Codicons stand in for the Lucide icons used in the app.
