How every chart in CLR is styled in Recharts: the live load line, replay, daily focus bars, context mix, and the best-hours heatmap.

**Maps to** `CognitiveTimeline`, `TimelineReplay` and `AnalyticsPanel`. Props: `ChartStyleProps`.

## Shared rules
- One y-axis, 0–100% for load. Grid: horizontal lines only, `--chart-grid`, 1px. Axis ticks in `caption`, `--ink-subtle`, no axis lines.
- Threshold lines at the user's high-load and fatigue values: 1px dashed `--chart-threshold`, labelled at the right edge ("High 70%", "Fatigue 85%").
- Series use `--ctx-*-chart` (or `--accent` for single-series bars). Text never takes a series colour: labels and values stay in `--ink` and `--ink-muted`.
- Put series on `--surface`, never on `--surface-sunken`, so light-mode shallow work keeps its contrast.

## Live load (CognitiveTimeline)
`<LineChart>` over the last 5 minutes (150 points). `strokeWidth={2}`, `type="monotone"`, `dot={false}`, `isAnimationActive={false}` (new points arrive every 2 s; animating each one jitters). A soft area fill under the line in the current context's `-soft` colour. The x-axis shows "−5 min" and "now".

## Replay (TimelineReplay)
Draw the line in segments coloured by context, with the played part solid and the unplayed part dashed at 50% opacity. The playhead is a 2px `--ink` line with a 10px dot on the curve, and a tooltip shows time, load and context.

## Daily bars and context mix (AnalyticsPanel)
`<BarChart>` with `radius={[4,4,0,0]}` and `maxBarSize={28}`. The best day gets `--accent` and a direct label ("3.4 h best"); the others get `--accent` at 55% opacity. In the stacked context mix, segments follow the fixed CTX order with a 2px `--surface` stroke between them, and a legend is always shown.

## Heatmap
Day × hour cells from `--heat-0` to `--heat-4`, 6px radius, 2px gaps, plus a "Less → More" legend. Mark it "Preview" until the backend sends hourly data.

## Interaction
Every chart has a tooltip (`--surface-inverse` background, `--ink-inverse` text, `--radius-sm`) and a crosshair on line charts. Hit targets are wider than the marks.

## Accessibility
Give each chart an `aria-label` summary and a "View as table" link. Contexts are named in the legend and tooltip, never by colour alone.
