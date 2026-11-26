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
- [ ] LoadGauge (hero, mini, pill; low confidence, no data, stale)
- [ ] Breakdown
- [ ] ConnectionStatus
- [ ] StatTile → StatsCard (+ ContextBar)
- [ ] DirectiveCard → DirectivesFeed
- [ ] TaskRow → TaskQueue
- [ ] Timer
- [ ] MiniPlayer
- [ ] PlaybackControls
- [ ] SourceCard
- [ ] ChartStyle (Recharts styling)

### 4. App shell
- [ ] Routes renamed to `Route` names
- [ ] Desktop Sidebar (+ 72px rail at 768–1279)
- [ ] Mobile top bar with load pill
- [ ] TabBar with More
- [ ] Timer row (sidebar) and MiniPlayer (mobile)
- [ ] Breakpoints and 12-column grid
- [ ] Android back handling

### 5. Screens
- [ ] Now
- [ ] Focus
- [ ] Tasks
- [ ] History
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

## Needs backend
