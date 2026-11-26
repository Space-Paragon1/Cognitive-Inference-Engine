Home: the live gauge, breakdown, directives, recommended next task, quick actions and today at a glance.

**Maps to** `LoadGauge`, `StatsCard`, `DirectivesFeed`, `TaskQueue` (first item) and `ControlPanel` (quick actions).

## Desktop 1440 (12-column grid)
- Row 1: hero card (8 columns) with the 280px gauge on the left; on the right, the context name, its one-line blurb, confidence and the `Breakdown`. Beside it, the directives feed ("What CLR is doing", 4 columns).
- Row 2: Quick actions (4), Today at a glance (4), Up next (4).
- Top bar: greeting ("Good evening"), the date and today's focus so far, Live status, a Do Not Disturb toggle and "Start focus".

## Mobile 390
Single column: top bar with load pill → hero (220px gauge, context, blurb, sources) → quick actions as a 3-up grid → breakdown → directives → up next → today. The mini-player docks above the tab bar while a timer runs.

## Live behaviour
The gauge, breakdown and context colour update every 2 s (see `LoadGauge`). The directive feed and up-next card update only when their content changes. The page itself never re-lays out on a tick.

## States
See **ScreenStates** for loading, reconnecting, offline, no data yet, low confidence and error.
