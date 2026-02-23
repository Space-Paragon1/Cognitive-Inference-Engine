# Plugin Integration Guide

Plugins are the signal collectors. They observe the student's digital environment and POST telemetry to the CLR engine. Any tool can become a CLR plugin by sending HTTP events to `http://127.0.0.1:8765/telemetry/batch`.

---

## Browser Extension (Chrome / Firefox)

### Install (Development)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select `plugins/browser-extension/`

The extension icon appears in the toolbar. Click it to see the live load gauge popup.

### What it collects

| Signal | How | Why |
|---|---|---|
| Tab switches | `chrome.tabs.onActivated` | Context switching rate |
| Navigation | `chrome.tabs.onUpdated` | Academic vs distraction detection |
| Scroll velocity | Content script `scroll` event | Attention depth indicator |
| Idle/active | `chrome.idle.onStateChanged` | Session energy estimation |

### Focus mode tab blocking

When the engine activates focus mode with `block_tabs: true`, the extension:
1. Polls `/actions/focus` every 3 seconds
2. Stores the focus state in `chrome.storage.local`
3. Content script checks this and overlays a blocking screen on non-academic pages

Academic domains (allowed during focus):
- `stackoverflow.com`, `arxiv.org`, `scholar.google.com`
- `docs.python.org`, `developer.mozilla.org`
- `coursera.org`, `edx.org`, `khanacademy.org`
- Extend the list in `content.js`

### Configuration

Edit `background.js`:
```js
const API_BASE = "http://127.0.0.1:8765";   // engine URL
const FLUSH_INTERVAL_MS = 5000;              // how often to flush events
```

---

## VSCode Extension

### Install (Development)

```bash
cd plugins/vscode-extension
npm install
npm run compile
```

Press **F5** in VSCode to open the Extension Development Host with the plugin active.

To install permanently: package with `vsce package` and install the `.vsix`.

### What it collects

| Signal | VSCode API | Internal event type |
|---|---|---|
| Compile errors | `vscode.languages.onDidChangeDiagnostics` | `COMPILE_ERROR` |
| Keystroke cadence | `workspace.onDidChangeTextDocument` | `KEYSTROKE` |
| File saves | `workspace.onDidSaveTextDocument` | `FILE_SAVE` |
| File switches | `window.onDidChangeActiveTextEditor` | `FILE_SWITCH` |
| Debug start/stop | `debug.onDidStartDebugSession` | `DEBUG_START` / `DEBUG_STOP` |

### Configuration

In VSCode settings (`Ctrl+Shift+P` → "Preferences: Open Settings"):

| Setting | Default | Description |
|---|---|---|
| `clr.engineUrl` | `http://127.0.0.1:8765` | Engine API URL |
| `clr.telemetryEnabled` | `true` | Enable/disable data collection |

Or toggle via command palette: **CLR: Toggle Telemetry**

---

## Desktop Agent

The desktop agent monitors the active window at the OS level — no browser or IDE dependency.

### Run

```bash
# Standalone
python -m engine.telemetry.desktop_agent

# Via start.py
python start.py --agent
```

### What it collects

| Signal | Platform API | Internal event |
|---|---|---|
| Active window app name | Win32 `GetForegroundWindow` / `QueryFullProcessImageName` | `WINDOW_FOCUS` |
| Mouse/keyboard idle (30s threshold) | Window-change heuristic | `MOUSE_IDLE` / `MOUSE_ACTIVE` |

### Platform support

| Platform | Status | Implementation |
|---|---|---|
| Windows | ✅ Full | `ctypes` + Win32 API (zero deps) |
| macOS | ⚠️ Partial | `osascript` — app name only |
| Linux | 🔲 Stub | Returns `None` (needs `xdotool` or `wnck`) |

### Configuration

```bash
python -m engine.telemetry.desktop_agent --url http://127.0.0.1:8765 --interval 1.0
```

---

## Building a Custom Plugin

Any process can be a CLR plugin. Minimum viable plugin in Python:

```python
import json, time, urllib.request

API = "http://127.0.0.1:8765"

def send(events):
    data = json.dumps(events).encode()
    req = urllib.request.Request(
        f"{API}/telemetry/batch", data=data,
        headers={"Content-Type": "application/json"}, method="POST"
    )
    urllib.request.urlopen(req, timeout=3)

# Example: send a custom event every 5 seconds
while True:
    send([{
        "source": "desktop",        # browser | ide | desktop
        "type": "WINDOW_FOCUS",
        "timestamp": time.time(),
        "data": {"app": "MyApp", "title": "My Window"}
    }])
    time.sleep(5)
```

### Minimum viable plugin in JavaScript (Node.js / browser)

```js
async function sendEvents(events) {
  await fetch("http://127.0.0.1:8765/telemetry/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(events),
  });
}
```

### Custom event sources

If you want to add a new `source` type (e.g. `"lms"` for an LMS integration), extend:

1. `engine/telemetry/sources/` — add `lms.py` with a `parse_lms_event()` function
2. `engine/api/routers/telemetry.py` — add the `elif event.source == "lms"` branch
3. `plugins/browser-extension/background.js` (optional) — if the LMS is web-based

---

## Simulation (No Plugins Required)

To test the full stack without any plugins installed:

```bash
# Terminal 1: start engine
python start.py

# Terminal 2: simulate telemetry
python scripts/simulate.py                   # cycle all scenarios
python scripts/simulate.py --scenario stuck  # specific scenario
python scripts/simulate.py --loop --speed 2  # fast infinite loop
```

Open the dashboard at `http://localhost:5173` to watch the load gauge and timeline respond in real time.
