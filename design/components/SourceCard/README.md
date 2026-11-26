A card for one data source (Browser extension, VS Code, Desktop agent, LMS) in one of three states: not connected, waiting with a pairing code, or connected.

**Maps to** the onboarding Connect step and Settings › Connected sources. Props: `SourceCardProps`.

## Use
- Header: source icon (`Globe`, `Code`, `Monitor`, `GraduationCap`), name, an optional "Recommended" or "Optional" tag, and a one-line description of what it reads and what it never reads ("Tab switches and scrolling. Never page text.").
- **Not connected**: a "Connect" button.
- **Waiting**: the pairing code in `code` style (Geist Mono, wide tracking) with copy and QR buttons, a spinner with "Waiting for Browser… code expires in 4:32", and "Cancel".
- **Connected**: a `--positive` dot, "Connected · last seen 12s ago", and a ghost "Disconnect".
- The app works with any mix, so Continue is never blocked on a source.

## Accessibility
The waiting line is a `role="status"` live region, so "Connected" is announced when pairing succeeds. The copy button confirms with "Copied".
