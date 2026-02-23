"""
LMS Telemetry Source — Canvas, Blackboard, Moodle.

Maps LMS-specific interaction events to the internal signal types that the
SignalProcessor understands, so the load estimator can incorporate academic
context (quiz pressure, overdue work, deep reading) into its inference.

Event mapping rationale
-----------------------
LMS event           Internal type     Signal meaning
-----------         -------------     ---------------
ASSIGNMENT_VIEW     window_change     Content navigation (context switch)
QUIZ_START          window_change     High-stakes context change
QUIZ_FAIL           compile_error     Task difficulty / intrinsic load
SUBMISSION_LATE     compile_error     Stress / deadline pressure
COURSE_NAVIGATE     tab_switch        Context switching rate
DISCUSSION_VIEW     tab_switch        Shallow-work browsing
RESOURCE_OPEN       window_change     Active academic engagement
LMS_SCROLL          scroll            Deep reading signal
LMS_IDLE            idle_start        Student left LMS page
LMS_ACTIVE          idle_end          Student returned
"""

from __future__ import annotations

import time
from typing import Any, Dict

from ...inference.signal_processor import TelemetryEvent

# High-stakes events that add intrinsic load (mapped to compile_error internally)
_INTRINSIC_EVENTS = {"QUIZ_FAIL", "QUIZ_RETRY", "SUBMISSION_LATE", "GRADE_FAIL"}

# Context-switching events (mapped to tab_switch)
_SWITCH_EVENTS = {"COURSE_NAVIGATE", "DISCUSSION_VIEW", "TAB_SWITCH"}

# Window/app-change events (mapped to window_change)
_WINDOW_EVENTS = {
    "ASSIGNMENT_VIEW",
    "QUIZ_START",
    "QUIZ_SUBMIT",
    "RESOURCE_OPEN",
    "GRADE_VIEW",
    "ANNOUNCEMENT_VIEW",
}

# Reading/scroll events
_SCROLL_EVENTS = {"LMS_SCROLL", "RESOURCE_SCROLL"}

# Idle transitions
_IDLE_START_EVENTS = {"LMS_IDLE", "PAGE_HIDDEN"}
_IDLE_END_EVENTS = {"LMS_ACTIVE", "PAGE_VISIBLE"}


def parse_lms_event(payload: Dict[str, Any]) -> TelemetryEvent | None:
    """
    Parse a raw LMS connector payload into a TelemetryEvent.
    Returns None if the event type is unknown or malformed.

    Expected payload shape:
    {
        "type": "ASSIGNMENT_VIEW",
        "timestamp": 1700000000.123,   # optional, defaults to now
        "data": {
            "lms":     "canvas",       # canvas | blackboard | moodle
            "course":  "CS 101",
            "title":   "Week 3 Quiz",
            "url":     "https://canvas.university.edu/...",
            "deltaY":  1200            # for scroll events
        }
    }
    """
    raw_type = payload.get("type", "")
    data = payload.get("data", {})
    timestamp = float(payload.get("timestamp", time.time()))
    lms_platform = data.get("lms", "lms")
    course = data.get("course", "unknown")
    title = data.get("title", "")

    if raw_type in _INTRINSIC_EVENTS:
        return TelemetryEvent(
            source="lms",
            event_type="compile_error",
            timestamp=timestamp,
            metadata={
                "lms": lms_platform,
                "course": course,
                "title": title,
                "lms_event": raw_type,
            },
        )

    if raw_type in _SWITCH_EVENTS:
        return TelemetryEvent(
            source="lms",
            event_type="tab_switch",
            timestamp=timestamp,
            metadata={
                "lms": lms_platform,
                "course": course,
                "title": title,
                "from_url": data.get("fromUrl", ""),
                "to_url": data.get("toUrl", data.get("url", "")),
                "lms_event": raw_type,
            },
        )

    if raw_type in _WINDOW_EVENTS:
        return TelemetryEvent(
            source="lms",
            event_type="window_change",
            timestamp=timestamp,
            metadata={
                "app": f"{lms_platform}:{_lms_section(raw_type)}",
                "lms": lms_platform,
                "course": course,
                "title": title,
                "lms_event": raw_type,
            },
        )

    if raw_type in _SCROLL_EVENTS:
        return TelemetryEvent(
            source="lms",
            event_type="scroll",
            timestamp=timestamp,
            metadata={
                "delta_y": data.get("deltaY", 0),
                "lms": lms_platform,
                "course": course,
                "lms_event": raw_type,
            },
        )

    if raw_type in _IDLE_START_EVENTS:
        return TelemetryEvent(
            source="lms",
            event_type="idle_start",
            timestamp=timestamp,
            metadata={"lms": lms_platform, "course": course},
        )

    if raw_type in _IDLE_END_EVENTS:
        return TelemetryEvent(
            source="lms",
            event_type="idle_end",
            timestamp=timestamp,
            metadata={"lms": lms_platform, "course": course},
        )

    return None


def _lms_section(raw_type: str) -> str:
    """Map raw LMS event type to a short section label for app entropy tracking."""
    _SECTION_MAP = {
        "ASSIGNMENT_VIEW": "assignment",
        "QUIZ_START": "quiz",
        "QUIZ_SUBMIT": "quiz",
        "RESOURCE_OPEN": "resource",
        "GRADE_VIEW": "grades",
        "ANNOUNCEMENT_VIEW": "announcement",
    }
    return _SECTION_MAP.get(raw_type, "lms")
