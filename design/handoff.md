# Handoff

What the visuals don't show: grid, breakpoints, live-data behaviour, interaction rules, timings and the state matrix. Component-level detail is in each component's README; prop contracts are in `components/index.d.ts`.

## Breakpoints and grid

| Width | Name | Navigation | Grid | Page padding | Gutter |
|---|---|---|---|---|---|
| ≥ 1280 | Desktop (designed at 1440) | Sidebar 248px | 12 columns, content max 1200px | 32px | 24px |
| 1024–1279 | Small desktop | Rail 72px | 12 columns | 32px | 24px |
| 768–1023 | Tablet | Rail 72px | 8 columns | 24px | 20px |
| < 768 | Mobile (designed at 390; works 360–412) | Top bar + bottom tab bar | 4 columns, single stack | 16px | 16px |

Use CSS grid on the page and container queries inside cards. Directive and task cards reflow below 460px of their own width (the action moves under the text and titles wrap to two lines), so they work in a 4-column side slot and on a phone without separate components.

### Spans per screen (12-column)

| Screen | Row 1 | Row 2 | Row 3 |
|---|---|---|---|
| Now | Hero 8 · Directives 4 | Quick actions 4 · Today 4 · Up next 4 | — |
| Focus | Focus mode 6 · Pomodoro 6 | Today's sessions 12 | — |
| Tasks | Queue 8 · Add + How the order works 4 | — | — |
| History | Live chart 8 · Sessions 4 | Replay 12 | Event log 12 |
| Insights | KPI 3 × 4 | Daily 4 · Mix 4 · Reflection 4 | Table 7 · Heatmap 5 |
| Settings | Section nav 3 · Cards 9 | — | — |

At the tablet breakpoint, 8+4 rows become 8 (stacked), and 4+4+4 rows become 4+4 with the third wrapping.

## Navigation model

- **Desktop**: Now, Focus, Tasks, History, Insights and Settings in the sidebar. The live card (mini-gauge, context, Live status) sits at the top and links to Now. A running timer shows as a row above the account.
- **Mobile**: tabs for Now, Focus, Tasks, Insights and More. History is a Week | History switch inside Insights. More holds History, Settings, Connected sources, Help, the theme switch, the account and sign out. The top bar's load pill is on every screen and opens Now.
- **Timer everywhere**: the mini-player sits 8px above the tab bar on mobile and is hidden on Focus and while idle.
- **Android back**: closes a sheet, then pops a sub-page, then returns to Now; from Now it exits.
- Route names match `Route` in `index.d.ts`. Keep the existing tab state in `App.tsx`, and add `more` for mobile.

## Live data (every 2 s over the WebSocket)

- Keep one `CognitiveState` in context. Components subscribe and only re-render the parts that change. Never re-mount the gauge.
- **Gauge and breakdown**: tween to the new value over 600ms (`dur-gauge`, `ease-out`). If a new tick arrives mid-tween, retarget from the current value. Round to whole percent, and ignore changes under 1 point.
- **Context**: crossfade the colour over 400ms. Show a context-change toast only when a new context has held for 3 ticks (6 s).
- **Overload**: when load is above the fatigue threshold for 3 consecutive ticks, show the overload toast (and an Android notification if the app is backgrounded). Then hold for 5 minutes before it can fire again. This matches the counter already in `App.tsx`.
- **Directives**: diff by `action_type`. Animate in only new ones, animate out removed ones, and leave the rest still.
- **Task reorder**: recompute on each tick, but apply at most once every 30 s, and never while the pointer or focus is inside the list. Animate with FLIP.
- **Charts**: the live chart appends one point per tick with `isAnimationActive={false}` and keeps 150 points (5 minutes).
- **Connection**: Reconnecting after more than 4 s without a message (held at least 1 s on screen). Offline after 30 s or a socket close. Reconnect with backoff (1, 2, 4, 8, max 15 s). While stale, dim live numbers to 60% and show the last reading time.

## Interaction details

- **Quick actions** on Now: Start focus (uses the last duration, default 50 min), Start Pomodoro (length from current load), and Do Not Disturb (a toggle, `aria-pressed`).
- **Pomodoro length** is chosen at phase start from current load: 10 fatigued · 15 high · 25 normal · 35 low. Show the why line every time. A long break follows every 4th focus.
- **Focus mode** offers 25, 50, 90 or Custom (5–180) minutes, plus a block-tabs toggle. While active it shows elapsed of total, the end time, "Add 10 min" and "Stop focus".
- **Blocked tab**: "Back to work" has focus on load. "Let me through for 5 min" is limited to 3 per session. Esc does nothing.
- **Tasks**: add from the side form (desktop) or a bottom sheet (mobile). Swipe right to complete on mobile, with undo in a toast. The Auto order | My order switch stops reordering.
- **Replay**: one step is one tick. Space, ←, →, Home, End and 1/2/5/0 are shortcuts. Dragging the scrubber pauses playback.
- **Settings**: sliders save on release (debounce 400ms) and confirm with "Saved". Moving high load pushes the fatigue floor. "Reset to default" shows only when the value differs.
- **Delete my data**: a confirmation sheet where the danger button enables only after the student types DELETE.
- **Haptics** (Capacitor): light on timer start and pause, medium on phase end, none on context changes.

## Animation timings

| What | Duration | Easing | Reduced motion |
|---|---|---|---|
| Button press | 80ms (`dur-instant`) | standard | same |
| Hover, focus ring, chip select, toggle | 140ms (`dur-fast`) | standard | same |
| Toast in / out | 240ms in, 140ms out | ease-out | fade only |
| Banner swap, sheet content fade | 240ms (`dur-base`) | standard | fade only |
| Context colour crossfade | 400ms (`dur-slow`) | standard | instant |
| Task reorder (FLIP) | 400ms | ease-in-out | instant swap, arrow chips stay |
| Sheet slide up | 400ms, scrim 240ms | ease-out | fade only |
| Gauge arc, numbers, breakdown bars | 600ms (`dur-gauge`) | ease-out | instant |
| Timer ring | 1s linear per second | linear | steps |
| Breathing disc | 8s loop (`dur-breath`) | ease-in-out | static |
| Skeleton sweep | 1.6s loop | linear | static fill |
| New directive highlight | 4s hold, then 400ms fade | standard | none |

## State matrix

Every screen handles all of these. ✓ means it's designed in this system; "as Now" means use the Now pattern.

| Screen | Loading | Reconnecting | Offline | No data yet | Low confidence | Error |
|---|---|---|---|---|---|---|
| Now | ✓ skeleton | ✓ banner, dimmed | ✓ banner, grey gauge | ✓ connect hero | ✓ dotted arc, ≈ | ✓ |
| Focus | timer works locally | banner | banner; timer keeps running | Pomodoro uses 25 min ("normal") | why line says "rough estimate" | inline banner |
| Tasks | skeleton rows | banner | banner; edits queue locally | My order, no reorder banner | reorder paused, banner explains | ✓ inline save error |
| History | skeleton chart | live chart pauses | replay works from cache | "No sessions to replay" | dashed segments | ✓ full-card error |
| Insights | skeleton tiles | as Now | as Now | empty KPIs with "–" and a connect prompt | — | ✓ |
| Settings | skeleton rows | banner, saves queue | banner, saves queue | — | — | inline "Couldn't save" |
| Popup | skeleton ring | footer "Reconnecting…" | footer "CLR offline" | ✓ not paired | outlined pill | — |

## Porting notes

- **Tokens**: import the compiled `tokens.css` once. Theme by `data-theme` on `<html>`: the user's choice, then `prefers-color-scheme`, then dark. Store the choice in `localStorage`.
- **CSS Modules**: one `.module.css` per component. Copy the matching `.clr-*` rules from `components/bundle.css` and rename them (`.clr-gauge__num` becomes `.num` in `LoadGauge.module.css`). Keep `data-ctx` and `data-tone` attributes. They set `--c`, `--c-soft` and `--c-chart`, so one rule colours any context.
- **Component names**: LoadGauge → `LoadGauge`; StatTile → `StatsCard`; DirectiveCard → items of `DirectivesFeed`; Timer, MiniPlayer and focus mode → `ControlPanel`; TaskRow → items of `TaskQueue`; the live chart → `CognitiveTimeline`; PlaybackControls and the replay chart → `TimelineReplay`; the Insights charts → `AnalyticsPanel`; Slider and Toggle rows → `SettingsPanel`; ScreenAuth → `LoginPage`.
- **Recharts**: see **ChartStyle**. In short: one y-axis 0–100, horizontal grid only, dashed threshold lines, context colours from `--ctx-*-chart` read once via `getComputedStyle`, animation off for live data, and a custom tooltip in `surface-inverse`.
- **Android WebView**: no `backdrop-filter`, no SVG filters, no box-shadow animations. Pad for `env(safe-area-inset-*)`. Keep inputs at 16px.
- **Fonts**: self-host `@fontsource/geist` (400, 500, 600) and `@fontsource/geist-mono` (500).

## Small surfaces

- **Extension popup** (360 × 520): see **ExtensionPopup**. It uses the same tokens; inline `tokens.css` into the popup page.
- **Blocked-tab overlay**: injected by the content script into a shadow root so site CSS can't leak in. A solid `bg` cover at `z-index: 2147483647`. See **BlockedOverlay**.
- **VS Code status bar**: `$(codicon) NN% Context`, with theme colours only and the warning background for fatigue. See **VSCodeStatusBar**.
