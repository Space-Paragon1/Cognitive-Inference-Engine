# Architecture

## Overview

The Cognitive Load Router (CLR) is a **local-first intelligence layer** that sits between a student's digital tools and their attention. It has no cloud dependency — all computation and data storage is on-device.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Student's Machine                                │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐                    │
│  │   Browser   │  │   VSCode    │  │   Desktop    │  ← Plugin Layer     │
│  │  Extension  │  │  Extension  │  │    Agent     │                    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘                    │
│         │                │                │                              │
│         └────────────────┴────────────────┘                              │
│                          │ POST /telemetry/batch                          │
│                          ▼                                               │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    CLR Engine (FastAPI :8765)                      │  │
│  │                                                                    │  │
│  │  ┌──────────────────┐      ┌─────────────────────────────────┐    │  │
│  │  │ Telemetry         │      │         Inference Layer          │    │  │
│  │  │ Aggregator        │─────▶│  SignalProcessor → LoadEstimator │    │  │
│  │  │                   │      │  → ContextClassifier             │    │  │
│  │  └──────────────────┘      └──────────────────┬──────────────┘    │  │
│  │                                               │                    │  │
│  │  ┌──────────────────┐      ┌─────────────────▼──────────────┐    │  │
│  │  │ CognitiveTimeline │◀─────│       Policy Engine             │    │  │
│  │  │ (SQLite)          │      │  Rules → ActionDirectives        │    │  │
│  │  └──────────────────┘      └──────────────────┬──────────────┘    │  │
│  │                                               │                    │  │
│  │                            ┌─────────────────▼──────────────┐    │  │
│  │                            │         Action Layer             │    │  │
│  │                            │  FocusMode · Notifications       │    │  │
│  │                            │  TaskQueue · Pomodoro            │    │  │
│  │                            └────────────────────────────────┘     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                    │ REST + WebSocket                                     │
│                    ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │              React Dashboard (:5173)                     │            │
│  │  LoadGauge · CognitiveTimeline · ControlPanel · Tasks    │            │
│  └─────────────────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Layer-by-layer description

### 1. Plugin Layer (Signal collection)

| Plugin | Language | Events collected |
|---|---|---|
| Browser Extension (MV3) | JavaScript | tab switches, navigation, scroll velocity, idle/active |
| VSCode Extension | TypeScript | compile errors, keystroke cadence, file switches, debug sessions |
| Desktop Agent | Python (ctypes) | active window app/title, mouse idle/active |

Plugins buffer events locally and POST batches to `/telemetry/batch` every ~5 seconds. If the engine is unreachable, events are silently discarded — plugins never block the user's workflow.

### 2. Telemetry Aggregator

`engine/telemetry/aggregator.py`

Central event bus. All plugin events funnel through here:
1. Parse raw payload via source-specific parser
2. Push parsed `TelemetryEvent` into the `SignalProcessor` sliding window
3. Log enriched entries to the `CognitiveTimeline`

### 3. Inference Layer

Runs on a configurable tick (default: every 2 seconds).

**SignalProcessor** (`engine/inference/signal_processor.py`)
- Maintains a sliding window (default: 300s) of raw events
- Evicts stale events on each tick
- Derives a `SignalFeatures` vector: tab_switch_rate, compile_error_rate, typing_burst_score, task_switch_entropy, idle_fraction, scroll_velocity_norm, session_duration_min

**LoadEstimator** (`engine/inference/load_estimator.py`)
- Maps `SignalFeatures` → `LoadEstimate` (0.0–1.0 score)
- Decomposes into three CLT components:
  - **Intrinsic load** — task complexity (errors, typing variance)
  - **Extraneous load** — distraction/switching (tab rate, window entropy)
  - **Germane load** — productive engagement (session duration, idle fraction)
- Applies exponential moving average for temporal smoothing

**ContextClassifier** (`engine/inference/context_classifier.py`)
- Maps `(SignalFeatures, load_score)` → `CognitiveContext` enum
- Rule-based in v1; designed to be swapped for a trained classifier

### 4. Attention Routing Engine

**PolicyEngine** (`engine/router/policy_engine.py`)
- Evaluates the declarative rule registry (`engine/router/rules.py`) against the current `(context, load_score)`
- Returns a priority-sorted list of `ActionDirective` objects

**TaskScheduler** (`engine/router/scheduler.py`)
- Reorders the task queue based on load score (hard tasks when load is low, review when overloaded)
- Computes adaptive Pomodoro session duration (10–35 min range)

### 5. Action Layer

| Controller | File | What it does |
|---|---|---|
| `FocusModeController` | `actions/focus_mode.py` | Activates DnD + tab-blocking signal; auto-expires |
| `NotificationController` | `actions/notifications.py` | OS-level DnD via Win32/macOS/GNOME APIs |
| `TaskQueueManager` | `actions/task_queue.py` | In-memory queue with load-aware ordering |
| `AdaptivePomodoro` | `actions/pomodoro.py` | Auto-cycles work/break phases with load-adjusted durations |

### 6. Cognitive Timeline

`engine/telemetry/timeline.py`

Append-only SQLite store. Every inference tick writes a row:
```
(timestamp, source, event_type, load_score, context, metadata_json)
```

The dashboard queries this for:
- Rolling load score charts
- Context distribution histograms
- "Replay" of attention history

---

## Data flow (per inference tick)

```
[plugins push events] ──▶ TelemetryAggregator.push_event()
                              │
                              ▼
                         SignalProcessor (sliding window)
                              │ extract_features()
                              ▼
                         SignalFeatures vector
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              LoadEstimator       (same features)
              .estimate()              │
                    │           ContextClassifier
                    └─────┬─────.classify()
                          │
                    LoadEstimate + CognitiveContext
                          │
                    PolicyEngine.evaluate()
                          │
                    [ActionDirectives]
                          │
            ┌─────────────┼──────────────┐
            ▼             ▼              ▼
      TaskQueue      FocusMode      Pomodoro
      .update_load() .tick()        .tick()
```

---

## State management

The FastAPI app stores all runtime singletons on `app.state` (not module globals). This means:
- Each `create_app()` call is fully independent (critical for testing)
- No shared state between test modules
- Clean startup/shutdown via `asynccontextmanager` lifespan

---

## Configuration

Priority order (highest wins):
1. `CLR_*` environment variables
2. `config.json` in the project root
3. Built-in defaults in `engine/config.py`

```bash
# Examples
CLR_API_PORT=9000 python start.py
CLR_INFERENCE_INTERVAL_MS=1000 python start.py   # 1s ticks
CLR_LOAD_HISTORY_WINDOW_S=600 python start.py    # 10 min window
```
