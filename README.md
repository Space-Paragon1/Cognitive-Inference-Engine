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
source .venv/bin/activate        # Windows: .venv\Scripts\activate
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
