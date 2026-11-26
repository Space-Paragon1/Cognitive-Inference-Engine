The desktop sidebar with the brand, the always-visible live mini-gauge and connection status, the six sections, the running timer, and the account.

**Maps to** the desktop app shell. Props: `SidebarProps`.

## Use
- Width `--sidebar-width` 248px at 1280px and up; a 72px icon rail (`--rail-width`) from 768 to 1279px. Below 768 it's replaced by the tab bar.
- From top to bottom: logo and name; a live card (40px mini-gauge, context pill, Live status and source count); nav (Now, Focus, Tasks, History, Insights, Settings, with a count badge on Tasks); the running-timer row when a session is active; then the account (avatar, email, theme switch).
- Active item: `--accent-soft` fill and `--accent` text and icon.
- In the rail, the live card shrinks to the ring alone with a tooltip.

## Accessibility
`<nav aria-label="Main">`, `aria-current="page"`. The live card is a link to Now with the gauge's full `aria-valuetext`.
