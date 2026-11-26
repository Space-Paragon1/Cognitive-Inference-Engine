A sheet that rises from the bottom on mobile and becomes a centred dialog on desktop, used for add task, confirmations and break prompts.

**Maps to** a shared overlay used by `TaskQueue`, `SettingsPanel` and the alerts. Props: `BottomSheetProps`.

## Use
- Mobile: full width, `--radius-xl` top corners, a grab handle, title, body, and actions at the bottom (primary on the right). It respects the bottom safe area. `--shadow-lg`, `--z-sheet`, over a `--scrim` backdrop. No blur.
- Desktop (≥ 768px): a 480px-wide dialog, centred, same contents.
- Slide up over `--dur-slow` with `--ease-out`; the scrim fades over `--dur-base`.
- Destructive confirmations ask the student to type a word ("DELETE") before the danger button enables.

## Accessibility
`role="dialog"`, `aria-modal`, `aria-labelledby` on the title. Focus moves to the first field and is trapped inside; Esc and a scrim tap close it, except for destructive confirmations, where only Cancel closes it. Focus returns to the trigger. On Android, the hardware back button closes it.
