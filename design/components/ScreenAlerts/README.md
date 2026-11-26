Context-change toasts, the overload warning, break prompts, and the same messages as Android notifications.

**Maps to** the alert logic in `App.tsx`. Built from `Toast`, `BottomSheet` and the Android notification mock.

## Desktop: overload
The Now screen in the fatigue context. The overload toast sits bottom-right: "Your load has been high for a while", with "Take 5 minutes" and "Not now". Warm fatigue tones; never alarm red.

## Mobile
- Context change: a toast slides down under the status bar. "Deep focus activated. You are in the zone. Notifications are silenced."
- Android shade: the ongoing timer notification with progress and Pause/Stop, the overload warning with two actions, and a silent context-change notice.
- Break prompt as a bottom sheet when the app is open, with the suggested length (5 min short break / 15 min long break / Skip).

## Rules
- Overload fires after 3 consecutive ticks above the fatigue threshold, then holds for 5 minutes before it can repeat.
- Context-change toasts fire only when a context holds for 3 ticks, so a flicker doesn't spam the student.
- Do Not Disturb mutes everything except the timer ending.
