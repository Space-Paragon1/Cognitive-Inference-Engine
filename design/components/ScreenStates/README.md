The system states every screen needs: loading, reconnecting, offline, no data yet, low confidence and error.

Built from `Skeleton`, `Banner`, `EmptyState`, `LoadGauge` and `ConnectionStatus`.

## No data yet (desktop)
The most important empty state. The gauge shows an empty track and a dash, never 0%. The hero becomes "Connect a source to see your load" with the browser extension as the first step and the other sources below. Tasks, timers and quick actions stay fully usable.

## Mobile, row 1
- **Loading**: skeletons in the real layout, shown only after 300 ms.
- **Reconnecting**: a caution banner ("Reconnecting… Showing your last reading from 9:58 pm."), stale numbers dimmed, and the status pill spinning.
- **Offline**: a neutral banner ("You are offline. Timers and tasks still work. Live load is paused.") with "Retry"; the gauge greys out with "Last reading 9:58 pm, 4 minutes ago".

## Mobile, row 2
- **Low confidence**: dotted arc, `≈47%`, outlined "Warming up" pill, a "Still learning how you work today" banner, and "Rough" on the breakdown.
- **Error**: a full-card error ("Something went wrong on our side. Your data is safe. We could not load your history just now.") with a small error code, "Try again" and "Report", plus an inline banner for a failed save ("Couldn't save your task. Check your connection." with "Retry").
- **No data yet**: the mobile version of the desktop state.

## Rules
Never blank a screen that already has data. Show stale data dimmed with its time, and let timers keep running locally.
