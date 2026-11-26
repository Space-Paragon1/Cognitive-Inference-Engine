A row of mutually exclusive options, plus the context filter chips used in the event log.

**Maps to** the difficulty picker, playback speed, the theme switch, Week/History on mobile Insights, and the log filters. Props: `SegmentedControlProps`, `FilterChipProps`.

## Use
- Segmented: 2–5 short options. The selected one gets `--surface-raised` and `--shadow-sm` on a `--surface-sunken` track.
- Filter chips: multi-select, each with the context's icon and label, and a count when it helps. Selected chips fill with the context's soft colour and show a check. "All" clears the filter.

## Accessibility
Segmented is a `role="radiogroup"` with arrow-key movement. Filter chips are toggle buttons with `aria-pressed`.
