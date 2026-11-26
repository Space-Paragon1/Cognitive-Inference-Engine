Three bars that split load into intrinsic, extraneous and germane, each with a one-line plain-English explanation.

**Maps to** part of `LoadGauge` / `StatsCard` on Now. Props: `BreakdownProps`.

## Use
- On Now, next to the gauge (desktop) or under it (mobile). In the extension popup use `compact`, which drops the explanations.
- Keep the order intrinsic, extraneous, germane. Keep the explanations as written. They are the first place the jargon gets explained.
  - Intrinsic: "How hard the task itself is: errors and uneven typing."
  - Extraneous: "Distraction and switching between tabs and windows."
  - Germane: "Productive effort: the sustained work that builds understanding."

## Colour
`--load-intrinsic` (violet), `--load-extraneous` (ochre), `--load-germane` (teal). These are deliberately not context colours, so a bar is never mistaken for a context. Each row also has a label and a percentage, so colour is never the only signal.

## Motion
Bar widths tween with the gauge (`--dur-gauge`, `--ease-out`). Under reduced motion they jump.

## States
Low confidence: add a "Rough" badge in the header and drop the bars to 60% opacity. No data: show the rows with empty tracks and "–".

## Accessibility
Each row is a `role="meter"` with `aria-valuetext="Extraneous 22 percent: distraction and switching"`.
