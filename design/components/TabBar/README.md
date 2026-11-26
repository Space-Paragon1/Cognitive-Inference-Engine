The mobile bottom tab bar (Now, Focus, Tasks, Insights, More) and the mobile top bar with the live load pill.

**Maps to** the app shell on Android and narrow web. Props: `TabBarProps`.

## Use
- Five tabs, each a Lucide icon plus a `caption` label: `Gauge` Now, `Timer` Focus, `ListChecks` Tasks, `ChartColumn` Insights, `Menu` More. The active tab gets an `accent-soft` pill behind its icon and `--accent` text.
- Height `--tabbar-height` (64px) plus `env(safe-area-inset-bottom)` for the gesture bar. `--z-nav`.
- History sits inside Insights (a Week | History switch). Settings, connected sources, account and help are under More.
- **Top bar**: `--mobile-topbar-height` 56px under the status bar, with the title on the left and the live load pill plus a `Bell` on the right. The pill is always visible and opens Now.

## Accessibility
A `<nav aria-label="Main">` with `aria-current="page"` on the active tab. Each tab is at least 44 × 44px.
