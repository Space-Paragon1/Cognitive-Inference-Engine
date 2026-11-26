Short in-app alerts for context changes, the overload warning and break prompts, plus how the same messages look as Android notifications.

**Maps to** the alert layer in `App.tsx` (CTX_MESSAGES and the overload counter). Props: `ToastProps`.

## Use
- Context change: "Deep focus activated" / "You are in the zone. Notifications are silenced until you surface." Icon tile in the context's soft colour. Auto-dismisses after 6 s.
- Overload: fires when load stays above the fatigue threshold for 3 ticks. "Your load has been high for a while" / "It has stayed above 85% for 6 minutes. A short break now usually makes the next stretch easier." Actions: "Take 5 minutes" and "Not now". Uses fatigue tones, never red. It stays until the student acts, and after "Not now" it can't repeat for 5 minutes.
- Break prompt: "Break time" / "Focus session 3 is done. Your 5-minute break starts when you are ready." with "Start break" and "Skip".
- Position: bottom-right on desktop (above the content, 24px in) and top on mobile (under the status bar). At most 2 visible; newer ones push older ones up. `--z-toast`.
- Enter: fade and 8px rise over `--dur-base`. Exit: fade over `--dur-fast`.

## Android
Use Capacitor Local Notifications with the same title and body. The running timer is an ongoing notification with a progress bar and Pause/Stop actions. Overload and break prompts carry two actions. Context changes are silent (no sound, no vibration) unless the student turns them on.

## Accessibility
`role="status"` for context changes and `role="alert"` for the overload warning. Pause the auto-dismiss on hover or focus. Each action is a real button.
