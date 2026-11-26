# Design brief: Cognitive Load Router

Design a complete UI for **Cognitive Load Router (CLR)**, a study companion that works out how mentally loaded a student is right now, then protects their focus, times their breaks, and reorders their tasks to match. The design will be handed to Claude Code and built into an existing React codebase, so it needs to be practical to implement as well as good-looking.

---

## 1. What the product does

Small plugins watch how a student works: tab switches, window changes, compile errors, typing rhythm, scrolling, idle time, and activity in Canvas, Moodle or Blackboard. Every 2 seconds the engine turns those signals into:

- a **load score** from 0 to 100%
- a **context**, meaning what state the student is in (see below)
- a **confidence** score from 0 to 100%, showing how much data the estimate is based on
- a **breakdown** into three parts from Cognitive Load Theory:
  - **Intrinsic**: how hard the task itself is (errors, typing variance)
  - **Extraneous**: distraction and switching (tab and window churn)
  - **Germane**: productive effort (sustained engagement)

A rules engine then issues **directives**, such as silencing notifications, blocking distracting tabs, suggesting a break, or saying "now is a good time for hard work". The task queue reorders itself to put easier work first when load is high and harder work first when load is low. The Pomodoro timer adjusts its length to current load: 10 min when fatigued, 15 when load is high, 25 normally, 35 when load is low.

**Who it's for:** university students, especially those doing coding-heavy or technical courses, studying on a laptop with an Android phone nearby.

**What it should feel like:** a calm, trustworthy coach. It should not feel like a productivity tracker that makes people anxious. A high load score is information, never a failure grade. The product should feel smart and grounded in science, but warm and easy to understand.

---

## 2. Platforms and surfaces

| Surface | Size | Notes |
|---|---|---|
| **Web dashboard** | Desktop 1440 and 1024 wide, tablet 768 | Main experience |
| **Android app** | 360–412 wide | The same React app running inside Capacitor. Uses native local notifications and haptics, and respects safe areas and the gesture bar |
| **Browser extension popup** | About 360 × 520 | Mini live gauge, current context, focus toggle, connection status |
| **Blocked-tab overlay** | Full page | Shown over distracting sites during focus mode. Should be gentle, with a "let me through for 5 min" escape |
| **VS Code status bar item** | One line | Text plus an icon, e.g. `◉ 62% Deep focus`. Just specify the format and colours |

Design desktop and mobile versions of every main screen. Mobile is not an afterthought, because many students will open the app on their phone.

---

## 3. Screens to design

### A. Authentication
- Sign in, Create account, Forgot password ("send reset link"), Set new password (arriving from the email link).
- Include inline validation errors, loading button states, and the "if that email is registered, a link has been sent" confirmation.

### B. Onboarding and connecting sources (new)
Right now the app looks empty unless the student installs the plugins, so this flow matters a lot.
- 3–4 steps: what CLR does, then what data is collected and what isn't (privacy promise: no keystroke content, no page text), then connecting sources, then turning on notifications.
- **Connect sources:** cards for the Browser extension, VS Code, the Desktop agent and the LMS connector. Each card has three states: not connected, waiting (with a pairing code to copy or scan), and connected (with "last seen 12s ago").
- The student can skip, and the app still works with only some sources connected.

### C. Now (home)
The screen people will look at most.
- **Live load gauge:** a large, beautiful centrepiece showing the percentage, the context name with an icon, and confidence (low confidence should look visibly "less certain", for example faded or dashed). It updates every 2 seconds and has to animate smoothly without jitter.
- **Breakdown** of intrinsic, extraneous and germane, each with a one-line plain-English explanation.
- **Live / Offline** connection indicator, plus which sources are sending data right now.
- **Directives feed:** what the engine is doing or suggesting right now, each with an icon, a short label and a reason. Example: "Notifications silenced: protecting your deep-focus window." It has an "All clear" empty state.
- **Recommended next task**, pulled from the task queue.
- **Quick actions:** Start focus, Start Pomodoro, Do Not Disturb.
- **Today at a glance:** focus minutes, average load, number of sessions, plus a small context-distribution bar.

### D. Focus and timer
- **Focus mode:** set a duration and a "block distracting tabs" toggle, then see an active state showing elapsed vs total time, with a Stop button.
- **Adaptive Pomodoro:** phases are Idle, Focus, Short break and Long break. Show remaining time, sessions completed (e.g. dots), and **why this length**: "15 min because your load is high (78%)."
- Break screens should feel restful and different from work screens.

### E. Tasks
- Add a task: title, difficulty (easy, medium, hard, review), estimated minutes, tags.
- The list is **automatically reordered by current load**. Make the reorder understandable with a banner like "Load is high, so easier tasks are on top", and animate items moving.
- Highlight the task that's recommended now. Include an empty state.

### F. History
- **Live load chart** for the last 5 minutes.
- **Timeline replay:** pick a session, then play it back with play, pause, step forwards and back, jump to start or end, and speed (1×, 2×, 5×, 10×). The playhead runs over a load-over-time chart coloured by context.
- Session summary stats: events, average load, peak load, duration.
- An event log with context filter chips, plus "Export CSV".

### G. Insights (weekly analytics)
- KPI tiles: total focus time, best focus day, average load, focus efficiency.
- Daily focus-time bar chart, a stacked context breakdown per day, and a day-by-day table.
- **Future-ready slots to design now:**
  - a "Weekly reflection" card (AI-written summary, e.g. "You focus best 9–11am; Tuesdays you get stuck more")
  - a best-hours heatmap (day × hour)

### H. Settings
- **Pomodoro:** short break (1–15 min) and long break (5–40 min).
- **Load thresholds:** high load (50–95%) and fatigue (60–99%). Fatigue must always be higher than high load, so show that constraint.
- **Session gap:** 2–60 min, the idle gap that splits one session into two.
- Each slider shows the default and has a "Reset to default" option.
- **Also include:** notifications, connected sources (as on the onboarding screen), account (email, sign out), privacy (export my data, delete my data).

### I. Alerts and notifications
- An in-app toast for **context changes**, e.g. "Deep focus activated: you're in the zone."
- An **overload warning** when load stays above 85%.
- **Break prompts.**
- How these look as Android notifications.

### J. System states (for every screen)
Design these states for every screen:
- loading and skeletons
- engine offline or reconnecting
- **no data yet** (no sources connected), which is the most important empty state
- low confidence
- error

---

## 4. Domain vocabulary (use these exactly)

**Contexts.** Each needs its own colour plus an icon. Colour must never be the only signal, and the set must be colourblind-safe.

| Key | Label | Meaning |
|---|---|---|
| `deep_focus` | Deep focus | Optimal flow: little switching, moderate load |
| `shallow_work` | Shallow work | Scattered attention, lots of switching |
| `stuck` | Stuck | Repeating error loop plus rapid switching |
| `fatigue` | Fatigue | High load sustained over a long session |
| `recovering` | Recovering | Idle time and load dropping after a hard stretch |
| `unknown` | Warming up | Not enough data yet |

**Directive types:**

| Key | Label |
|---|---|
| `recommend_break` | Take a break |
| `suppress_notifications` | Notifications silenced |
| `block_distracting_tabs` | Distracting tabs blocked |
| `suggest_task` | Suggested task |
| `shorten_focus_interval` | Shorter focus session |
| `delay_hard_tasks` | Hard tasks deferred |
| `schedule_hard_task` | Good time for hard work |
| `allow_notifications` | Notifications OK |

**Task difficulty:** easy, medium, hard, review.

**Pomodoro phase:** idle, work, short_break, long_break.

---

## 5. Sample data for the mockups

Use realistic values, not lorem ipsum.

- **Current state:** load 62%, Deep focus, confidence 80%. Intrinsic 41%, extraneous 22%, germane 58%. Live. Sources: Browser and VS Code connected, LMS not connected.
- **Directives:**
  - Notifications silenced (priority 1): "Protect deep focus window"
  - Distracting tabs blocked (priority 2): "Reduce extraneous load"
- **Tasks:**
  - "Linear Algebra problem set 4": hard, 50 min, tag `math`
  - "CS 201 lab: linked lists": medium, 40 min, tag `cs201`
  - "Review lecture 7 notes": review, 20 min
  - "Reply to group project thread": easy, 10 min
- **Today:** 1 h 48 m focus, average load 54%, 3 sessions.
- **Week:**
  - Mon 2.1 h focus
  - Tue 0.9 h
  - Wed 3.4 h (best)
  - Thu 1.7 h
  - Fri 2.6 h
  - Sat 0.4 h
  - Sun 1.2 h
  - Average load 51%, focus efficiency 63%.
- **Pomodoro:** Focus phase, 11:24 remaining of 25:00, 2 sessions completed.

---

## 6. Visual direction

- **Current look, which you may evolve or replace:**
  - dark navy background `#0d0d1f`, cards `#13132b`, borders `#1e1e3a`
  - indigo accent `#4a4af0`
  - context colours: green `#4af0a0` for focus, yellow `#f0d04a` for shallow, orange `#f09a4a` for stuck, red `#f05a4a` for fatigue, cyan `#4ac0f0` for recovering
  - emoji used as icons
  It works, but it feels like a developer dashboard. Push it toward a polished consumer product.
- **Ship dark and light themes.** Dark is the default, because students study at night.
- **Replace emoji with a consistent icon set**, for example Lucide, which is available on npm.
- **Avoid alarm-red for fatigue and stuck.** Use warm, caring tones so the app nudges rather than scolds.
- **Typography:** use one clean sans (e.g. Inter or Geist) with tabular numerals for live numbers and timers.
- **Motion:** smooth gauge and number transitions, gentle state-change transitions, and support for `prefers-reduced-motion`.
- **Accessibility:** WCAG 2.1 AA contrast, touch targets of at least 44px, a visible keyboard focus ring, and screen-reader labels for the gauge (e.g. "Load 62 percent, deep focus").
- **Tone of voice:** short, plain and supportive, written in the second person. Explain jargon the first time it appears. Never say anything like "you failed".

---

## 7. Navigation (proposal; improve it if you have a better idea)

- **Desktop:** a left sidebar with Now, Focus, Tasks, History, Insights and Settings. The live mini-gauge and connection status are always visible in the sidebar.
- **Mobile:** a bottom tab bar with Now, Focus, Tasks, Insights and More. History and Settings sit under More, or History merges into Insights. A small live load pill is always visible in the top bar.
- **Focus and Pomodoro sessions** should be reachable from anywhere. Show the running timer persistently, e.g. as a mini-player bar.

---

## 8. Technical constraints

- React 18 + TypeScript + Vite. Styling uses **CSS Modules and CSS custom properties**, with no Tailwind and no heavy UI kit. Charts use **Recharts**.
- Deliver **design tokens as CSS variables** for both themes: colour, type scale, spacing, radius, shadow and motion durations.
- It must run well in an Android WebView (Capacitor), so avoid heavy blur or backdrop-filter stacks and huge animated SVG filters.
- The live state updates every 2 s over a WebSocket. Design for numbers that change constantly.
- Where it helps, map components to the existing names so implementation is quick:
  - `LoadGauge`
  - `StatsCard`
  - `DirectivesFeed`
  - `ControlPanel` (focus + Pomodoro)
  - `TaskQueue`
  - `CognitiveTimeline` (live chart)
  - `TimelineReplay`
  - `AnalyticsPanel`
  - `SettingsPanel`
  - `LoginPage`

---

## 9. What I need back

1. **Design tokens** for light and dark themes, as CSS variables.
2. **Component sheet** covering:
   - gauge, context pill, stat tile, directive card, task row, difficulty chip
   - timer, playback controls, chart styling, slider, toggle
   - buttons (primary, secondary, ghost, danger), inputs
   - tab bar, sidebar, drawer/bottom sheet, toast, empty state, skeleton
3. **Every screen in section 3**, at desktop (1440) and mobile (390), including the key states.
4. **The small surfaces:** extension popup, blocked-tab overlay, VS Code status-bar format.
5. **A short handoff note:** layout grid and breakpoints, interaction details, animation timings, and anything that isn't obvious from the visuals.
