"""
IDE Telemetry Receiver — processes events from the VSCode extension.
"""

from __future__ import annotations

import time
from typing import Any, Dict

from ...inference.signal_processor import TelemetryEvent

_EVENT_MAP: Dict[str, str] = {
    "COMPILE_ERROR": "compile_error",
    "COMPILE_SUCCESS": "compile_success",
    "FILE_SAVE": "file_save",
    "FILE_SWITCH": "window_change",
    "KEYSTROKE": "keystroke",
    "DEBUG_START": "debug_start",
    "DEBUG_STOP": "debug_stop",
    "TEST_FAIL": "compile_error",   # treat test failure same as compile error for load
    "TEST_PASS": "compile_success",
    "TERMINAL_CMD": "terminal_cmd",
}


def parse_ide_event(payload: Dict[str, Any]) -> TelemetryEvent | None:
    """
    Parse a VSCode extension event payload.

    Expected shape:
    {
        "type": "COMPILE_ERROR",
        "timestamp": 1700000000.123,
        "data": { "language": "python", "errorCount": 3, ... }
    }
    """
    raw_type = payload.get("type", "")
    internal_type = _EVENT_MAP.get(raw_type)
    if not internal_type:
        return None

    data = payload.get("data", {})
    timestamp = float(payload.get("timestamp", time.time()))

    metadata: Dict[str, Any] = {
        "language": data.get("language", "unknown"),
    }

    if internal_type == "compile_error":
        metadata["error_count"] = data.get("errorCount", 1)
        metadata["file"] = data.get("file", "")

    elif internal_type == "keystroke":
        metadata["interval_ms"] = data.get("intervalMs", 0)

    elif internal_type == "window_change":
        metadata["app"] = "vscode"
        metadata["file"] = data.get("file", "")

    elif internal_type == "terminal_cmd":
        metadata["command"] = data.get("command", "")

    return TelemetryEvent(
        source="ide",
        event_type=internal_type,
        timestamp=timestamp,
        metadata=metadata,
    )
