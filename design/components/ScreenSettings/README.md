Settings: Pomodoro lengths, load thresholds with their constraint, session gap, notifications, connected sources, account and privacy.

**Maps to** `SettingsPanel`. Built from `Slider`, `Toggle`, `SourceCard`, `BottomSheet` and `Button`.

## Desktop
A section list on the left (Pomodoro, Load thresholds, Sessions, Notifications, Connected sources, Account, Privacy) and one card per group on the right. Changes save on their own and show a "Saved" indicator in the top bar. There's no Save button.

## Load thresholds
A strip above the sliders shows the three zones (Normal, High, Fatigue) at the current values. The fatigue slider hatches the range it can't enter, and its help line explains the rule.

## Privacy
"Export my data" downloads JSON and CSV. "Delete my data" opens a confirmation sheet that asks the student to type DELETE, explains that it cannot be undone, and offers "Keep my data" as the safe default.

## Mobile
A More tab (History, Settings, Connected sources, Help; theme switch; account; sign out) → Settings with grouped rows → Privacy with the delete confirmation sheet.
