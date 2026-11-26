Shows whether the engine is live and which sources are sending data right now.

**Maps to** the status line in the sidebar, the Now hero, and the extension popup footer. Props: `ConnectionStatusProps`.

## Use
- Status dot plus word: **Live** (`--positive`), **Reconnecting…** (`--caution`, spinning ring), **Offline** (`--ink-subtle`, `WifiOff`).
- Follow the status with source chips: Browser, VS Code, Desktop agent, LMS. A connected source has a filled dot; a missing one is struck through in `--ink-subtle`.

## Behaviour
- Go to Reconnecting after one missed tick (more than 4 s since the last message). Go to Offline after 30 s or on a socket close. Back to Live on the next message.
- Don't flash: hold Reconnecting for at least 1 s once it appears.

## Accessibility
Wrap it in `role="status"` so changes are announced politely. The dot is decorative; the word carries the meaning.
