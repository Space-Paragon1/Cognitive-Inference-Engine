The adaptive Pomodoro: a ring countdown with session dots and a line that explains why the session is this long.

**Maps to** `ControlPanel`. Props: `TimerProps`.

## Use
- The number is `num-timer` (64px desktop, 56px mobile), tabular, in `mm:ss`. The ring shows the time remaining and drains clockwise from 12 o'clock.
- Under the ring: four session dots (filled = done, ringed = current) and the phase label (Focus, Short break, Long break).
- **Why this length** is always visible during a focus phase: "15 min because your load is high (78%)." Lengths are 10 min (fatigued), 15 (high), 25 (normal) and 35 (low). The length is chosen when the phase starts and doesn't change mid-session.
- Controls: Pause/Resume (primary), Skip, Stop. Idle shows a single "Start Pomodoro" button and the length it would pick right now.

## Breaks
Break phases switch to the rest palette (`--rest-*`): a calmer blue-grey surface, `rest-accent` for the ring and dots, and a slow breathing disc (`--dur-breath`, 8 s). No load numbers on break screens. Rest means rest.

## Motion
The ring updates once a second with a linear 1 s transition. Phase changes crossfade over `--dur-slow`. Under reduced motion the ring steps and the breathing disc holds still.

## Accessibility
`role="timer"` with `aria-label="Focus, 11 minutes 24 seconds left"`. Update the label each minute, not each second. Fire haptics (Capacitor) on start, pause and phase end.
