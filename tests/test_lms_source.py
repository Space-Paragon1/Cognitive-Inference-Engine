"""Tests for the LMS telemetry source parser."""

import pytest

from engine.telemetry.sources.lms import parse_lms_event


def _payload(event_type: str, data: dict | None = None) -> dict:
    return {"type": event_type, "timestamp": 1_700_000_000.0, "data": data or {}}


# ── Event type routing ────────────────────────────────────────────────────────

def test_assignment_view_becomes_window_change():
    result = parse_lms_event(_payload("ASSIGNMENT_VIEW", {"lms": "canvas", "course": "CS 101"}))
    assert result is not None
    assert result.event_type == "window_change"
    assert result.source == "lms"
    assert result.metadata["lms"] == "canvas"
    assert result.metadata["course"] == "CS 101"
    assert "canvas:" in result.metadata["app"]


def test_quiz_start_becomes_window_change():
    result = parse_lms_event(_payload("QUIZ_START", {"lms": "blackboard", "course": "MATH 201"}))
    assert result is not None
    assert result.event_type == "window_change"
    assert result.metadata["app"] == "blackboard:quiz"


def test_quiz_fail_becomes_compile_error():
    result = parse_lms_event(_payload("QUIZ_FAIL", {"lms": "canvas", "course": "CS 101"}))
    assert result is not None
    assert result.event_type == "compile_error"
    assert result.metadata["lms_event"] == "QUIZ_FAIL"


def test_submission_late_becomes_compile_error():
    result = parse_lms_event(_payload("SUBMISSION_LATE", {"lms": "moodle", "course": "BIO 110"}))
    assert result is not None
    assert result.event_type == "compile_error"


def test_course_navigate_becomes_tab_switch():
    result = parse_lms_event(_payload("COURSE_NAVIGATE", {"lms": "canvas"}))
    assert result is not None
    assert result.event_type == "tab_switch"


def test_discussion_view_becomes_tab_switch():
    result = parse_lms_event(_payload("DISCUSSION_VIEW", {}))
    assert result is not None
    assert result.event_type == "tab_switch"


def test_lms_scroll_becomes_scroll():
    result = parse_lms_event(_payload("LMS_SCROLL", {"deltaY": 500}))
    assert result is not None
    assert result.event_type == "scroll"
    assert result.metadata["delta_y"] == 500


def test_lms_idle_becomes_idle_start():
    result = parse_lms_event(_payload("LMS_IDLE", {"lms": "canvas", "course": "CS 101"}))
    assert result is not None
    assert result.event_type == "idle_start"


def test_lms_active_becomes_idle_end():
    result = parse_lms_event(_payload("LMS_ACTIVE", {}))
    assert result is not None
    assert result.event_type == "idle_end"


def test_page_hidden_becomes_idle_start():
    result = parse_lms_event(_payload("PAGE_HIDDEN", {}))
    assert result is not None
    assert result.event_type == "idle_start"


def test_page_visible_becomes_idle_end():
    result = parse_lms_event(_payload("PAGE_VISIBLE", {}))
    assert result is not None
    assert result.event_type == "idle_end"


def test_unknown_event_returns_none():
    result = parse_lms_event(_payload("TOTALLY_UNKNOWN_EVENT", {}))
    assert result is None


def test_timestamp_preserved():
    result = parse_lms_event(_payload("ASSIGNMENT_VIEW", {}))
    assert result is not None
    assert result.timestamp == 1_700_000_000.0


def test_grade_view_becomes_window_change():
    result = parse_lms_event(_payload("GRADE_VIEW", {"lms": "canvas", "course": "CS 101", "title": "Grade summary"}))
    assert result is not None
    assert result.event_type == "window_change"
    assert result.metadata["app"] == "canvas:grades"
