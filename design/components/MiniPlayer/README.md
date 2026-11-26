The running timer as a slim bar, so a focus session or Pomodoro is visible from every screen.

**Maps to** a new shared component used by the app shell. Props: `MiniPlayerProps`.

## Use
- Mobile: docked 8px above the tab bar, `--miniplayer-height` 56px, `--z-miniplayer`. Desktop: a compact row in the sidebar above the account.
- Contents: phase icon, label ("Focus · 11:24 left"), a 2px progress line along the bottom edge, and play/pause. Tapping anywhere else opens Focus.
- Hidden on the Focus screen itself and while idle.
- During breaks it uses the rest colours.

## Accessibility
The whole bar is a link to Focus with `aria-label="Focus, 11 minutes left. Open timer"`. The pause button is a separate 44px target.
