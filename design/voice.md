# Voice and copy

CLR talks like a calm coach sitting next to the student: short, plain, second person, never judging. Use this deck as the source for UI strings; it matches the mockups word for word.

## Rules

- Write in the second person and present tense. "You are in the zone." not "User has entered deep focus."
- Use sentence case everywhere. No exclamation marks, no emoji, no ALL CAPS (the overline style uppercases with CSS).
- Make CLR the subject when it acts: "CLR silenced notifications" or simply "Notifications silenced". Never "You switched tabs 14 times".
- Load is information. Say "high", "rising" or "easing", never "bad", "too much" or "failed".
- Always give a reason, and keep it under about 12 words when you can.
- Numbers are tabular, with a percent sign and no space (62%). Durations are "25 min", "1 h 48 m" or "11:24". Times are "9:42 pm".
- Explain jargon once, in the same line: "Extraneous: distraction and switching between tabs and windows."

| Instead of | Write |
|---|---|
| Overload detected! | Your load has been high for a while |
| You failed to focus | Your attention is spread across tabs. Good for lighter tasks. |
| No data found | Connect a source to see your load |
| Error 503 | Something went wrong on our side. Your data is safe. |
| Are you sure? | Delete everything? This cannot be undone. |
| Invalid email | Add the rest of your email, like sam@uni.edu. |

## Contexts

| Label | Blurb |
|---|---|
| Deep focus | Little switching, steady effort. This is your flow zone. |
| Shallow work | Your attention is spread across tabs. Good for lighter tasks. |
| Stuck | The same errors keep coming back. A fresh angle might help. |
| Fatigue | Load has stayed high for a long stretch. Resting counts as progress. |
| Recovering | Load is easing after a hard stretch. Ease back in gently. |
| Warming up | Still learning how you work today. Give it a minute or two. |

## Directives

| Label | Example reason |
|---|---|
| Notifications silenced | Protecting your deep-focus window. |
| Distracting tabs blocked | Cutting extraneous load while you are in the zone. |
| Take a break | Load has been above 85% for 12 minutes. Five minutes away will help. |
| Suggested task | "Reply to group project thread" fits how you are doing right now. |
| Shorter focus session | Next Pomodoro is 15 min because your load is high (78%). |
| Hard tasks deferred | Linear Algebra moved down until your load settles. |
| Good time for hard work | Load is low (34%) and steady. A good window for the problem set. |
| Notifications OK | You are between sessions, so messages can come through. |
| All clear (empty) | Nothing needs adjusting right now. CLR will step in if your load changes. |

## Toasts and notifications

| Trigger | Title | Body | Actions |
|---|---|---|---|
| Context → deep focus | Deep focus activated | You are in the zone. Notifications are silenced until you surface. | — |
| Overload (3 ticks above fatigue) | Your load has been high for a while | It has stayed above 85% for 6 minutes. A short break now usually makes the next stretch easier. | Take 5 minutes · Not now |
| Focus phase ends | Break time | Focus session 3 is done. Your 5-minute break starts when you are ready. | Start break · Skip |
| Running timer (Android, ongoing) | Focus · 11:24 left | 25 min session, 2 of 4 done | Pause · Stop |
| Overload (Android) | Your load has been high for a while | Above 85% for 6 minutes. A short break could help. | Take 5 min · Not now |
| Context change (Android, silent) | Deep focus activated | Notifications are silenced until you surface. | — |
| Setting saved | Saved | — | — |

## Pomodoro and focus

- Why line: "15 min because your load is high (78%)." / "25 min because your load is in your normal range (62%). It updates when each session starts."
- Length scale: "10 fatigued · 15 high · 25 normal · 35 low".
- Break: "Short break · 3 of 4 done", "Step away for a few minutes.", "Breathe with the circle: in as it grows, out as it shrinks.", "Look at something 6 metres away for 20 seconds.", "Stand up and roll your shoulders.", "Next: 25 min focus. Your load has eased to 48%."
- Focus mode: "Ends at 10:31 pm · 19 min to go", "You can always let yourself through for 5 minutes."
- Blocked tab: "youtube.com is paused", "You're 31 minutes into a focus session.", "19 minutes to go. This will still be here at 10:31 pm.", "Back to work", "Let me through for 5 min", "Used 1 of 3 passes this session".

## Tasks

- High load: "Load is high (78%), so easier tasks are on top." / "Linear Algebra will move back up when you have more headroom."
- Low load: "Load is low (34%)." / "Harder tasks are first while you are fresh."
- How the order works: "Easy and review first" · "Medium first, hard close behind" · "Hard first, while you are fresh".
- Empty: "Nothing on your list" / "Add what is on your plate. CLR will put the right task on top for how you are doing."

## Empty states and system states

| State | Title | Body |
|---|---|---|
| No data yet | Connect a source to see your load | CLR reads how you work, not what you work on. The browser extension takes about a minute to set up. |
| No sessions | No sessions to replay | Sessions appear here after your first 10 minutes of tracked work. |
| Low confidence | Still learning how you work today. | Estimates firm up after about 2 minutes of activity. |
| Reconnecting | Reconnecting… | Showing your last reading from 9:58 pm. |
| Offline | You are offline. | Timers and tasks still work. Live load is paused. |
| Load error | Something went wrong on our side | Your data is safe. We could not load your history just now. |
| Save error | Couldn't save your task. | Check your connection. (Retry) |

## Auth

- Sign in: "Welcome back" / "Sign in to pick up where you left off."
- Failed sign-in: "That email and password do not match. Check both and try again."
- Create account: "Create your account" / "Takes a minute. Your data stays yours."
- Field errors: "Add the rest of your email, like sam@uni.edu." · "Use at least 8 characters."
- Forgot password: "Reset your password" / "We will email you a link to set a new one."
- Confirmation (always neutral): "Check your inbox" / "If that email is registered, a link has been sent. It works for 30 minutes."
- New password: "Strong. 12+ characters." · "Passwords match." · "If the link has expired, request a new one. Reset links last 30 minutes."

## Onboarding and privacy

- "Study with your brain, not against it" / "CLR estimates how mentally loaded you are, every 2 seconds, from how you work. Then it adjusts:"
- What CLR reads: tab and window switches (counts, not page content), typing rhythm and pauses, compile errors and their frequency, idle time and scrolling, LMS page visits.
- What it never reads: what you type, page text, grades, messages or passwords, your camera or microphone.
- Sources: "Tab switches and scrolling. Never page text." · "Compile errors and typing rhythm. Never what you type." · "Window changes and idle time." · "Canvas, Moodle or Blackboard activity."
- "1 source connected." / "Enough to start. Load estimates get steadier with 2 or more."
