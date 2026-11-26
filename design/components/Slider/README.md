A Settings slider with the current value, its default marked as a tick, "Reset to default", and a hatched range it can't enter.

**Maps to** `SettingsPanel`. Props: `SliderProps`.

## Use
| Setting | Range | Default |
|---|---|---|
| Short break | 1–15 min | 5 |
| Long break | 5–40 min | 15 |
| High load | 50–95% | 70 |
| Fatigue | 60–99% | 85 |
| Session gap | 2–60 min | 10 |

- Label left, value right (`num-inline`, tabular). Min and max sit under the track; the default is a small tick on the track.
- "Reset to default" appears only when the value differs from the default.
- **Constraint:** fatigue must stay above high load. Hatch the fatigue range at or below the high-load value plus 1 (`blockBelow`), and stop the thumb there. The help line explains it: "Can't go below 71%. Default 85%." Moving high load up pushes the fatigue floor up live.
- Save on release, with a "Saved" toast and a debounced PUT. Don't save on every drag event.

## Accessibility
Use a native `<input type="range">` styled with CSS, with `aria-valuetext="High load 70 percent"`. Arrow keys step by 1, Page Up/Down by 5. The thumb's hit area is 44px.
