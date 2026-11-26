The live 5-minute load chart, timeline replay of a past session, session stats and the event log.

**Maps to** `CognitiveTimeline` and `TimelineReplay`. Built from `ChartStyle`, `PlaybackControls`, `StatTile`, `SegmentedControl` (filter chips) and the table.

## Desktop
- Row 1 (8 + 4): live load chart for the last 5 minutes with threshold lines; next to it, the session list (date, duration, average load, dominant context as a mini ring).
- Row 2 (12): replay of the selected session. A chart coloured by context, with a playhead and the unplayed part dashed, `PlaybackControls` under it, and four stats (duration, events, average load, peak).
- Row 3 (12): event log table (time, source, event, load, context pill) with context filter chips and "Export CSV".

## Mobile
History lives inside Insights behind a Week | History switch. Screens: live chart plus session list → session replay → event log with filter chips.

## Notes
Replay steps one tick (2 s) at a time. Speeds are 1×, 2×, 5× and 10×. The log follows the playhead while playing, and selecting a log row seeks to it.
