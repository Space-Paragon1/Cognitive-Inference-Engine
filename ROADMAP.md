# Cognitive Load Router roadmap

CLR treats a student's attention as a resource to schedule. Sources on the computer report activity, the engine estimates cognitive load and the student's state, and the apps show it and act on it: silencing interruptions, blocking distractions, ordering tasks and timing breaks.

This file is the plan from where the project stands to a public launch on the web, Google Play, the App Store and the extension stores. Phases run in order. An item is checked only when it is built, tested, passing in CI and documented.

**You** marks a step only the project owner can take: an account, a payment, a key, or a legal decision.

## How we work

- One branch per phase (`roadmap/phase-N-…`), merged into `main` when the phase is done.
- Every engine change comes with tests. Every app change passes the type check, lint, unit tests and build.
- `frontend/PORTING_LOG.md` lists what the app still works around. Items leave it as Phase 3 replaces them.

## Start these now (they take time)

- [ ] **You:** Google Play Console account ($25, one time). New personal accounts must run a closed test with at least 12 testers for 14 days before they can publish, so testers are worth lining up early.
- [ ] **You:** Install Xcode from the Mac App Store. Only the Command Line Tools are installed, and iOS builds need the full Xcode.
- [ ] **You:** Apple Developer Program ($99 a year), needed for TestFlight and the App Store.
- [ ] **You:** Chrome Web Store developer account ($5, one time).
- [ ] **You:** A domain name for the web app and the engine (optional, but it looks better than a Railway address in the stores).

---

## Phase 0: Built so far

**Engine (Python, FastAPI)**
- [x] Telemetry intake for browser, IDE, LMS and desktop events (`/telemetry/event`, `/telemetry/batch`)
- [x] Signal processing; rule-based load estimator (v1) and machine-learning estimator (v2, trained on simulated data)
- [x] Context classifier (deep focus, stuck, recovering, fatigued) and policy engine issuing directives
- [x] Actions: focus mode, Pomodoro, a task queue ordered by load and difficulty, Do Not Disturb, desktop notifications
- [x] Accounts: register, sign in, JWT, forgot and reset password, sign-in rate limits
- [x] One engine per user; device pairing with codes and device tokens
- [x] Timeline, sessions, daily stats and retention; live state over WebSocket; per-user settings
- [x] Postgres with Alembic migrations
- [x] 215 tests passing
- [x] Deployed on Railway with Postgres

**Design and apps**
- [x] Design system in `design/` (tokens, components, voice)
- [x] App rebuilt on the design system: sign-in, onboarding, Now, Focus, Tasks, History, Insights, Settings and More. The web and Android apps share this code.
- [x] Android app (Capacitor 8): builds, runs on the emulator, status bar follows the theme, Android back gesture
- [x] GitHub Actions builds a debug APK on every push to `main`
- [x] Browser extension: activity events, popup, blocked-tab overlay, pairing
- [x] LMS connector: Canvas, Blackboard and Moodle page events, pairing
- [x] VS Code extension: coding events, status bar, pairing, and an installer (`npm run package`)

## Phase 1: Quality gates

Every later change is checked automatically.

Status: all built and passing locally on `roadmap/phase-1-quality-gates`. The boxes get ticked once it is committed and the first CI run on GitHub is green.

- [ ] Lint clean across the engine, tests and scripts (`ruff check engine/ tests/ scripts/ alembic/ start.py`)
- [ ] Commit Capacitor's generated plugin registration and the VS Code packaging setup
- [ ] CI on every push and pull request: engine tests and lint (`.github/workflows/ci.yml`)
- [ ] CI: app type check, ESLint with no warnings allowed, and production build
- [ ] App unit tests (Vitest) for the logic in `src/lib`, run in CI (65 tests)
- [ ] CI: VS Code extension compiles and packages; browser extension and LMS connector scripts parse; the extension's copy of the design system is current

## Phase 2: Web app live

The web app is the same code as the Android app. It runs locally today but isn't hosted anywhere.

- [ ] Host the built web app. Recommended: a second Railway service from this repo, so the engine and the app live in one place. **You:** add the service in Railway.
- [ ] Production engine address built in; engine CORS allows the web app's address
- [ ] Installable web app: manifest, icons, theme colour, offline app shell
- [ ] Extensions default to the hosted engine and web app, so students don't type addresses
- [ ] Custom domain with HTTPS for the app and the engine. **You:** buy the domain and add its DNS records.

## Phase 3: Finish the engine API

The app already has controls for each of these; today they fall back to on-device workarounds.

- [ ] Pomodoro pause, resume and skip
- [ ] Read the current Do Not Disturb setting
- [ ] Complete a task and keep it (completed history); edit a task
- [ ] Blocked-sites list: read and edit in Settings, served to the browser extension
- [ ] Focus sessions with an id and start time; extend a session; passes counted on the engine; session type in Today's sessions
- [ ] Start a break on demand, with a chosen length
- [ ] Pause one directive; undo a task deferral
- [ ] Paired devices can read the timer and directives (the VS Code status bar)
- [ ] Source events in the timeline (event type and site or app name only) for the event log
- [ ] Hourly focus data for "Your best hours"
- [ ] Daily stats in the student's time zone
- [ ] Onboarding finished is stored on the account, not the device
- [ ] The reset-password form shows which account it is for

## Phase 4: Accounts, privacy and trust

Google Play and the App Store require account deletion and a privacy policy before they accept the app.

- [ ] Export my data: a full download of everything CLR stores
- [ ] Delete my data and account, in the app and from a web page
- [ ] Privacy policy and terms pages, linked from sign-up, Settings and the store listings. **You:** review and approve the text.
- [ ] Password-reset emails delivered. **You:** choose an email provider and add its keys on Railway.
- [ ] Email verification on sign-up
- [ ] Short-lived sign-in tokens with refresh; sign out of all devices
- [ ] Help and feedback sends feedback to the engine
- [ ] Security pass: rate limits on every auth route, security headers, dependency audit in CI, secrets review

## Phase 5: Android on Google Play

- [ ] App icon and splash screen from the design system (the app still has Capacitor's default icon)
- [ ] Release signing; CI builds a signed App Bundle. **You:** create and safely keep the upload key.
- [ ] Break notifications while the app is closed, checked on a real phone
- [ ] Store listing: screenshots, description, Data safety form, content rating. **You:** Play Console account.
- [ ] Closed test with at least 12 testers for 14 days. **You:** invite the testers.
- [ ] Production release

## Phase 6: iOS on the App Store

- [ ] **You:** Xcode installed and Apple Developer Program joined
- [ ] iOS project added (`npx cap add ios`): icon, splash, safe areas, status bar, keyboard, haptics, notifications
- [ ] Tested on the iOS Simulator and a real iPhone
- [ ] CI builds the iOS app
- [ ] TestFlight beta, then App Store review (privacy labels, account deletion)

## Phase 7: Extensions in their stores

- [ ] Browser extension icons and store images
- [ ] Chrome Web Store listing. **You:** developer account.
- [ ] Firefox version and Firefox Add-ons listing
- [ ] LMS connector works on a school's own LMS address (not only `*.instructure.com` and the other hosted addresses)
- [ ] LMS connector imports real deadlines (Canvas planner or calendar feed) into the task queue
- [ ] VS Code Marketplace and Open VSX listings. **You:** publisher accounts (free).

## Phase 8: Smarter CLR

- [ ] Optional "How loaded do you feel?" check-ins in the app, saved as labels
- [ ] Retrain the estimator on real labelled data and publish its accuracy against the simulated model
- [ ] A personal baseline for each student
- [ ] AI-written weekly reflection with "Not helpful" feedback
- [ ] Push notifications from the engine (FCM and APNs) for breaks and overload
- [ ] The phone as a source: Android usage access, opt-in only
- [ ] A desktop agent for apps outside Chrome and VS Code (the engine already reads desktop events)

## Phase 9: Launch

- [ ] Error monitoring and uptime alerts for the engine and the apps
- [ ] README, architecture and API docs up to date; interactive API docs published
- [ ] Demo video, screenshots and a landing page
- [ ] Versioned releases with a changelog
