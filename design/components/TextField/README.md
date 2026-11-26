A labelled text input with an icon, help text, inline error and valid states, and a password reveal.

**Maps to** the inputs in `LoginPage` and the add-task form. Props: `TextFieldProps`.

## Use
- The label always sits above the field. Placeholders are examples ("you@university.edu"), never the label.
- Height 48px, `--radius-md`, `--surface` fill, `--line` border. Focus: `--accent` border plus a 3px `--accent-soft` ring.
- On mobile, input text is 16px so Android doesn't zoom.
- Validate on blur, then live while the student fixes the error. The error replaces the help text, sits under the field in `--critical` with an `AlertCircle`, and says how to fix it: "Add the rest of your email, like sam@uni.edu."
- Password: an `Eye` / `EyeOff` reveal button, and a strength meter on create and reset only.

## Accessibility
`<label for>`, `aria-invalid`, and `aria-describedby` pointing at the help or error. The error has `role="alert"`. Set `autoComplete` (`email`, `current-password`, `new-password`).
