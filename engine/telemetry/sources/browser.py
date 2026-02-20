"""
Browser Telemetry Receiver — accepts events POSTed by the browser extension
and converts them to TelemetryEvent objects for the aggregator.
"""

from __future__ import annotations

import time
from typing import Any, Dict

from ...inference.signal_processor import TelemetryEvent

# Mapping from browser extension event names → internal event_type strings
_EVENT_MAP: Dict[str, str] = {
    "TAB_SWITCH": "tab_switch",
    "TAB_CLOSE": "tab_switch",
    "NAVIGATION": "navigation",
    "PAGE_SCROLL": "scroll",
    "FOCUS_LOST": "window_change",
    "FOCUS_GAINED": "window_change",
    "IDLE_START": "idle_start",
    "IDLE_END": "idle_end",
}


def parse_browser_event(payload: Dict[str, Any]) -> TelemetryEvent | None:
    """
    Parse a raw browser extension payload into a TelemetryEvent.
    Returns None if the event type is unknown or malformed.

    Expected payload shape:
    {
        "type": "TAB_SWITCH",
        "timestamp": 1700000000.123,   # optional, defaults to now
        "data": { ...event-specific fields... }
    }
    """
    raw_type = payload.get("type", "")
    internal_type = _EVENT_MAP.get(raw_type)
    if not internal_type:
        return None

    data = payload.get("data", {})
    timestamp = float(payload.get("timestamp", time.time()))

    metadata: Dict[str, Any] = {}

    if internal_type == "tab_switch":
        metadata["from_url"] = data.get("fromUrl", "")
        metadata["to_url"] = data.get("toUrl", "")
        metadata["is_academic"] = _is_academic_url(data.get("toUrl", ""))

    elif internal_type == "scroll":
        metadata["delta_y"] = data.get("deltaY", 0)
        metadata["url"] = data.get("url", "")

    elif internal_type == "navigation":
        metadata["url"] = data.get("url", "")
        metadata["is_academic"] = _is_academic_url(data.get("url", ""))

    return TelemetryEvent(
        source="browser",
        event_type=internal_type,
        timestamp=timestamp,
        metadata=metadata,
    )


# Heuristic academic URL detection — extend as needed
_ACADEMIC_DOMAINS = {
    "scholar.google.com",
    "arxiv.org",
    "pubmed.ncbi.nlm.nih.gov",
    "jstor.org",
    "semanticscholar.org",
    "coursera.org",
    "edx.org",
    "khanacademy.org",
    "stackoverflow.com",
    "docs.python.org",
    "developer.mozilla.org",
}


def _is_academic_url(url: str) -> bool:
    try:
        from urllib.parse import urlparse
        host = urlparse(url).netloc.lower().lstrip("www.")
        return any(host == d or host.endswith("." + d) for d in _ACADEMIC_DOMAINS)
    except Exception:
        return False
