The task queue, reordered by current load, with an explanation banner, the recommended task, add task, and the empty state.

**Maps to** `TaskQueue`. Built from `TaskRow`, `DifficultyChip`, `Banner`, `BottomSheet` and `EmptyState`.

## Desktop
- Main column (8): "Your queue · 4 tasks · 2 h" with an Auto order | My order switch, then the banner ("Load is high (78%), so easier tasks are on top. Linear Algebra will move back up when you have more headroom."), the list with the recommended row first, and a collapsed "Done today (2)".
- Side column (4): the add-task form (title, difficulty segmented control, minutes, tags) and a "How the order works" card: high load or fatigue → easy and review first; normal → medium first, hard close behind; low → hard first, while you are fresh.

## Mobile
Low-load order ("Load is low (34%). Harder tasks are first while you are fresh.") → Add task as a bottom sheet → empty state.

## Reorder animation
FLIP over `--dur-slow`. The arrow chips ("↑2") show for 4 s. Reorders are throttled to once every 30 s and paused while the student is interacting with the list.

## Empty state
"Nothing on your list" / "Add what is on your plate. CLR will put the right task on top for how you are doing." with "Add a task".
