The live centrepiece: a 270° arc that shows load from 0 to 100%, the current context, and how sure CLR is.

**Maps to** `LoadGauge`. Props: `LoadGaugeProps` in `index.d.ts`.

## Use
- One hero gauge per screen, on Now only. Everywhere else use the `mini` ring (sidebar, popup) or the `pill` (mobile top bar).
- Sizes: 280px desktop hero, 220px mobile hero, 84px popup, 40px sidebar, 28px top-bar pill.
- Feed it the `CognitiveState` from the WebSocket every 2 s. The component handles the motion; never re-mount it per tick.

## What you provide
`load` (0–1 or `null`), `context`, `confidence`, and the user's `thresholds` from Settings so the ticks sit at their own high-load and fatigue values.

## Anatomy
Track in `--line`; a soft halo in `--ctx-*-soft`; the arc in `--ctx-*`; two ticks at the thresholds in `--chart-threshold`; the number in `num-gauge` with a small `%`; caption "load"; the `ContextPill` below.

## Motion
- Arc length and number tween over `--dur-gauge` (600ms) with `--ease-out`, so each tick settles well before the next one arrives. Interrupt and retarget from the current value; never queue.
- Round the displayed number to whole percent and skip the tween when the change is under 1 point, so it doesn't twitch.
- A context change crossfades the colour over `--dur-slow` (400ms) and swaps the pill.
- Under `prefers-reduced-motion` the arc and number jump straight to the new value.

## States
- **Low confidence (< 50%)**: the arc becomes dotted, the number gets a `≈` prefix, the caption reads "rough estimate", and the pill is outlined. It should look less certain without looking broken.
- **No data yet**: empty track, a dash instead of a number, caption "no data yet". Never show 0%: that reads as a measurement.
- **Stale** (reconnecting or offline): keep the last value at 60% opacity and show "Last reading 9:58 pm" under it.

## Accessibility
`role="meter"`, `aria-valuemin=0`, `aria-valuemax=100`, `aria-valuenow`, and `aria-valuetext="Load 62 percent, deep focus, confidence 80 percent"`. Don't announce every tick: put a separate `aria-live="polite"` region next to it that only speaks when the context changes or load crosses a threshold.
