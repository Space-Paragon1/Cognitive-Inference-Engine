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
- **Prop contracts** from `design/components/index.d.ts` are copied to `src/types/ui.ts` (reusing `CognitiveContext` and `LoadBreakdown` from `src/types/index.ts`). Components import their props from there and only add small, optional extensions (listed below).
- **Domain vocabulary** (context labels, blurbs and icons, directive labels, icons and tones, difficulty, breakdown copy, sources) lives in `src/lib/domain.ts`, so every screen uses the same words.
- **Lucide stroke** is set once in `global.css` (`svg.lucide { stroke-width: 1.75 }`) to match the README's 1.75px.
- **Primitive extensions beyond index.d.ts**: Button adds `danger-ghost` and `rest-ghost` variants (both in `bundle.css`), `round`, and passes through native button attributes. ContextPill adds an `lg` size (in `bundle.css`). SegmentedControl adds `block` and `numeric`. TextField adds `id`, `name`, `required`, `autoFocus`, `inputMode`, `min`, `max`, `strength` (0–4 bars), `onBlur` and `onKeyDown`. Slider adds `onCommit`, fired on release so saves happen there. Toast adds `urgent` (role="alert") and a `key` in `useToast().show()` so a repeat replaces rather than stacks. EmptyState adds `level` for the heading. BottomSheet adds `dismissible={false}` for destructive confirmations.
- **Filter chips** show a check instead of the context icon when selected, following the SegmentedControl README ("show a check"); the label keeps the context word.
- **Disabled opacity** is 40% (Button README) rather than the 45% in `bundle.css`.
- **Skeleton sweep** is 1.6 s linear (Skeleton README and handoff.md) rather than the 1.4 s in `bundle.css`. `SkeletonRegion` adds the 300 ms delay, `aria-busy` and the hidden loading message.
- **BottomSheet** is 480px wide as a dialog (BottomSheet README), not the 520px `.clr-dialog`.
- **Android back** uses `@capacitor/app` (installed, ^8.1.2): Capacitor core has no back handling, so without the plugin the hardware back button just closes the app. `src/lib/backStack.ts` keeps an ordered stack (open sheets first); App.tsx falls back to the route rules. Run `npx cap sync` (part of `npm run cap:sync`) so the native side picks the plugin up.

## Needs backend
