"""
Desktop Activity Receiver — processes events from the desktop agent
(active window monitoring, interaction rhythm).
"""

from __future__ import annotations

import time
from typing import Any, Dict

from ...inference.signal_processor import TelemetryEvent

_EVENT_MAP: Dict[str, str] = {
    "WINDOW_FOCUS": "window_change",
    "WINDOW_BLUR": "window_change",
    "MOUSE_IDLE": "idle_start",
    "MOUSE_ACTIVE": "idle_end",
    "SCREEN_LOCK": "idle_start",
    "SCREEN_UNLOCK": "idle_end",
}


def parse_desktop_event(payload: Dict[str, Any]) -> TelemetryEvent | None:
    """
    Parse a desktop agent event payload.

    Expected shape:
    {
        "type": "WINDOW_FOCUS",
        "timestamp": 1700000000.123,
        "data": { "app": "VSCode", "title": "main.py — project" }
    }
    """
    raw_type = payload.get("type", "")
    internal_type = _EVENT_MAP.get(raw_type)
    if not internal_type:
        return None

    data = payload.get("data", {})
    timestamp = float(payload.get("timestamp", time.time()))

    metadata: Dict[str, Any] = {}

    if internal_type == "window_change":
        metadata["app"] = data.get("app", "unknown")
        metadata["title"] = data.get("title", "")

    return TelemetryEvent(
        source="desktop",
        event_type=internal_type,
        timestamp=timestamp,
        metadata=metadata,
    )
