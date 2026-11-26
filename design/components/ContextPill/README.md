A small chip that names the student's current context with a colour, an icon and the exact label.

**Maps to** the context badge inside `LoadGauge`, `StatsCard` and the event log. Props: `ContextPillProps`.

## Use
- Always show all three signals: the colour, the Lucide icon and the word. Never use the colour on its own.
- Labels are fixed: Deep focus, Shallow work, Stuck, Fatigue, Recovering, Warming up (for `unknown`).
- Icons: `Target` deep focus, `Waves` shallow work, `Repeat` stuck, `BatteryLow` fatigue, `Leaf` recovering, `CircleDashed` warming up.

## What you provide
`context`. Add `uncertain` when confidence is below 50%, which outlines the pill with a dashed border. Use `plain` in tables.

## Colour
Fill `--ctx-<key>-soft`, icon and text `--ctx-<key>`. Both pass 4.5:1 in each theme. Stuck and fatigue use warm amber and rose, not red, so the app nudges rather than scolds.

## Accessibility
Plain text, read as-is. If the pill is the only context signal on a screen, give its container `aria-label="Context: Deep focus"`.
