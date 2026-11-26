A friendly placeholder for when there's nothing to show yet, with the next step as a button.

**Maps to** the empty cases in every panel. Props: `EmptyStateProps`.

## Use
- Icon in a soft tile, then a `title-3` title, one or two sentences in `body-sm` and `--ink-muted`, then one primary action and at most one secondary.
- **No data yet** (no sources connected) matters most. "Connect a source to see your load", a line on what CLR reads, then "Connect the browser extension" plus "See all sources". Tasks and timers stay usable around it.
- Others: "All clear" (directives), "Nothing on your list" (tasks, with "Add a task"), "No sessions to replay" (history: "Sessions appear here after your first 10 minutes of tracked work.").
- Write it as an invitation, never as an error. Never "No data found".

## Accessibility
The title is a heading at the right level for its container. Decorative icons are `aria-hidden`.
