An inline notice at the top of a card or screen: reorder explanations, low confidence, reconnecting, offline and errors.

**Maps to** notices in `TaskQueue`, `LoadGauge` and every screen's system states. Props: `BannerProps`.

## Use
- One line of bold title and one of body, an icon, and at most one action. Sits above the content it describes, full width of its container.
- Tones: `accent` for information ("Load is high (78%), so easier tasks are on top."), `caution` for reconnecting, `neutral` for offline, `critical` for errors, or a `context` tint when it explains a context.
- Errors say what happened and what to do next: "Couldn't save your task. Check your connection." with "Retry".

## Accessibility
`role="status"`, or `role="alert"` for errors. A close button, when present, has `aria-label="Dismiss"`.
