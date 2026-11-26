Buttons in four variants (primary, secondary, ghost, danger) plus a rest variant for break screens, in three sizes, with loading and disabled states.

**Maps to** buttons across `LoginPage`, `ControlPanel` and `SettingsPanel`. Props: `ButtonProps`.

## Use
- **Primary** (`--accent` fill, `--on-accent` text): one per view, for the main action (Start focus, Sign in).
- **Secondary** (`--surface-raised`, `--line` border): the alternatives (Add task, Export CSV).
- **Ghost**: low-emphasis actions in toolbars and cards (Skip break, Not now).
- **Danger** (`--critical` fill): destructive actions only, such as Delete my data, and only inside a confirmation step.
- **Rest** (`--rest-accent`): primary actions on break screens.
- Sizes: `lg` 52px (auth, onboarding), `md` 44px (default), `sm` 36px with the hit area padded to 44px.
- Labels are verbs in sentence case: "Start focus", not "START" or "Focus Mode".

## States
Hover (`-hover` fill), pressed (scale 0.98 for `--dur-instant`), focus (2px `--focus-ring` outline with a 2px offset), loading (spinner plus `loadingLabel`, e.g. "Signing in…"; width stays fixed; `aria-busy`), disabled (40% opacity, `aria-disabled`, keep it focusable when you need to explain why).

## Accessibility
Icon-only buttons need `aria-label`. Toggling buttons such as Do Not Disturb use `aria-pressed`.
