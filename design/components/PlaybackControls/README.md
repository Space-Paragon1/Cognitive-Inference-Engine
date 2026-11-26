Transport for timeline replay: jump to start, step back, play/pause, step forward, jump to end, plus a speed switch.

**Maps to** `TimelineReplay`. Props: `PlaybackControlsProps`.

## Use
- Order: `SkipBack` start · `ChevronLeft` step · Play/Pause (round, primary, 48px) · `ChevronRight` step · `SkipForward` end. Then the time (`9:22 / 48:00`) and a `SegmentedControl` for 1×, 2×, 5× and 10×.
- One step is one engine tick (2 s of session time).
- A scrubber above the controls; dragging it pauses playback.

## Keyboard
Space plays and pauses, ← and → step, Home and End jump, and 1, 2, 5, 0 set the speed.

## Accessibility
Each control has an `aria-label` ("Step back 2 seconds"). The scrubber is a `role="slider"` with `aria-valuetext="9 minutes 22 seconds of 48"`.
