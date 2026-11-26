# Porting log: CLR redesign

Source of truth: `design/` (README.md, handoff.md, voice.md, components/index.d.ts, each component's README.md and preview.html).
Branch: `redesign/design-system` (from `main`, not pushed).

## Checklist

### 1. Setup
- [x] lucide-react, @fontsource/geist, @fontsource/geist-mono installed
- [x] `src/styles/tokens.css` copied from `design/tokens.css`, imported once in `main.tsx` with Geist 400/500/600 and Geist Mono 500
- [x] No-flash theme script in `index.html` (saved choice → prefers-color-scheme → dark)
- [x] Hardcoded colours and font removed from `index.html`
- [x] Conflicting `mobile.css` rules removed

### 2. Primitives
- [x] Button
- [x] Toggle
- [x] SegmentedControl (+ FilterChip)
- [x] TextField
- [x] Slider
- [x] ContextPill
- [x] DifficultyChip
- [x] Skeleton
- [x] Banner
- [x] Toast
- [x] EmptyState
- [x] BottomSheet

### 3. Live state and data
- [x] LoadGauge (hero, mini, pill; low confidence, no data, stale)
- [x] Breakdown
- [x] ConnectionStatus
- [x] StatTile → StatsCard (+ ContextBar)
- [x] DirectiveCard → DirectivesFeed
- [x] TaskRow → TaskQueue
- [x] Timer
- [x] MiniPlayer
- [x] PlaybackControls
- [x] SourceCard
- [x] ChartStyle (Recharts styling)

### 4. App shell
- [x] Routes renamed to `Route` names
- [x] Desktop Sidebar (+ 72px rail at 768–1279)
- [x] Mobile top bar with load pill
- [x] TabBar with More
- [x] Timer row (sidebar) and MiniPlayer (mobile)
- [x] Breakpoints and 12-column grid
- [x] Android back handling

### 5. Screens
- [x] Now
- [x] Focus
- [x] Tasks
- [x] History
- [ ] Insights
- [ ] Settings
- [ ] More
- [ ] Auth (LoginPage, forgot and reset password)
- [ ] Onboarding
- [ ] Alerts (toasts, overload notification, haptics)

### 6. States pass
- [ ] Now
- [ ] Focus
- [ ] Tasks
- [ ] History
- [ ] Insights
- [ ] Settings

### 7. Small surfaces
- [ ] ExtensionPopup (live/focus off, focus on, not paired)
- [ ] BlockedOverlay (shadow root, 3 passes per session, pass bar, End focus mode, Esc inert)
- [ ] VSCodeStatusBar

### 8. Final QA
- [ ] Clean `npm run build`
- [ ] Screens checked at 390 and 1440, both themes
- [ ] Focus rings, 44px targets, gauge meter semantics, reduced motion
- [ ] Old components and CSS removed

## Decisions

- **Theme storage key** is `clr_theme` in `localStorage` (`"light"` or `"dark"`). With no saved choice the inline script in `index.html` follows `prefers-color-scheme` and falls back to dark.
- **Global stylesheet** `src/styles/global.css` holds only what every component needs: the `data-ctx` / `data-tone` mapping from `bundle.css`, the base reset, the focus ring, 16px inputs on phones, and two utilities (`.num` for tabular numerals, `.sr-only`). Everything else is in CSS Modules.
- **Reduced motion** is handled per component (each module turns off its own loops and slides; fades stay) instead of a global "kill all transitions" rule, because handoff.md keeps fades for toasts, banners and sheets.
- **viewport-fit=cover** added to the viewport meta so `env(safe-area-inset-*)` returns real values in the Android WebView.
- **mobile.css** keeps only the `.safe-top` / `.safe-bottom` helpers. The old tab bar, `.clr-root` grid, the global 44px `button` minimum (which broke 36px small buttons) and the `!important` input override were removed; `global.css` keeps inputs at 16px under 768px.
- **Prop contracts** from `design/components/index.d.ts` are copied to `src/types/ui.ts` (reusing `CognitiveContext` and `LoadBreakdown` from `src/types/index.ts`). Components import their props from there and only add small, optional extensions (listed below).
- **Domain vocabulary** (context labels, blurbs and icons, directive labels, icons and tones, difficulty, breakdown copy, sources) lives in `src/lib/domain.ts`, so every screen uses the same words.
- **Lucide stroke** is set once in `global.css` (`svg.lucide { stroke-width: 1.75 }`) to match the README's 1.75px.
- **Primitive extensions beyond index.d.ts**: Button adds `danger-ghost` and `rest-ghost` variants (both in `bundle.css`), `round`, and passes through native button attributes. ContextPill adds an `lg` size (in `bundle.css`). SegmentedControl adds `block` and `numeric`. TextField adds `id`, `name`, `required`, `autoFocus`, `inputMode`, `min`, `max`, `strength` (0–4 bars), `onBlur` and `onKeyDown`. Slider adds `onCommit`, fired on release so saves happen there. Toast adds `urgent` (role="alert") and a `key` in `useToast().show()` so a repeat replaces rather than stacks. EmptyState adds `level` for the heading. BottomSheet adds `dismissible={false}` for destructive confirmations.
- **Filter chips** show a check instead of the context icon when selected, following the SegmentedControl README ("show a check"); the label keeps the context word.
- **Disabled opacity** is 40% (Button README) rather than the 45% in `bundle.css`.
- **Skeleton sweep** is 1.6 s linear (Skeleton README and handoff.md) rather than the 1.4 s in `bundle.css`. `SkeletonRegion` adds the 300 ms delay, `aria-busy` and the hidden loading message.
- **BottomSheet** is 480px wide as a dialog (BottomSheet README), not the 520px `.clr-dialog`.
- **Android back** uses `@capacitor/app` (installed, ^8.1.2): Capacitor core has no back handling, so without the plugin the hardware back button just closes the app. `src/lib/backStack.ts` keeps an ordered stack (open sheets first); App.tsx falls back to the route rules. Run `npx cap sync` (part of `npm run cap:sync`) so the native side picks the plugin up.
- **Live state** lives in `src/live/store.ts` (one `LiveStore` per signed-in session) and is read with `useLive(selector)` (`src/live/LiveState.tsx`), built on `useSyncExternalStore` with a cached selector, so a component re-renders only when its slice changes. The store seeds from `GET /state` and `GET /timeline/load-history`, then follows the WebSocket. The HTTP seed counts as a reading, so a socket that opens but stays silent still turns Reconnecting after 4 s.
- **Tweens** run in JS (`useTween`, a rAF loop, cubic ease-out over 600 ms) rather than as CSS transitions on `stroke-dasharray`, so the arc and the number move together, retarget from the current value, skip changes under 1 point, and jump under reduced motion. Colour changes stay CSS transitions (400 ms).
- **Gauge extensions**: `status` and `lastReadingAt` (stale dimming and "Last reading 9:58 pm"; offline also greys the arc), `showPill`, `showNumber` for the mini ring, and `onClick` to make the pill a button that opens Now. The SVG mask uses the keyword `white` (a mask luminance, not a UI colour).
- **Breakdown** takes the three values as optional and adds `empty` for "no data yet". The Rough badge sits in a small "Breakdown" header inside the component, because the hero card has no separate breakdown header.
- **ConnectionStatus** shows all four sources by default (unlisted ones as not connected, per the contract) and takes an optional `kinds` list. `lastSeenSeconds` renders as "Last reading 12s ago" while stale.
- **StatTile** splits a value such as "1 h 48 m" into numbers and small unit letters, matching the preview markup. The context bar is 10px tall (StatTile README) rather than the 12px in `bundle.css`.
- **Task order** mirrors `engine/router/scheduler.py` in `src/lib/order.ts` (high-load threshold, then under 40%), so the UI's order matches the engine's. The Pomodoro length and why line use the engine's bands too (`>= 0.45` counts as normal), not the `< .4` low band in the preview script, so the explanation always matches the length the engine picks.
- **Directive cards** take an extra `leaving` flag for the fade-out. The feed shows up to 4 with "View all N" (DirectiveCard README) and announces only new directives.
- **TaskRow** swipe-to-complete uses pointer events on touch only (96px threshold), with a positive "Done" strip behind the row. The checkbox is a real `<input type="checkbox">`.
- **Timer** adds `paused` and `whyNode`. Its `role="timer"` label is rounded to whole minutes, so it changes once a minute rather than every second. MiniPlayer adds `paused` and `compact` (the sidebar row).
- **SourceCard** has no QR button. Drawing a QR code needs an encoder library, which is outside the packages this job installs; the code, Copy and the countdown cover pairing. It adds an expired state ("This code has expired. Get a new one." with New code), `primary`, `desc` and `connecting`.
- **Charts** use `ChartFrame` (role="img" with the summary, legend, "View as table") and `useChartColors()`, which reads token values with `getComputedStyle` and re-reads them when `data-theme` changes.
- **Folder mapping during the port**: new components sit next to the old ones in the mapped folders (`StatsCard/StatTile.tsx`, `DirectivesFeed/DirectiveCard.tsx`, `TaskQueue/TaskRow.tsx`, `ControlPanel/Timer.tsx` and `MiniPlayer.tsx`, `TimelineReplay/PlaybackControls.tsx`). The old `index.tsx` files stay until the shell and screens replace their call sites in phases 4 and 5. New shared pieces without an old folder get their own (`Breakdown`, `ConnectionStatus`, `SourceCard`, `ChartStyle`, the primitives).
- **Routing** uses hash routes named after `Route` (`#/now`, `#/focus`, `#/settings/sources`) in `src/lib/router.ts`. Hash routes work from the Capacitor WebView's local files without server rewrites, and the browser's back button keeps working on the web.
- **Layout switch** happens in JS (`useLayout()`: sidebar at 1280px and up, rail at 768–1279px, phone layout below), so only one main `<nav>` is ever in the page. Spacing (page padding 32/24/16px, gutter 24/20/16px) and the 12/8/4 columns are CSS. `Cell` defaults its tablet span to 4 for spans up to 4 and 8 otherwise, which gives the handoff's "8+4 stacks, 4+4+4 wraps".
- **Page padding** follows the handoff table (32px on desktop) rather than the 40px in the screen mockups' frames. Content is capped at 1200px (`--content-max`).
- **Rail**: icons only, each with a tooltip on hover and keyboard focus; the live card becomes the 44px ring; the Tasks count becomes a dot; the running timer becomes a ring with minutes left. The account keeps the avatar and theme button.
- **Avatar initials** come from the email's local part ("sam.rivera@…" gives "SR"), since accounts have no name field.
- **The mobile bell** opens a "What CLR is doing" sheet with every active directive. The design shows the bell but not its destination, and directives are the only notification-like content the app has.
- **Start focus in the top bar** becomes "View focus" (opens Focus) while focus mode runs, so the primary button never restarts a running session.
- **More on wider screens** redirects to Now: the sidebar already holds everything More lists.
- **Expired sessions**: a WebSocket close with 4001 signs the student out and flags the sign-in page to say the session ended.
- **Sources** count as sending when the engine heard from them in the last 2 minutes (`CognitiveState.sources`).
- **Shared data providers** (`src/live/`): `SettingsState` (400 ms debounced saves, queued offline), `TimerState` (polls focus and Pomodoro every 2 s, counts down locally each second; remembers the last focus length, default 50 min), `TasksState` (polls every 5 s; adds and completions apply at once and queue while offline or after a failed save), `DirectivesState` (polls every 4 s, diffs by `action_type`, keeps each directive's "since" time), `PrefsState` (theme and Do Not Disturb).
- **Directive reasons** are written in `src/lib/directives.ts` from voice.md's table, filled with live numbers and task titles ("Next Pomodoro is 15 min because your load is high (78%)").
- **Skip link** ("Skip to content") added at the top of the shell; after each navigation, focus moves to the new page's `<h1>`.

- **Now (desktop)** follows the ScreenNow preview: hero, quick actions and Today in the 8 column; directives and Up next in the 4 column. With no data yet the title is "Welcome", the top bar shows a "No sources" chip, the hero becomes the source cards with pairing, and Today shows "–" values with "No sessions yet today".
- **Up next → Start** starts a Pomodoro and opens Focus. Quick actions are buttons; Do Not Disturb is a Toggle row.
- **Focus**: with no Pomodoro running, the Pomodoro card shows the setup (length scale and why line) with Start. Focus mode can be linked to the Pomodoro ("Same length as the Pomodoro"). Turning tab blocking on or off restarts focus mode with the time left, since the API takes `block_tabs` only at start. Today's sessions has no Type column: sessions don't record whether they were a Pomodoro or focus mode.
- **Break**: "I'm back early" and "Skip break" both start the next focus phase (the engine has no separate end-break call). While on a break, Focus hides the sidebar and tab bar so the break screen takes the whole canvas.
- **Tasks**: one banner per order rule, including a "steady" line for the normal range. Low confidence (under 50%) and a stale connection pause reordering, with a line saying so. "My order" is the engine's insertion order, and the choice is kept in `clr_task_order`. Removing a task asks first in a sheet, with Undo in a toast. "Done today" is kept on this device (`clr_done_YYYY-MM-DD`).
- **Dev mock engine** (`src/dev/mockEngine.ts`, loaded only when `VITE_MOCK=1` in dev): patches `fetch` and `WebSocket` so every screen and state can be checked without the engine. Scenarios: `?mock=live|high|fatigue|stuck|low|lowconf|nodata|empty|reconnecting|offline|error`, `?mockauth=out`, and `window.clrMock.finishPhase()`.
- **History layout** follows handoff.md's spans (Live chart 8 · Sessions 4 | Replay 12 | Event log 12) rather than the preview's arrangement (replay 8 beside stats and live chart). The session's four numbers sit in a 280px column inside the replay card, and stack under the chart below 1280px.
- **History on phones** is three pages under the Insights tab: the list (Week | History switch, live chart, sessions), `#/history/<start>` (replay, numbers, Event log row, Export in the top bar) and `#/history/<start>/log` (chips, list, Export CSV). Choosing a log row opens the replay at that moment. The More tab's History link goes to the same list, so the Insights tab lights up for History.
- **Replay data** comes from `GET /timeline` in pages of 1000 (the API's limit, newest first) over the session's window. Only `inference_tick` rows feed the chart. Long sessions are averaged to at most 360 points for drawing; stepping still moves one 2-second tick. The playhead is remembered per session for the visit, and the speed in `clr_replay_speed`.
- **Event log rows** are the raw source events the timeline holds, with repeats within 60 s folded ("Compile error (×3 in 40 s)"), plus what the engine's ticks show: the session start and end, context changes that hold for 6 s, crossing the high and fatigue lines (and easing back), and the peak. Browser rows show the site name only, never the page. The log runs oldest first so it can follow the playhead; the row under the playhead is highlighted and kept in view while playing.
- **Low confidence in charts**: stretches under 50% confidence draw dashed at full strength (unplayed replay is dashed at 50%). The live chart's soft fill uses the current context.
- **Export CSV** exports the log rows shown (after filters). It uses the share sheet when the platform can share files, else a download.
- **Threshold labels**: "High" sits under its line and "Fatigue" above, so the two never overlap on narrow charts.
- **Scrubber track** edge uses `--line-strong` instead of `--line` so the track meets 3:1 against the card (it was near invisible in dark mode).
- **Replay offline**: sessions and every timeline opened this visit stay in memory, so replay keeps working offline; the History banner says so.

## Needs backend

- **Pomodoro pause, resume and skip.** The API has only `POST /actions/pomodoro/start` and `/stop`. The Timer shows Pause/Resume and Skip as the design asks. Until the engine has endpoints, pause is held locally in the Focus screen (`// TODO(backend)` in `ControlPanel`), and Skip stops the current phase.
- **Pausing a directive.** The design's directive actions ("Pause" on Notifications silenced, "Edit" on Distracting tabs blocked, "Undo" on Hard tasks deferred) need endpoints to pause one directive, list and edit blocked sites, and override the deferral. Cards show only the actions the API can back: Start break and Open or Start (which open Focus and Tasks).
- **User-facing directive reasons.** The engine's `reason` strings are written for developers ("Student is stuck — eliminate interruptions"). The UI writes its own reasons from `action_type`, `params` and the live state, in the voice.md wording (`src/lib/directives.ts`). The engine could send these strings itself.
- **Do Not Disturb state.** There is `POST /actions/dnd` but no way to read the current value, so the app remembers the last value set on this device (`clr_dnd` in localStorage, `// TODO(backend)` in `src/live/PrefsState.tsx`).
- **Extending a focus session.** "Add 10 min" restarts focus mode with the time left plus 10 minutes (`// TODO(backend)` in `src/live/TimerState.tsx`); an extend endpoint would keep the original start time.
- **Completing a task.** The API can only delete a task, so "complete" deletes it and Undo adds it back with the same id. Completed tasks aren't kept anywhere, so nothing can report them later.
- **Raw events in the timeline.** The engine writes only its own `inference_tick` rows to the timeline; source events (tab switches, compile errors, idle) are used for inference and dropped. The event log shows whatever non-tick rows exist (so it fills in as soon as the engine stores them) and, until then, the engine-derived rows (context changes, threshold crossings, start, peak, end).
- **Session type.** Sessions don't say whether they were a Pomodoro or focus mode, so Today's sessions has no Type column.
- **Blocked sites.** There is no endpoint to list or edit the blocked-sites list, so "Edit" on the Distracting tabs blocked directive and the Settings list are not wired.
