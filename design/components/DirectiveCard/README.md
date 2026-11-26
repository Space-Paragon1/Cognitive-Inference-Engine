One thing the engine is doing or suggesting right now: icon, short label, and the reason in plain words.

**Maps to** an item in `DirectivesFeed`. Props: `DirectiveCardProps`, `DirectivesFeedProps`.

## Use
- Label from the fixed vocabulary, e.g. "Notifications silenced". Reason written as what CLR is doing for you, e.g. "Protecting your deep-focus window." Never blame.
- Sort by `priority`, 1 first. Show up to 4 on Now and "View all" beyond that.
- One optional action per card ("Pause", "Edit", "Start break"). In narrow columns the action drops under the text (container query at 460px).

## Icons and tone
| Type | Label | Lucide | Tone |
|---|---|---|---|
| `recommend_break` | Take a break | `Coffee` | rest |
| `suppress_notifications` | Notifications silenced | `BellOff` | accent |
| `block_distracting_tabs` | Distracting tabs blocked | `ShieldCheck` | accent |
| `suggest_task` | Suggested task | `ListTodo` | accent |
| `shorten_focus_interval` | Shorter focus session | `Timer` | fatigue |
| `delay_hard_tasks` | Hard tasks deferred | `ChevronsDown` | shallow work |
| `schedule_hard_task` | Good time for hard work | `Mountain` | deep focus |
| `allow_notifications` | Notifications OK | `Bell` | positive |

## Motion
A new directive fades and rises 4px in over `--dur-base`, and its card carries a soft accent wash for 4 s. One that is removed fades out. Animate with FLIP so the cards below slide rather than jump.

## Empty state
"All clear": `CheckCircle` in `--positive-soft`, then "Nothing needs adjusting right now. CLR will step in if your load changes."

## Accessibility
The feed is a `<ul>` with an `aria-live="polite"` region that announces only new directives ("Notifications silenced: protecting your deep-focus window").
