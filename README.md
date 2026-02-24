# Cognitive Load Router

> A local-first cross-application intelligence layer that treats cognitive load as a schedulable system resource and dynamically routes student attention, task difficulty, and interruptions in real time.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLR Engine (Python)                      │
│                                                                 │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐  │
│  │   Telemetry    │──▶│   Inference    │──▶│    Router      │  │
│  │   Aggregator   │   │  Load Estimator│   │  Policy Engine │  │
│  └────────────────┘   └────────────────┘   └────────────────┘  │
│          ▲                    ▼                     ▼           │
│  ┌───────┴───────┐   ┌────────────────┐   ┌────────────────┐  │
│  │   Sources     │   │  CogTimeline   │   │  Action Layer  │  │
│  │ browser/ide/  │   │  (SQLite)      │   │ focus/notif/   │  │
│  │ desktop       │   └────────────────┘   │ pomodoro/tasks │  │
│  └───────────────┘                        └────────────────┘  │
│                                                                 │
│                    FastAPI  :8765                               │
└──────────┬──────────────────────────────────────┬──────────────┘
           │  REST + WebSocket                    │
  ┌────────▼────────┐                   ┌─────────▼────────┐
  │ Browser Ext.    │                   │  React Dashboard │
  │ (Manifest V3)   │                   │  :5173           │
  └─────────────────┘                   └──────────────────┘
           │
  ┌────────▼────────┐
  │  VSCode Ext.    │
  │  (TypeScript)   │
  └─────────────────┘
```

## Repository Layout

```
.
├── engine/                  # Python backend
│   ├── config.py            # Config (env vars or config.json)
│   ├── main.py              # Entry point (uvicorn)
│   ├── inference/           # Load estimator + context classifier
│   ├── telemetry/           # Aggregator, timeline, source parsers
│   ├── router/              # Policy engine + task scheduler
│   ├── actions/             # Focus mode, notifications, pomodoro, tasks
│   └── api/                 # FastAPI app + routers + schemas
│
├── plugins/
│   ├── browser-extension/   # Chrome/Firefox MV3 extension
│   └── vscode-extension/    # VSCode extension (TypeScript)
│
├── frontend/                # React + Vite dashboard
│   └── src/
│       ├── components/      # LoadGauge, Timeline, TaskQueue, ControlPanel
│       ├── hooks/           # useCognitiveState, useTimeline
│       ├── api/             # Typed API client
│       └── types/           # Shared TypeScript types
│
├── data/                    # Runtime SQLite DBs (gitignored)
├── config.json.example      # Configuration template
└── pyproject.toml
```

## Quick Start

### 1. Start the engine

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\Activate.ps1
pip install -e ".[dev]"

python -m engine.main
# → Listening on http://127.0.0.1:8765
```

### 2. Start the dashboard

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 3. Load the browser extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `plugins/browser-extension/`

### 4. Install the VSCode extension (dev mode)

```bash
cd plugins/vscode-extension
npm install
npm run compile
```
Then press **F5** in VSCode to launch the Extension Development Host.

---

## Development Commands

### Backend

```bash
# Run all tests
pytest

# Verbose output, stop on first failure
pytest -v -x

# Run a specific test file
pytest tests/test_settings.py -v

# Lint — check for issues
ruff check engine/

# Lint — auto-fix safe issues (unused imports, import ordering)
ruff check engine/ --fix

# Start engine
python -m engine.main
```

### Frontend

```bash
cd frontend

# Development server with hot reload (port 5173)
npm run dev

# Type-check + build production bundle
npm run build

# Serve the production build locally (port 4173)
npm run preview
```

> Both `npm run dev` and `npm run preview` proxy `/api` requests to the backend at
> `http://127.0.0.1:8765`. Make sure the engine is running before opening the dashboard.

### Train the ML load estimator (v2)

```bash
python scripts/train_estimator.py
```

---

## Troubleshooting

### `npm run preview` — API calls return 404

The production preview server (`npm run preview`) uses a proxy just like the dev server.
If you see 404s on API calls after building, make sure the engine is running:

```bash
# Terminal 1
python -m engine.main

# Terminal 2
cd frontend && npm run preview
```

The proxy config lives in [frontend/vite.config.ts](frontend/vite.config.ts) under both
`server.proxy` (dev) and `preview.proxy` (preview).

---

### `ruff check engine/` reports errors

Run the auto-fixer first — it handles unused imports and import ordering automatically:

```bash
ruff check engine/ --fix
```

For the remaining issues (lines too long, unused variables), fix them manually and re-run
`ruff check engine/` until it reports **All checks passed**.

---

### `pytest` — collected 0 items for a test file

Check that the file name matches `test_*.py` and that the functions are named `test_*`.
Also verify you are running pytest from the project root (where `pyproject.toml` lives):

```bash
# From project root
pytest tests/test_settings.py -v
```

---

### Frontend build warning: chunk size > 500 kB

```
(!) Some chunks are larger than 500 kB after minification.
```

This is expected — `recharts` is a large charting library (~400 kB). The warning does not
affect functionality for a local-first app. To silence it, raise the limit in
[frontend/vite.config.ts](frontend/vite.config.ts):

```ts
build: {
  chunkSizeWarningLimit: 600,
}
```

---

### Settings not persisting across restarts

User settings are stored in `data/settings.json`. If the file is missing or malformed,
the engine falls back to the defaults defined in `engine/settings.py`. Delete the file to
reset all settings to defaults:

```bash
rm data/settings.json
```

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/state` | GET | Current cognitive load snapshot |
| `/state/ws` | WS | Live state stream (2s interval) |
| `/telemetry/event` | POST | Ingest single event |
| `/telemetry/batch` | POST | Ingest event batch |
| `/actions/directives` | GET | Active routing directives |
| `/actions/focus` | GET | Focus mode state |
| `/actions/focus/start` | POST | Activate focus mode |
| `/actions/focus/stop` | POST | Deactivate focus mode |
| `/actions/tasks` | GET/POST | Task queue |
| `/actions/tasks/{id}` | DELETE | Remove task |
| `/actions/pomodoro` | GET | Pomodoro state |
| `/actions/pomodoro/start` | POST | Start adaptive Pomodoro |
| `/timeline` | GET | Query cognitive timeline |
| `/timeline/load-history` | GET | Rolling load score array |
| `/timeline/sessions` | GET | Detected work sessions |
| `/timeline/stats/daily` | GET | Per-day productivity stats |
| `/settings` | GET | Read current user settings + defaults |
| `/settings` | PUT | Update one or more settings (partial patch) |
| `/health` | GET | Engine health + estimator mode |

---

## Cognitive Load Model

The estimator decomposes load into three components from **Cognitive Load Theory** (Sweller, 1988):

| Component | Signal sources | Meaning |
|---|---|---|
| **Intrinsic** | Compile errors, typing variance | Task complexity |
| **Extraneous** | Tab switches, window changes, app entropy | Environmental distraction |
| **Germane** | Session duration, idle fraction | Productive engagement |

Final score = weighted combination with exponential smoothing.

---

## Context States

| State | Description | Triggered When |
|---|---|---|
| `deep_focus` | Optimal flow state | Low switching + moderate load |
| `shallow_work` | Scattered attention | High switching entropy |
| `stuck` | Repetitive error loop | High errors + rapid tab switching |
| `fatigue` | Cognitive overload over time | High load + long session |
| `recovering` | Post-fatigue rest | High idle + declining load |

---

## Configuration

Copy `config.json.example` → `config.json` and adjust values.
All fields can also be set via `CLR_*` environment variables (e.g. `CLR_API_PORT=9000`).

---

## License

MIT © 2026 Alex Chidera Umeasalugo
