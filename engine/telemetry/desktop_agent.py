"""
Desktop Agent — background thread that polls the active window and the
OS input-idle time, and POSTs events to the CLR engine with a device token.

Pair once (get the code from the dashboard → Settings → Connect a device):
    python -m engine.telemetry.desktop_agent --url https://your-engine.example --pair K7QM-9TXR

Then just run it; the engine URL and token are remembered:
    python -m engine.telemetry.desktop_agent

Or import and start programmatically (uses the saved pairing):
    from engine.telemetry.desktop_agent import DesktopAgent
    agent = DesktopAgent(); agent.start()
"""

from __future__ import annotations

import ctypes
import ctypes.wintypes
import json
import os
import platform
import re
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
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
            if ctypes.windll.kernel32.QueryFullProcessImageNameW(
                handle, 0, buf, ctypes.byref(size)
            ):
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
             "tell application \"System Events\" to get name of "
             "first application process whose frontmost is true"],
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
# Input idle time (seconds since the last keyboard/mouse input)
# ---------------------------------------------------------------------------

def _input_idle_seconds_win32() -> Optional[float]:
    try:
        class LASTINPUTINFO(ctypes.Structure):
            _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]

        info = LASTINPUTINFO()
        info.cbSize = ctypes.sizeof(LASTINPUTINFO)
        if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(info)):
            return None
        millis = ctypes.windll.kernel32.GetTickCount() - info.dwTime
        return max(millis, 0) / 1000.0
    except Exception:
        return None


_HID_IDLE_RE = re.compile(r'"HIDIdleTime"\s*=\s*(\d+)')


def _input_idle_seconds_macos() -> Optional[float]:
    try:
        out = subprocess.run(
            ["ioreg", "-c", "IOHIDSystem", "-d", "4"],
            capture_output=True, text=True, timeout=2,
        ).stdout
        match = _HID_IDLE_RE.search(out)
        return int(match.group(1)) / 1e9 if match else None   # nanoseconds
    except Exception:
        return None


def _input_idle_seconds_linux() -> Optional[float]:
    try:   # needs the xprintidle package (X11)
        out = subprocess.run(["xprintidle"], capture_output=True, text=True, timeout=2).stdout
        return int(out.strip()) / 1000.0
    except Exception:
        return None


def _input_idle_seconds() -> Optional[float]:
    """None when the platform gives us no way to tell."""
    if sys.platform == "win32":
        return _input_idle_seconds_win32()
    if sys.platform == "darwin":
        return _input_idle_seconds_macos()
    return _input_idle_seconds_linux()


# ---------------------------------------------------------------------------
# Saved pairing (engine URL + device token)
# ---------------------------------------------------------------------------

DEFAULT_ENGINE_URL = "http://127.0.0.1:8765"


def config_path() -> Path:
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home()))
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    return base / "clr" / "desktop-agent.json"


def load_saved_config() -> dict:
    try:
        return json.loads(config_path().read_text())
    except (OSError, ValueError):
        return {}


def save_config(engine_url: str, device_token: str) -> Path:
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"engine_url": engine_url, "device_token": device_token}, indent=2))
    try:
        path.chmod(0o600)   # the token is a credential
    except OSError:
        pass
    return path


def pair(engine_url: str, code: str) -> dict:
    """Exchange a pairing code for a device token and save it. Returns the claim response."""
    engine_url = engine_url.rstrip("/")
    body = json.dumps({
        "code": code,
        "name": f"Desktop agent on {socket.gethostname() or platform.system()}",
        "kind": "desktop",
    }).encode()
    req = urllib.request.Request(
        f"{engine_url}/devices/claim",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read())
    except urllib.error.HTTPError as e:
        detail = json.loads(e.read() or b"{}").get("detail", f"HTTP {e.code}")
        raise RuntimeError(detail) from None
    save_config(engine_url, data["device_token"])
    return data


# ---------------------------------------------------------------------------
# Desktop Agent
# ---------------------------------------------------------------------------

class DesktopAgent(threading.Thread):
    """
    Background thread that:
    1. Polls the active window every `poll_interval_s` seconds
    2. Emits WINDOW_FOCUS events when the app changes
    3. Emits MOUSE_IDLE / MOUSE_ACTIVE from the OS input-idle time
    4. POSTs events to the CLR engine in small batches, with the device token
    """

    def __init__(
        self,
        engine_url: Optional[str] = None,
        device_token: Optional[str] = None,
        poll_interval_s: float = 1.0,
        idle_threshold_s: float = 60.0,
    ):
        super().__init__(daemon=True, name="CLR-DesktopAgent")
        saved = load_saved_config()
        self.engine_url = (
            engine_url or os.environ.get("CLR_ENGINE_URL") or saved.get("engine_url")
            or DEFAULT_ENGINE_URL
        ).rstrip("/")
        self.device_token = (
            device_token or os.environ.get("CLR_DEVICE_TOKEN") or saved.get("device_token")
        )
        self.poll_interval_s = poll_interval_s
        self.idle_threshold_s = idle_threshold_s
        self._stop_event = threading.Event()
        self._buffer: list[dict] = []
        self._last_app = ""
        self._is_idle = False
        self._warned_auth = False

    # ------------------------------------------------------------------
    # Thread lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        if not self.device_token:
            print(
                "[CLR desktop agent] Not paired, so no data will be sent. Pair with:\n"
                "  python -m engine.telemetry.desktop_agent --url <engine url> --pair <code>"
            )
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
        idle_s = _input_idle_seconds()
        if idle_s is not None:
            if idle_s >= self.idle_threshold_s and not self._is_idle:
                self._push_event("MOUSE_IDLE", {"duration_s": round(idle_s, 1)})
                self._is_idle = True
            elif idle_s < self.idle_threshold_s and self._is_idle:
                self._push_event("MOUSE_ACTIVE", {})
                self._is_idle = False

        win = _get_active_window()
        if win is None:
            return
        if win.app != self._last_app:
            self._push_event("WINDOW_FOCUS", {"app": win.app, "title": win.title})
            self._last_app = win.app

    def _push_event(self, event_type: str, data: dict) -> None:
        self._buffer.append({
            "source": "desktop",
            "type": event_type,
            "timestamp": time.time(),
            "data": data,
        })
        if len(self._buffer) > 500:
            del self._buffer[:-500]

    # ------------------------------------------------------------------
    # HTTP flush
    # ------------------------------------------------------------------

    def _flush(self) -> None:
        if not self._buffer:
            return
        if not self.device_token:
            self._buffer.clear()   # not paired: don't hold activity data for nobody
            return
        batch = self._buffer[:]
        self._buffer.clear()
        try:
            req = urllib.request.Request(
                f"{self.engine_url}/telemetry/batch",
                data=json.dumps(batch).encode(),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.device_token}",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5):
                pass
        except urllib.error.HTTPError as e:
            if e.code == 401 and not self._warned_auth:
                self._warned_auth = True
                print("[CLR desktop agent] The engine rejected this device token "
                      "(revoked?). Pair again with --pair <code>.")
            elif e.code >= 500:
                self._buffer[:0] = batch
        except (urllib.error.URLError, OSError):
            self._buffer[:0] = batch[-500:]   # engine unreachable — retry next flush


# ---------------------------------------------------------------------------
# Standalone entry point
# ---------------------------------------------------------------------------

def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="CLR Desktop Agent")
    parser.add_argument("--url", default=None, help="Engine API URL (remembered after --pair)")
    parser.add_argument("--pair", metavar="CODE", help="Pairing code from the dashboard")
    parser.add_argument("--interval", type=float, default=1.0, help="Poll interval (seconds)")
    args = parser.parse_args()

    if args.pair:
        url = args.url or load_saved_config().get("engine_url") or DEFAULT_ENGINE_URL
        try:
            data = pair(url, args.pair)
        except (RuntimeError, urllib.error.URLError, OSError) as e:
            raise SystemExit(f"Pairing failed: {e}")
        print(f"Paired as {data['user_email']}. Saved to {config_path()}")

    agent = DesktopAgent(engine_url=args.url, poll_interval_s=args.interval)
    agent.start()
    print(f"Desktop agent running (polling every {args.interval}s → {agent.engine_url})")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping…")
        agent.stop()
        agent.join(timeout=5)


if __name__ == "__main__":
    main()
