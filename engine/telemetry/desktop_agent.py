"""
Desktop Agent — background thread that polls the active window on Windows
(with graceful fallback stubs for macOS/Linux) and POSTs events to the
local CLR API.

Run standalone:
    python -m engine.telemetry.desktop_agent

Or import and start programmatically:
    from engine.telemetry.desktop_agent import DesktopAgent
    agent = DesktopAgent(); agent.start()
"""

from __future__ import annotations

import ctypes
import ctypes.wintypes
import json
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional


# ---------------------------------------------------------------------------
# Active window detection — platform implementations
# ---------------------------------------------------------------------------

@dataclass
class WindowInfo:
    app: str
    title: str


def _get_active_window_win32() -> Optional[WindowInfo]:
    """Use Win32 API via ctypes — zero extra dependencies."""
    try:
        hwnd = ctypes.windll.user32.GetForegroundWindow()
        if not hwnd:
            return None

        # Window title
        length = ctypes.windll.user32.GetWindowTextLengthW(hwnd) + 1
        title_buf = ctypes.create_unicode_buffer(length)
        ctypes.windll.user32.GetWindowTextW(hwnd, title_buf, length)
        title = title_buf.value.strip()

        # Process name
        pid = ctypes.wintypes.DWORD()
        ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        handle = ctypes.windll.kernel32.OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION, False, pid.value
        )
        app = "unknown"
        if handle:
            buf = ctypes.create_unicode_buffer(260)
            size = ctypes.wintypes.DWORD(260)
            if ctypes.windll.kernel32.QueryFullProcessImageNameW(handle, 0, buf, ctypes.byref(size)):
                import os
                app = os.path.splitext(os.path.basename(buf.value))[0]
            ctypes.windll.kernel32.CloseHandle(handle)

        return WindowInfo(app=app, title=title)
    except Exception:
        return None


def _get_active_window_macos() -> Optional[WindowInfo]:
    try:
        import subprocess
        result = subprocess.run(
            ["osascript", "-e",
             'tell application "System Events" to get name of first application process whose frontmost is true'],
            capture_output=True, text=True, timeout=2,
        )
        app = result.stdout.strip()
        return WindowInfo(app=app, title="")
    except Exception:
        return None


def _get_active_window() -> Optional[WindowInfo]:
    if sys.platform == "win32":
        return _get_active_window_win32()
    if sys.platform == "darwin":
        return _get_active_window_macos()
    return None  # Linux: would need xdotool or wnck


# ---------------------------------------------------------------------------
# Desktop Agent
# ---------------------------------------------------------------------------

class DesktopAgent(threading.Thread):
    """
    Background thread that:
    1. Polls the active window every `poll_interval_s` seconds
    2. Emits WINDOW_FOCUS events when the app or title changes
    3. Detects mouse idle via a simple no-change heuristic
    4. POSTs events to the CLR engine API in small batches
    """

    def __init__(
        self,
        engine_url: str = "http://127.0.0.1:8765",
        poll_interval_s: float = 1.0,
        idle_threshold_s: float = 30.0,
    ):
        super().__init__(daemon=True, name="CLR-DesktopAgent")
        self.engine_url = engine_url.rstrip("/")
        self.poll_interval_s = poll_interval_s
        self.idle_threshold_s = idle_threshold_s
        self._stop_event = threading.Event()
        self._buffer: list[dict] = []
        self._last_app = ""
        self._last_active_at = time.time()
        self._is_idle = False

    # ------------------------------------------------------------------
    # Thread lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        super().start()

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        flush_counter = 0
        while not self._stop_event.is_set():
            self._tick()
            flush_counter += 1
            if flush_counter >= 5:          # flush every ~5 polls
                self._flush()
                flush_counter = 0
            time.sleep(self.poll_interval_s)
        self._flush()                        # final flush on shutdown

    # ------------------------------------------------------------------
    # Polling logic
    # ------------------------------------------------------------------

    def _tick(self) -> None:
        now = time.time()
        win = _get_active_window()

        if win is None:
            return

        # Window changed
        if win.app != self._last_app:
            self._push_event("WINDOW_FOCUS", {
                "app": win.app,
                "title": win.title,
            })
            self._last_app = win.app
            self._last_active_at = now
            if self._is_idle:
                self._push_event("MOUSE_ACTIVE", {})
                self._is_idle = False
        else:
            # Idle detection: no window change for idle_threshold_s
            idle_duration = now - self._last_active_at
            if idle_duration >= self.idle_threshold_s and not self._is_idle:
                self._push_event("MOUSE_IDLE", {"duration_s": idle_duration})
                self._is_idle = True

    def _push_event(self, event_type: str, data: dict) -> None:
        self._buffer.append({
            "source": "desktop",
            "type": event_type,
            "timestamp": time.time(),
            "data": data,
        })

    # ------------------------------------------------------------------
    # HTTP flush
    # ------------------------------------------------------------------

    def _flush(self) -> None:
        if not self._buffer:
            return
        batch = self._buffer[:]
        self._buffer.clear()
        try:
            payload = json.dumps(batch).encode()
            req = urllib.request.Request(
                f"{self.engine_url}/telemetry/batch",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=3):
                pass
        except (urllib.error.URLError, OSError):
            pass  # Engine not running — silently discard


# ---------------------------------------------------------------------------
# Standalone entry point
# ---------------------------------------------------------------------------

def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="CLR Desktop Agent")
    parser.add_argument("--url", default="http://127.0.0.1:8765", help="Engine API URL")
    parser.add_argument("--interval", type=float, default=1.0, help="Poll interval (seconds)")
    args = parser.parse_args()

    agent = DesktopAgent(engine_url=args.url, poll_interval_s=args.interval)
    agent.start()
    print(f"Desktop agent running (polling every {args.interval}s → {args.url})")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping…")
        agent.stop()
        agent.join(timeout=5)


if __name__ == "__main__":
    main()
