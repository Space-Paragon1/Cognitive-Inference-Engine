An on/off switch with a check mark in the thumb, so the state never depends on colour alone.

**Maps to** the switches in `ControlPanel` (block distracting tabs, Do Not Disturb) and `SettingsPanel` (notifications). Props: `ToggleProps`.

## Use
- On: `--accent` track, thumb with a `Check`. Off: `--line-strong` outline, empty thumb.
- In Settings use the `row` layout: label and description on the left, switch on the right, and the whole row is the hit target.
- It takes effect immediately. Never pair a toggle with a Save button.

## Accessibility
A `<button role="switch" aria-checked>` or a styled checkbox. The label is required even when it's visually hidden. The thumb slides over `--dur-fast`.
