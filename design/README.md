Cognitive Load Router (CLR) is a study companion that reads how loaded a student is every 2 seconds, then protects their focus, times their breaks and reorders their tasks. The interface should feel like a calm coach. It should never feel like a tracker that grades the student. Build every screen from the tokens and components here. The per-component READMEs cover behaviour, and **Handoff** covers layout, motion and live-data rules.

## Principles

- **Load is information, never a grade.** A high number means CLR will make things easier. Never colour load as good or bad, never use red for it, and never write "you failed".
- **Say why.** Every automatic change gets a reason in plain words: the Pomodoro length ("15 min because your load is high (78%)"), the task order, and each directive.
- **Calm under constant change.** Numbers update every 2 s. Animate values, never layouts. The page doesn't move when data arrives.
- **Never colour alone.** Every context is a colour, a Lucide icon and a word. Difficulty is shape plus a word. Toggles carry a check.
- **Works with partial data.** Any mix of sources is fine. Low confidence looks less certain, and no data is an invitation, never an error.

## Voice

- Second person, short, plain, supportive. "You are in the zone." "Resting counts as progress."
- Sentence case everywhere, including buttons and titles. No exclamation marks and no emoji.
- Explain jargon the first time it appears: intrinsic is "how hard the task itself is", extraneous is "distraction and switching", germane is "productive effort".
- Describe what CLR is doing for the student, not what the student did wrong: "Protecting your deep-focus window", not "You switched tabs 14 times".
- Use the domain labels exactly (Deep focus, Shallow work, Stuck, Fatigue, Recovering, Warming up; Take a break, Notifications silenced…). The full copy deck is in **Voice and copy**.

## Colour

Dark is the default theme (`data-theme="dark"`), and light is a full peer (`data-theme="light"`). Use tokens only; never use hex in components.

- **Surfaces**: `bg` page → `surface` cards → `surface-raised` popovers and selected segments → `surface-sunken` tracks and wells. `surface-hover` for row hover. Borders are `line`; `line-strong` is only for control outlines that must pass 3:1.
- **Ink**: `ink` for primary text and numbers, `ink-muted` for secondary text and reasons, `ink-subtle` for timestamps, axis ticks and placeholders. All pass 4.5:1 on `surface` in both themes.
- **Accent** (indigo, kept from the current app and softened): `accent` for primary buttons, active nav, links and the focus timer. `accent-soft` is the fill behind active items. `on-accent` is text on accent. `focus-ring` is the keyboard outline.
- **Contexts**: each context has three tokens. `ctx-<key>` is for text, icons and the gauge arc (passes 4.5:1). `ctx-<key>-soft` is the pill and tile fill. `ctx-<key>-chart` is for chart fills, on `surface` only.

| Context | Key | Lucide icon | Hue |
|---|---|---|---|
| Deep focus | `deep_focus` | `Target` | green-teal |
| Shallow work | `shallow_work` | `Waves` | gold |
| Stuck | `stuck` | `Repeat` | warm amber |
| Fatigue | `fatigue` | `BatteryLow` | dusty rose |
| Recovering | `recovering` | `Leaf` | sky blue |
| Warming up | `unknown` | `CircleDashed` | grey |

  Stuck and fatigue are deliberately warm (amber and rose), never alarm red. The six chart colours were checked for protanopia, deuteranopia and tritanopia separation and still always ship with a label or legend.
- **Breakdown**: `load-intrinsic` (violet), `load-extraneous` (ochre), `load-germane` (teal). Use them only for the three breakdown bars.
- **Status**: `positive` (Live, connected, saved), `caution` (reconnecting), `critical` (errors and destructive actions only, never load), each with a `-soft` fill. Status always comes with an icon and a word.
- **Rest**: `rest-surface`, `rest-surface-raised`, `rest-line`, `rest-ink`, `rest-ink-muted` and `rest-accent` repaint break screens in a quiet blue-grey so a break feels unlike work.
- **Charts**: `chart-grid` for gridlines, `chart-threshold` for the high-load and fatigue lines, and `heat-0` to `heat-4` for the best-hours heatmap.
- **Overlays**: `scrim` behind sheets and dialogs. Never use `backdrop-filter`: it's expensive in the Android WebView.

## Type

Geist for everything and Geist Mono for pairing codes. Set `font-variant-numeric: tabular-nums` on every number that changes (the `num-*` styles already do), so digits never shift.

| Style | Size / line | Use |
|---|---|---|
| `num-gauge` | 72/72, 600 | Hero gauge number (56px on mobile) |
| `num-timer` | 64/64, 500 | Countdown (56px on mobile) |
| `num-stat` | 28/34, 600 | Stat tiles and KPIs |
| `num-inline` | 15/20, 500 | Percentages and durations in rows |
| `title-1` | 28/34, 600 | Desktop page titles, auth and onboarding headings |
| `title-2` | 20/28, 600 | Mobile titles, hero context name, sheet titles |
| `title-3` | 16/24, 600 | Card and toast titles |
| `body-lg` | 17/26 | Hero explanations, onboarding, break prompts |
| `body` | 15/22 | Default UI text (16px inside inputs on mobile) |
| `body-sm` | 13/20 | Reasons, helper text, table cells |
| `label` | 14/20, 500 | Buttons, nav, field labels, chips |
| `caption` | 12/16, 500 | Timestamps, axis ticks, tab labels. 12px is the floor |
| `overline` | 11/16, 600, +0.08em | Uppercase section eyebrows only |
| `code` | 20/28, Mono, +0.12em | Pairing codes |

## Spacing, radius, elevation

- 4px base: `space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-5` 20 · `space-6` 24 · `space-8` 32 · `space-10` 40 · `space-12` 48 · `space-16` 64. Card padding is `space-5` on desktop and `space-4` on mobile. The grid gutter is `space-6`.
- Radius: `radius-xs` 6 (chips) · `radius-sm` 8 (segments, tooltip) · `radius-md` 12 (buttons, inputs, rows) · `radius-lg` 16 (cards, toasts) · `radius-xl` 24 (sheets, popup) · `radius-full` (pills, toggles).
- Cards are flat: a `surface` fill with a 1px `line` border and no shadow. `shadow-sm` is for selected segments and thumbs, `shadow-md` for toasts, menus and the mini-player, and `shadow-lg` for sheets and dialogs. Don't use coloured left-border accents on cards.

## Motion

`dur-instant` 80ms (press) · `dur-fast` 140ms (hover, focus, chips) · `dur-base` 240ms (toasts, banners) · `dur-slow` 400ms (context crossfade, reorder, sheets) · `dur-gauge` 600ms (gauge and number tweens) · `dur-breath` 8s (break breathing). Use `ease-out` for things that arrive and for tweens, `ease-standard` for most UI, and `ease-in-out` for the breathing disc and reorders. Under `prefers-reduced-motion`, tweens jump, reorders swap, the breathing disc stops, and the skeleton sweep becomes a static fill.

## Iconography

Use **Lucide** (`lucide-react`) throughout, at 1.75px stroke, 16px inline, 20px in nav and tiles, and 24px in empty states. Never use emoji. Icons inherit `currentColor`.

| Where | Icons |
|---|---|
| Nav | `Gauge` Now · `Timer` Focus · `ListChecks` Tasks · `History` History · `ChartColumn` Insights · `Settings` Settings · `Menu` More |
| Directives | `Coffee` · `BellOff` · `ShieldCheck` · `ListTodo` · `Timer` · `ChevronsDown` · `Mountain` · `Bell` |
| Sources | `Globe` Browser · `Code` VS Code · `Monitor` Desktop agent · `GraduationCap` LMS |
| Status | `CircleCheck` · `CircleAlert` · `WifiOff` · `Info` · `LoaderCircle` |

The icons in these previews are hand-drawn approximations of the Lucide glyphs, made so the previews run without a build step. In the app, import the real components from `lucide-react`. Some older names in the preview code map to current Lucide names: `bar-chart` → `ChartColumn`, `alert-circle` → `CircleAlert`, `check-circle` → `CircleCheck`, `more-vertical` → `EllipsisVertical`, `grip` → `GripVertical`. The VS Code status bar uses codicons instead (see **VSCodeStatusBar**).

## Logo

The mark is the node graph from the Android launcher icon: a centre node joined to five outer nodes. In the app, draw it in `accent` on any surface. On the launcher, use `#a0a0ff` nodes and `#6666cc` lines on `#0d0d1f`, as in `assets/Logos/clr-mark.svg`. Pair it with the name "Cognitive Load Router" in `label` weight 600. Don't redraw or recolour the nodes individually.

## Focus and accessibility

- Every interactive element shows a 2px `focus-ring` outline with a 2px offset on `:focus-visible`. Never remove it.
- Touch targets are at least `touch-target` (44px). Small visuals get padded hit areas.
- Text contrast is 4.5:1 and UI parts 3:1 in both themes. The one known exception is light-mode `ctx-shallow-work-chart` on `surface-sunken` (2.6:1), so keep series on `surface`.
- The gauge is a `role="meter"` with `aria-valuetext` such as "Load 62 percent, deep focus, confidence 80 percent". Live regions announce context changes and threshold crossings, never every tick.
- Charts have an `aria-label` summary and a table view.

## Layout and navigation

- Desktop: a left sidebar (`sidebar-width` 248px) with the live mini-gauge and connection status always visible, over a 12-column grid with 24px gutters, 32px page padding and `content-max` 1200px. From 768 to 1279px the sidebar collapses to a 72px rail.
- Mobile (under 768px): a top bar with the live load pill, and a bottom tab bar (Now, Focus, Tasks, Insights, More) that respects the gesture-bar safe area. History lives in Insights; Settings is under More.
- A running focus session or Pomodoro is always visible: the mini-player above the tab bar on mobile, or the timer row in the sidebar on desktop.

## Porting to the codebase

`tokens.css` (compiled from `tokens.json`) defines every token as a CSS custom property: dark on `:root, [data-theme="dark"]` and light on `[data-theme="light"]`. Import it once in `main.tsx` and set `data-theme` on `<html>` from the user's choice, falling back to `prefers-color-scheme` and then dark. Use the variables in CSS Modules (`color: var(--ink-muted)`). Rename the `clr-` classes in `bundle.css` to module-local names as you port each component. Self-host Geist with `@fontsource/geist` and `@fontsource/geist-mono` so the Android build works offline. Prop contracts are in `components/index.d.ts`.
