A compact number tile for KPIs and "today at a glance", plus the context-distribution bar.

**Maps to** `StatsCard`. Props: `StatTileProps`, `ContextBarProps`.

## Use
- Label on top in `caption`, then the value in `num-stat` with a smaller unit (`h`, `%`, `min`), then an optional `sub` line in `body-sm`.
- Use it for focus minutes, average load, sessions, best day and focus efficiency. Show 3 or 4 in a row on desktop and 2 per row on mobile.
- Trend arrows show direction only. Never colour them red or green: a higher average load isn't bad news.

## Context bar
A 10px bar split by share of time per context, in the fixed order deep focus → shallow work → stuck → fatigue → recovering → warming up, using `--ctx-*-chart` with a 2px `--surface` gap between segments. Always pair it with a legend (dot + label + %) or a tooltip.

## Accessibility
The tile reads as one sentence: `aria-label="Average load, 54 percent"`. Give the context bar an `aria-label` that lists the shares.
