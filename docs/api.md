# API Reference

Base URL: `http://127.0.0.1:8765` (local only, never exposed externally)

Interactive docs: `http://127.0.0.1:8765/docs` (Swagger UI, auto-generated)

---

## Health

### `GET /health`
```json
{ "status": "ok", "version": "0.1.0" }
```

---

## Cognitive State

### `GET /state`

Returns the current cognitive load snapshot.

**Response**
```json
{
  "load_score": 0.72,
  "context": "stuck",
  "confidence": 0.85,
  "breakdown": {
    "intrinsic": 0.45,
    "extraneous": 0.81,
    "germane": 0.12
  },
  "timestamp": 1700000000.123
}
```

| Field | Type | Description |
|---|---|---|
| `load_score` | float 0–1 | Overall cognitive load (0 = none, 1 = maximum) |
| `context` | string | `deep_focus` `shallow_work` `stuck` `fatigue` `recovering` `unknown` |
| `confidence` | float 0–1 | Estimator confidence (rises as history accumulates) |
| `breakdown.intrinsic` | float | Task complexity component |
| `breakdown.extraneous` | float | Distraction/switching component |
| `breakdown.germane` | float | Productive engagement component |

### `WS /state/ws`

WebSocket stream. Pushes the same JSON shape as `GET /state` every 2 seconds. The React dashboard uses this for live updates.

```js
const ws = new WebSocket("ws://127.0.0.1:8765/state/ws");
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

---

## Telemetry

### `POST /telemetry/event`

Ingest a single event from a plugin.

**Body**
```json
{
  "source": "browser",
  "type": "TAB_SWITCH",
  "timestamp": 1700000000.123,
  "data": {
    "fromUrl": "https://reddit.com",
    "toUrl": "https://arxiv.org/abs/1234"
  }
}
```

| Field | Required | Values |
|---|---|---|
| `source` | yes | `browser` `ide` `desktop` |
| `type` | yes | See event type tables below |
| `timestamp` | no | Unix float, defaults to now |
| `data` | no | Event-specific payload |

**Response**: `202 Accepted` `{"status": "accepted"}`

**Errors**:
- `400` — unknown source
- `422` — unknown event type for that source

### `POST /telemetry/batch`

Ingest multiple events at once (preferred for plugins that buffer).

**Body**: array of event objects (same shape as above)

**Response**: `202 Accepted` `{"accepted": 3, "total": 3}`

---

### Browser event types

| `type` | Description | Key `data` fields |
|---|---|---|
| `TAB_SWITCH` | Active tab changed | `fromUrl`, `toUrl` |
| `NAVIGATION` | Page navigation completed | `url` |
| `PAGE_SCROLL` | User scrolled | `deltaY`, `url` |
| `FOCUS_LOST` | Browser lost focus | — |
| `FOCUS_GAINED` | Browser gained focus | — |
| `IDLE_START` | Browser idle detected | `state` |
| `IDLE_END` | User became active | — |

### IDE event types

| `type` | Description | Key `data` fields |
|---|---|---|
| `COMPILE_ERROR` | Build/lint error | `errorCount`, `language`, `file` |
| `COMPILE_SUCCESS` | Build passed | `language` |
| `FILE_SAVE` | File saved | `language`, `file` |
| `FILE_SWITCH` | Active file changed | `language`, `file` |
| `KEYSTROKE` | Key pressed | `intervalMs` (ms since last key) |
| `DEBUG_START` | Debug session started | — |
| `DEBUG_STOP` | Debug session ended | — |
| `TEST_FAIL` | Test run failed | `errorCount` |
| `TEST_PASS` | Test run passed | — |
| `TERMINAL_CMD` | Terminal command run | `command` |

### Desktop event types

| `type` | Description | Key `data` fields |
|---|---|---|
| `WINDOW_FOCUS` | App window focused | `app`, `title` |
| `WINDOW_BLUR` | App window lost focus | `app` |
| `MOUSE_IDLE` | Mouse/keyboard idle | — |
| `MOUSE_ACTIVE` | Activity resumed | — |
| `SCREEN_LOCK` | Screen locked | — |
| `SCREEN_UNLOCK` | Screen unlocked | — |

---

## Actions

### `GET /actions/directives`

Returns the routing engine's current recommended actions.

**Response**
```json
{
  "directives": [
    {
      "action_type": "suppress_notifications",
      "params": {},
      "priority": 1,
      "reason": "Student is stuck — eliminate interruptions"
    },
    {
      "action_type": "suggest_task",
      "params": { "type": "review", "difficulty": "easy" },
      "priority": 2,
      "reason": "Surface prerequisite material"
    }
  ],
  "load_score": 0.78,
  "context": "stuck"
}
```

### Focus Mode

| Endpoint | Method | Body | Description |
|---|---|---|---|
| `/actions/focus` | GET | — | Get focus state |
| `/actions/focus/start` | POST | `{"duration_minutes": 25, "block_tabs": true, "reason": ""}` | Activate focus mode |
| `/actions/focus/stop` | POST | — | Deactivate focus mode |

**Focus state response**
```json
{
  "active": true,
  "elapsed_minutes": 7.3,
  "duration_minutes": 25,
  "block_tabs": true,
  "reason": "Auto: deep focus detected"
}
```

### Task Queue

| Endpoint | Method | Body | Description |
|---|---|---|---|
| `/actions/tasks` | GET | — | List all tasks (load-ordered) |
| `/actions/tasks` | POST | task object | Add a task |
| `/actions/tasks/{id}` | DELETE | — | Remove a task |

**Task object**
```json
{
  "id": "uuid-or-custom-string",
  "title": "Implement binary search",
  "difficulty": "hard",
  "estimated_minutes": 25,
  "tags": ["algorithms", "cs"]
}
```

`difficulty` values: `easy` `medium` `hard` `review`

**Task queue response**
```json
{
  "tasks": [ ... ],
  "recommended_duration_minutes": 15
}
```

### Pomodoro

| Endpoint | Method | Description |
|---|---|---|
| `/actions/pomodoro` | GET | Get timer state |
| `/actions/pomodoro/start` | POST | Start a work session (duration set by load score) |

**Pomodoro state response**
```json
{
  "phase": "work",
  "elapsed_seconds": 423.1,
  "remaining_seconds": 1076.9,
  "sessions_completed": 2,
  "duration_seconds": 1500
}
```

`phase` values: `work` `short_break` `long_break` `idle`

---

## Timeline

### `GET /timeline`

Query the cognitive activity log.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `since` | float | Unix timestamp lower bound |
| `until` | float | Unix timestamp upper bound |
| `source` | string | Filter: `browser` `ide` `desktop` `engine` |
| `limit` | int | Max results (default 200, max 1000) |

**Entry shape**
```json
{
  "id": 1042,
  "timestamp": 1700000000.0,
  "source": "engine",
  "event_type": "inference_tick",
  "load_score": 0.72,
  "context": "stuck",
  "metadata_json": "{\"intrinsic\": 0.45, \"extraneous\": 0.81}"
}
```

### `GET /timeline/load-history`

Returns an array of recent load scores for charting.

**Query parameters**: `window_s` (default 300)

**Response**
```json
{
  "scores": [0.31, 0.34, 0.41, 0.58, 0.72],
  "window_seconds": 300,
  "count": 5
}
```
