"""
Telemetry Simulator — drives the CLR engine with realistic synthetic events
so you can see the full system working (load scores, context changes, dashboard)
without needing real browser/VSCode extensions.

Usage:
    # Make sure the engine is running first:
    #   python start.py
    # Then in a separate terminal:
    python scripts/simulate.py                  # default: cycle all scenarios
    python scripts/simulate.py --scenario stuck  # specific scenario
    python scripts/simulate.py --loop            # repeat forever
    python scripts/simulate.py --speed 2.0       # 2× faster
"""

from __future__ import annotations

import argparse
import json
import random
import time
import urllib.error
import urllib.request
from typing import Iterator

API = "http://127.0.0.1:8765"


# ---------------------------------------------------------------------------
# Low-level HTTP helper
# ---------------------------------------------------------------------------

def _post(path: str, body: list | dict) -> bool:
    try:
        data = json.dumps(body).encode()
        req = urllib.request.Request(
            f"{API}{path}",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=3):
            return True
    except (urllib.error.URLError, OSError) as e:
        print(f"  [!] Engine unreachable: {e}")
        return False


def _get(path: str) -> dict | None:
    try:
        with urllib.request.urlopen(f"{API}{path}", timeout=3) as r:
            return json.loads(r.read())
    except Exception:
        return None


def send_events(events: list[dict]) -> bool:
    return _post("/telemetry/batch", events)


def _evt(source: str, event_type: str, data: dict = {}) -> dict:
    return {
        "source": source,
        "type": event_type,
        "timestamp": time.time(),
        "data": data,
    }


# ---------------------------------------------------------------------------
# Scenario generators — each yields batches of events
# ---------------------------------------------------------------------------

def scenario_deep_focus(speed: float = 1.0) -> Iterator[tuple[str, list[dict], float]]:
    """Student in a productive deep-work session."""
    for _ in range(8):
        yield (
            "Deep Focus: steady typing, rare switching",
            [
                _evt("ide", "KEYSTROKE", {"intervalMs": random.randint(80, 200)}),
                _evt("ide", "KEYSTROKE", {"intervalMs": random.randint(80, 200)}),
                _evt("ide", "FILE_SAVE", {"language": "python"}),
            ],
            2.0 / speed,
        )
    yield (
        "Deep Focus: brief docs check",
        [
            _evt("browser", "TAB_SWITCH", {
                "fromUrl": "https://localhost", "toUrl": "https://docs.python.org/3/library/asyncio.html"
            }),
            _evt("browser", "PAGE_SCROLL", {"deltaY": 800}),
            _evt("browser", "TAB_SWITCH", {
                "fromUrl": "https://docs.python.org", "toUrl": "https://localhost"
            }),
        ],
        3.0 / speed,
    )


def scenario_stuck(speed: float = 1.0) -> Iterator[tuple[str, list[dict], float]]:
    """Student hitting a wall: error loops, frantic tab switching."""
    for i in range(10):
        yield (
            f"Stuck [{i+1}/10]: compile error + StackOverflow tabs",
            [
                _evt("ide", "COMPILE_ERROR", {"errorCount": random.randint(1, 4), "language": "python"}),
                _evt("browser", "TAB_SWITCH", {
                    "fromUrl": "https://localhost",
                    "toUrl": "https://stackoverflow.com/questions/" + str(random.randint(10000, 99999)),
                }),
                _evt("browser", "TAB_SWITCH", {
                    "fromUrl": "https://stackoverflow.com",
                    "toUrl": "https://reddit.com/r/learnpython",
                }),
                _evt("desktop", "WINDOW_FOCUS", {"app": "chrome", "title": "Stack Overflow"}),
                _evt("ide", "KEYSTROKE", {"intervalMs": random.randint(30, 80)}),  # frantic typing
                _evt("ide", "KEYSTROKE", {"intervalMs": random.randint(30, 80)}),
                _evt("browser", "TAB_SWITCH", {
                    "fromUrl": "https://reddit.com",
                    "toUrl": "https://localhost",
                }),
                _evt("desktop", "WINDOW_FOCUS", {"app": "Code", "title": "main.py"}),
            ],
            1.5 / speed,
        )


def scenario_fatigue(speed: float = 1.0) -> Iterator[tuple[str, list[dict], float]]:
    """Long session → fatigue onset: slowdown, idle periods."""
    # Simulate ~90 min of session time by forwarding session_duration signal
    for i in range(6):
        yield (
            f"Fatigue onset [{i+1}/6]: slow activity, drifting",
            [
                _evt("browser", "IDLE_START", {"state": "idle"}),
                _evt("desktop", "MOUSE_IDLE", {}),
            ],
            3.0 / speed,
        )
        yield (
            f"Fatigue [{i+1}/6]: scattered app switching",
            [
                _evt("desktop", "WINDOW_FOCUS", {"app": "Spotify", "title": "Now Playing"}),
                _evt("desktop", "WINDOW_FOCUS", {"app": "Discord", "title": "# general"}),
                _evt("desktop", "WINDOW_FOCUS", {"app": "Chrome", "title": "YouTube"}),
                _evt("browser", "IDLE_END", {}),
                _evt("desktop", "MOUSE_ACTIVE", {}),
            ],
            2.0 / speed,
        )


def scenario_shallow_work(speed: float = 1.0) -> Iterator[tuple[str, list[dict], float]]:
    """Scattered attention: many apps, no deep work."""
    apps = ["Slack", "Chrome", "Notion", "Discord", "Outlook", "Code"]
    urls = [
        "https://twitter.com", "https://reddit.com", "https://news.ycombinator.com",
        "https://youtube.com", "https://notion.so",
    ]
    for i in range(12):
        yield (
            f"Shallow work [{i+1}/12]: context fragmentation",
            [
                _evt("desktop", "WINDOW_FOCUS", {"app": random.choice(apps), "title": ""}),
                _evt("browser", "TAB_SWITCH", {
                    "fromUrl": random.choice(urls),
                    "toUrl": random.choice(urls),
                }),
                _evt("browser", "TAB_SWITCH", {
                    "fromUrl": random.choice(urls),
                    "toUrl": random.choice(urls),
                }),
                _evt("ide", "KEYSTROKE", {"intervalMs": random.randint(200, 800)}),  # slow, distracted
            ],
            1.8 / speed,
        )


def scenario_recovery(speed: float = 1.0) -> Iterator[tuple[str, list[dict], float]]:
    """Post-break recovery: idle → gentle ramp back."""
    for i in range(5):
        yield (
            f"Recovery [{i+1}/5]: post-break idle",
            [
                _evt("browser", "IDLE_START", {}),
                _evt("desktop", "MOUSE_IDLE", {}),
            ],
            3.0 / speed,
        )
    for i in range(4):
        yield (
            f"Recovery [{i+1}/4]: gradual re-engagement",
            [
                _evt("desktop", "MOUSE_ACTIVE", {}),
                _evt("browser", "IDLE_END", {}),
                _evt("browser", "NAVIGATION", {"url": "https://docs.python.org"}),
                _evt("ide", "KEYSTROKE", {"intervalMs": random.randint(100, 300)}),
            ],
            2.0 / speed,
        )


SCENARIOS = {
    "deep_focus": scenario_deep_focus,
    "stuck": scenario_stuck,
    "fatigue": scenario_fatigue,
    "shallow_work": scenario_shallow_work,
    "recovery": scenario_recovery,
}

CYCLE = ["deep_focus", "stuck", "recovery", "deep_focus", "shallow_work", "fatigue", "recovery"]


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def run_scenario(name: str, speed: float) -> None:
    gen_fn = SCENARIOS[name]
    print(f"\n{'─' * 60}")
    print(f"  SCENARIO: {name.upper().replace('_', ' ')}")
    print(f"{'─' * 60}")

    for description, events, delay in gen_fn(speed):
        ok = send_events(events)
        state = _get("/state")
        load = state["load_score"] if state else 0.0
        ctx = state["context"] if state else "unknown"
        bar = "█" * int(load * 20) + "░" * (20 - int(load * 20))

        status = "✓" if ok else "✗"
        print(
            f"  {status} [{bar}] {int(load*100):3d}%  {ctx:<14}  {description}"
        )
        time.sleep(delay)


def main() -> None:
    parser = argparse.ArgumentParser(description="CLR Telemetry Simulator")
    parser.add_argument(
        "--scenario",
        choices=list(SCENARIOS.keys()) + ["cycle"],
        default="cycle",
        help="Which scenario to run (default: cycle through all)",
    )
    parser.add_argument("--loop", action="store_true", help="Repeat indefinitely")
    parser.add_argument("--speed", type=float, default=1.0, help="Speed multiplier (default 1.0)")
    args = parser.parse_args()

    # Check engine is up
    health = _get("/health")
    if not health:
        print(f"[!] Cannot reach engine at {API}")
        print("    Start it first: python start.py")
        return
    print(f"[✓] Engine connected — CLR v{health.get('version', '?')}")
    print(f"    Speed: {args.speed}×  |  Scenario: {args.scenario}")

    sequence = CYCLE if args.scenario == "cycle" else [args.scenario]

    while True:
        for name in sequence:
            run_scenario(name, args.speed)
        if not args.loop:
            break
        print("\n[↺] Looping...\n")
        time.sleep(2.0)

    print("\n[✓] Simulation complete.")


if __name__ == "__main__":
    main()
