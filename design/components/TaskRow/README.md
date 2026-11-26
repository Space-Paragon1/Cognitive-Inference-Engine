One task in the queue: done check, title, difficulty, estimate and tags, with a highlighted state for the one CLR recommends now.

**Maps to** an item in `TaskQueue`. Props: `TaskRowProps`.

## Use
- Title on one line on desktop; up to two lines in narrow columns. Then a meta row with the `DifficultyChip`, `Clock` + minutes, and `#tags`.
- **Recommended** row: accent border, `accent-soft` fill, a "Best fit right now" eyebrow, and a Start button. There's at most one per list, and it is always the first row.
- After a reorder, rows that moved show an arrow chip ("↑2", "↓1") for 4 s, then it fades.

## Reorder rule
High load or fatigue (at or above the student's high-load threshold): easy and review first, hard last. Normal: medium first, hard close behind. Low load (under 40%): hard first, while the student is fresh. The `TaskQueue` banner explains the current rule in one line, and an Auto order | My order switch lets the student turn reordering off.

## Motion
Animate reorders with FLIP over `--dur-slow` and `--ease-in-out`. Reorder at most once every 30 s, and never while the pointer or focus is inside the list, so nothing jumps out from under the student. Under reduced motion, rows swap instantly and the arrow chips stay.

## States
Default, recommended, moved, done (strikethrough, 60% opacity, drops to the bottom), dragging (`--shadow-md`).

## Accessibility
The row is an `<li>` with a real checkbox ("Mark Linear Algebra problem set 4 done"). Announce reorders once through the banner's live region, not per row.
