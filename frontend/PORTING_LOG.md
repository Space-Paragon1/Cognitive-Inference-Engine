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
- [x] Insights
- [x] Settings
- [x] More
- [x] Auth (LoginPage, forgot and reset password)
- [x] Onboarding
- [x] Alerts (toasts, overload notification, haptics)

### 6. States pass
- [x] Now
- [x] Focus
- [x] Tasks
- [x] History
- [x] Insights
- [x] Settings

### 7. Small surfaces
- [x] ExtensionPopup (live/focus off, focus on, not paired)
- [x] BlockedOverlay (shadow root, 3 passes per session, pass bar, End focus mode, Esc inert)
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

- **Insights weeks** run Monday to Sunday. The week switcher sits in the top bar on desktop and in a row under the Week | History switch on phones; "Next week" is disabled on the current week. Each week is kept in memory for the visit.
- **Total focus time** on the current week is compared with the same days of last week ("2.7 h more than this time last week"), not the whole of it.
- **Daily bars** follow the ChartStyle README (non-best days in accent at 55%) rather than the preview's `--heat-2`.
- **Best hours** are estimated from sessions: each session's minutes in each hour it covers, weighted by its deep-focus share. The card keeps the "Preview" badge and says "Estimated from your sessions." Hours run 7 am to 11 pm (8 am on phones), widened when focus happened outside them.
- **Weekly reflection** is written from the week's numbers by rules (best two-hour window, strongest day, the day with the most "stuck" time or the highest load) and keeps the "Preview" badge. "Plan next week" opens Tasks; "Not helpful" hides it for that week, with Undo.
- **Badge** primitive added (`components/Badge`) for "Preview", "Best" and similar labels, ported from `.clr-badge`.
- **StatTile values** with no digits ("Wed") render at full size; only letters next to numbers are treated as units.
- **Insights with no data**: the KPIs show "–" and one card below says either "Connect a source to see your load" (nothing sending) or "Nothing tracked this week yet", with "See last week".

- **Settings layout**: section nav 3 · cards 9 on desktop (the nav stays pinned and follows the scroll; picking a section scrolls to it, moves focus there and updates the link, e.g. `#/settings/sources`). On tablet the nav becomes one scrolling row above the cards. On phones the sections are grouped under overlines, and Privacy and Connected sources are their own pages (`#/settings/privacy`, `#/settings/sources`) so More can link straight to sources. Back goes Privacy → Settings → More.
- **Slider ranges** follow the design (short break 1–15 min, long break 5–40 min, high load 50–95%, fatigue 60–99%, session gap 2–60 min), which sit inside the API's limits. Moving high load up past fatigue pushes fatigue to one point above it; fatigue's slider shows the blocked stretch below high load + 1.
- **Saving**: every change saves on its own (the engine-backed settings through `PUT /settings`). The top bar shows Saving…, Saved, "Saves when you are back online" or "Couldn't save" with Retry. On phones the load pill stays in the top bar and the status takes its place only while saving, for 3 s after "Saved", or until an error or queued save resolves.
- **Notification and vibration settings are per device** (`clr_alerts`, `clr_vibrate` in localStorage). Vibrate is on by default (the preview shows it off) because the old app always vibrated; the timer's haptics read the same key.
- **Theme** is System, Dark or Light. System follows the OS live and clears the saved choice, so the no-flash script falls back to `prefers-color-scheme`.
- **Account** shows "Member since 3 November 2026" from `created_at` (the preview's "Signed in since" isn't something the API knows).
- **Engine URL** under Connected sources, with Copy, kept from the old Connected devices panel because the browser and VS Code extensions ask for it.
- **Export my data** is assembled in the app from the existing endpoints: settings, tasks, sources, all sessions and daily stats, and the last 30 days of the timeline, as one JSON file plus a timeline CSV (shared or downloaded like the other exports).
- **Delete my data** follows the design (type DELETE to arm "Delete forever"), but the engine has no endpoint, so it calls a stub that changes nothing and the sheet says "Couldn't delete your data. This needs an update on our side. Nothing was removed."
- **Zone strip on phones**: the high and fatigue segments drop their percentages (the sliders right below show them) and never clip their names.
- **SourceCard `lastSeen`** is the full phrase ("12s ago"), as in index.d.ts; the card no longer adds its own "ago".
- **More** (phones only) follows the ScreenSettings preview: History, Settings, Connected sources ("2 of 4 connected"), Help and feedback; Theme; account and Sign out. "Help and feedback" opens a sheet explaining what CLR reads and never reads; there is no feedback channel to send to yet.

- **Auth layout**: the form column sits left and the brand panel right at 1024px and wider (as in the preview); below that the brand panel is dropped and the logo sits above the form. One page handles sign in, create account, forgot and reset; switching forms moves focus to the new heading, and Android back returns to sign in.
- **Reset links** open the reset form from `?reset_token=` (what the engine's email sends) as well as the old `?token=`. The old page only read `?token=`, so emailed links never opened the reset form.
- **Reset link lifetime**: the engine keeps reset tokens for 60 minutes, so the copy says "It works for an hour" and "Reset links last an hour" instead of voice.md's 30 minutes.
- **"Set a new password"** can't show "For sam@uni.edu": the link carries only a token and the API has no way to look up its email. The subtitle says "You will be signed in as soon as it is saved."
- **Auth errors**: wrong email or password sits under the password field; an existing account sits under the email ("There's already an account with this email. Sign in instead."); rate limits use the engine's Retry-After ("Too many attempts. Wait 2 min and try again."); server and network failures show a critical banner above the button. A signed-out session shows "You were signed out." above the sign-in form once.
- **Password strength**: 1 bar under 8 characters (critical), 2 for 8–11 (caution), 3 for 12+ and 4 for 12+ with mixed characters or 16+ (positive, "Strong. 12+ characters."). The engine only enforces 8.
- **Terms checkbox** is kept from the design. There are no terms or privacy-policy pages yet, so "terms and privacy policy" opens a sheet with what CLR reads and never reads, with "I agree".
- **Onboarding is shown** to accounts less than a day old that haven't finished it on this device (`clr_onboarded` in localStorage), so it follows sign-up and a first sign-in on a new phone, and returning students go straight to Now. The current step survives a reload for the visit.
- **Onboarding on phones** adds a Back arrow at top-left from step 2 (the preview has none; Android's back button also goes back a step). "Skip" top-right ends onboarding. Step 4's "Turn on notifications" asks for system permission (Android 13+ or the browser) and finishes either way; "Not now" finishes without asking.
- **What CLR reads and never reads** is one shared component (`components/PrivacyPromise`) used by onboarding, the sign-up terms sheet and More → Help.
- **Onboarding source descriptions** (the VS Code install steps and so on) show only until that source is connected.
- **Banner actions** wrap onto their own line when the text would get narrower than about 200px.

- **Alerts** live in one component (`components/Alerts`) mounted beside the app shell. It listens to every reading (`useLiveTicks`) and to Pomodoro phase changes, so nothing re-mounts the gauge.
- **Context toasts** fire once a new context has held for 3 readings, never for the first context after opening the app or for a change out of "Warming up", and not while confidence is under 50%. Only "Deep focus activated" has copy in voice.md; the others use the context's own blurb ("You seem stuck", "Signs of fatigue", "Shallow work", "Recovering"). While CLR is in the background the same change posts a quiet system notification.
- **Overload** counts readings above the fatigue line (with confidence of 50% or more); after 3 in a row it shows the toast (role="alert", stays until acted on) and, in the background, a system notification; then it holds for 5 minutes. It doesn't fire during a break. The first warning says "Load is above your fatigue line (85%)" because 3 readings are 6 seconds, and voice.md's "for 6 minutes" is used once the stretch is a minute or longer.
- **"Take 5 minutes"** starts a 5-minute rest on this device and opens the full-screen break (no session dots, "Come back when the timer ends, or sooner if you feel ready."). The engine has no way to start a break outside a Pomodoro.
- **Break prompts**: when a focus phase ends, desktop shows a "Break time" toast (Start break opens Focus, Skip starts the next session) and phones show the bottom sheet with the length the engine chose. Neither shows on the Focus screen, which turns into the break by itself. When a break ends away from Focus, a short "Break is over" toast. In the background both are system notifications. Break prompts ignore Do Not Disturb ("mutes everything except the timer ending") but respect the Break prompts setting.
- **Break length** in the sheet is shown, not picked: the engine sizes breaks from Settings and the session count, and has no per-break choice.
- **Engine breaks start on their own** (the engine moves from focus to break when the time is up), so the copy says "Your 5-minute break has started" rather than voice.md's "starts when you are ready".
- **System notifications** carry no action buttons; tapping one opens CLR. Android action buttons would need registered action types and handlers for when the app is closed.
- **Haptics** stay as handoff.md lists them (light on timer start and pause, medium on phase end and when a rest ends, none on context changes or alerts), and respect the Vibrate setting.
- **Old hooks removed**: `useNotifications`, `useCognitiveState` and `useTimeline` (replaced by the live store, `lib/notify.ts` and the History hooks).
- **States pass: offline means "paused", not "broken".** A shared `LoadError` shows a neutral "You are offline." with what loads when you are back (and "Timers and tasks still work.") when the socket is offline, and the critical "Couldn't load" copy only when the engine is reachable but failing. Insights, Settings, Today at a glance, Today's sessions, the session list and replay all use it.
- **Now with no reading while offline or reconnecting** keeps the gauge (caption "paused" instead of "no data yet"), titles the context "Live load paused", drops the confidence row and says timers and tasks still work. The "Connect a source" hero shows only when the engine is live and still has no reading, since offline CLR can't tell whether a source is sending.
- **The live chart** shows a "Live load is paused" empty state when it has no points and the socket is down, instead of "Connect a source".
- **Tasks are cached per account** (`clr_tasks_<userId>` in localStorage, with queued changes and the recommended id), so an offline cold start shows the last list and flushes queued changes when it can. With nothing cached, offline shows "Your list loads when you are back online" and an engine failure shows "Couldn't load your tasks" with Try again.
- **Signing out clears this device's account data**: the in-memory History, week and replay caches and the stored task cache, done-task undo list, rest timer and onboarding step (`lib/accountReset.ts`), so the next account starts clean.
- **Focus's "Couldn't reach the timer" banner** hides while offline, where the offline banner already explains it.
- **Overload toggle copy** reads the live fatigue line ("When load stays above 85%. At most every 5 min.") so it matches the alert.
- **Chart threshold labels** sit outside the band between the two lines (High below its line, Fatigue above), so they no longer collide on phone-height charts.
- **Extension design copies.** Chrome extensions can't import from the app, so `plugins/browser-extension/scripts/sync-design.mjs` inlines `design/tokens.css` into the popup (between `clr-tokens` markers), writes the same tokens as a string for the overlay's shadow root (`clr-tokens.js`, with `:root` turned into `:host`), writes the Lucide icons the extension uses as SVG strings (`clr-icons.js`) and copies the Geist fonts. Run it after changing tokens.
- **Popup theme** follows the browser's colour scheme unless the student picked one in the app: the content script reads `clr_theme` from the dashboard's own page and saves it in `chrome.storage` as `appTheme`. `popup/theme.js` sets it in `<head>`, so there's no flash.
- **Popup focus toggle** starts 25 minutes with tab blocking on, the same default as the app's Focus mode card. The popup has no duration picker in the design.
- **Popup settings** (the header's gear) hold what the old popup had in the open: the engine address (editable before pairing) and, once paired, the account and "Unpair this browser".
- **Popup states beyond the three designed ones**: "Offline" (engine unreachable: grey ring, "Can't reach CLR at host", focus toggle disabled with "Available when CLR is back", footer "Retrying every few seconds"), "Waiting for activity" (no reading yet), low confidence (dotted ring, outlined pill, "rough"), and "This browser was disconnected" when the token is refused.
- **"Sent 4s ago"** is the time of the last batch the engine accepted; the background worker stores it as `lastSentAt`.
- **Focus card caption** says "Blocking distracting sites · notifications silenced". The engine silences notifications when focus starts; it has no count of blocked sites.
- **Blocked-tab overlay** sits in a closed shadow root on `<html>`, makes `<body>` inert, pauses any video or audio, and keeps key presses from reaching the page (Esc does nothing, Tab cycles). It uses system fonts: pages can't load the extension's Geist without exposing it as a web-accessible resource.
- **A pass covers one site** (the hostname without `www.`) for 5 minutes, and a focus session allows 3 in all. The engine has no session id, so the background worker recognises a session by its start time (now minus `elapsed_minutes`); a start more than 90 s from the stored one is a new session and resets the count. Restarting focus (for example "Add 10 min" in the app) therefore counts as a new session.
- **"Back to work"** closes the tab, or goes back when it's the window's only tab, or opens the dashboard if there's nowhere to go back to. "Back to work now" on the pass bar ends the pass and does the same.
- **Which sites are blocked** stays the existing allowlist heuristic in `content.js` (study sites, localhost, the dashboard and the engine stay open).

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
- **Hourly focus data** for "Your best hours". It is estimated from sessions (`heatGrid` in `src/lib/insights.ts`, `// TODO(backend)`) and marked Preview.
- **Weekly reflection.** The design calls for an AI-written reflection plus feedback ("Not helpful"). Both need endpoints; the card is written from rules and marked Preview, and the feedback only hides the card on this device (`// TODO(backend)` in `components/Analytics/WeeklyReflection.tsx`).
- **Focus sessions and passes.** `GET /actions/focus` has no session id or start time, so the extension infers sessions from `elapsed_minutes` (see Decisions). A `session_id` and `started_at` would make the 3-pass limit exact, and recording passes on the engine would let the app show them.
- **The blocked-sites list for the extension.** Blocking uses a fixed allowlist in `content.js` until the engine can serve the student's list (also needed by Settings, above).
- **Daily stats time zone.** `GET /timeline/stats/daily` keys days by date; the app matches them to the student's local Monday-to-Sunday week. If the engine buckets days in UTC, sessions near midnight can land on the neighbouring day.
- **Export my data.** No export endpoint; the app stitches one together from what it can read, and the timeline part is limited to the last 30 days (`src/api/privacy.ts`, `// TODO(backend)`).
- **Delete my data and account.** No endpoint; `deleteMyData()` in `src/api/privacy.ts` is a stub that throws `NotAvailableError`, and the sheet says nothing was removed.
- **Feedback.** "Help and feedback" has nowhere to send feedback, so it only explains what CLR reads.
- **Onboarded flag.** Whether a student has finished onboarding is kept per device (`src/lib/onboarding.ts`, `// TODO(backend)`); a flag on the user would make it follow the account.
- **Terms and privacy policy.** No documents or URLs exist yet; the sign-up checkbox opens the in-app privacy summary.
- **Reset email address.** The reset form can't show which account it is for; the token lookup would need to return the email.
- **Starting a break on demand.** "Take 5 minutes" runs a rest on this device (`// TODO(backend)` in `src/live/TimerState.tsx`); an endpoint would let the engine pause focus inference and the extensions show the break too.
- **Choosing a break length per break.** The break prompt shows the length the engine picked; there is no way to take a long break early or a short one instead.
