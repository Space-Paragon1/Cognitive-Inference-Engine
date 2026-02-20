"""Tests for telemetry source parsers."""

import time

import pytest

from engine.telemetry.sources.browser import parse_browser_event, _is_academic_url
from engine.telemetry.sources.ide import parse_ide_event
from engine.telemetry.sources.desktop import parse_desktop_event


class TestBrowserParser:
    def test_tab_switch_parsed(self):
        evt = parse_browser_event({
            "type": "TAB_SWITCH",
            "data": {"fromUrl": "https://reddit.com", "toUrl": "https://arxiv.org/abs/123"},
        })
        assert evt is not None
        assert evt.event_type == "tab_switch"
        assert evt.metadata["is_academic"] is True

    def test_unknown_type_returns_none(self):
        evt = parse_browser_event({"type": "UNKNOWN_XYZ", "data": {}})
        assert evt is None

    def test_timestamp_defaults_to_now(self):
        before = time.time()
        evt = parse_browser_event({"type": "NAVIGATION", "data": {"url": "https://google.com"}})
        after = time.time()
        assert evt is not None
        assert before <= evt.timestamp <= after

    def test_scroll_captures_delta(self):
        evt = parse_browser_event({
            "type": "PAGE_SCROLL",
            "data": {"deltaY": 250, "url": "https://example.com"},
        })
        assert evt is not None
        assert evt.metadata["delta_y"] == 250

    def test_is_academic_url(self):
        assert _is_academic_url("https://arxiv.org/abs/123") is True
        assert _is_academic_url("https://www.reddit.com/r/python") is False
        assert _is_academic_url("https://scholar.google.com/scholar?q=test") is True


class TestIdeParser:
    def test_compile_error_parsed(self):
        evt = parse_ide_event({
            "type": "COMPILE_ERROR",
            "data": {"errorCount": 3, "language": "python", "file": "main.py"},
        })
        assert evt is not None
        assert evt.event_type == "compile_error"
        assert evt.metadata["error_count"] == 3

    def test_keystroke_captures_interval(self):
        evt = parse_ide_event({
            "type": "KEYSTROKE",
            "data": {"intervalMs": 120},
        })
        assert evt is not None
        assert evt.metadata["interval_ms"] == 120

    def test_test_fail_maps_to_compile_error(self):
        evt = parse_ide_event({"type": "TEST_FAIL", "data": {}})
        assert evt is not None
        assert evt.event_type == "compile_error"

    def test_unknown_type_returns_none(self):
        assert parse_ide_event({"type": "TOTALLY_UNKNOWN", "data": {}}) is None


class TestDesktopParser:
    def test_window_focus_parsed(self):
        evt = parse_desktop_event({
            "type": "WINDOW_FOCUS",
            "data": {"app": "VSCode", "title": "main.py"},
        })
        assert evt is not None
        assert evt.event_type == "window_change"
        assert evt.metadata["app"] == "VSCode"

    def test_mouse_idle_parsed(self):
        evt = parse_desktop_event({"type": "MOUSE_IDLE", "data": {}})
        assert evt is not None
        assert evt.event_type == "idle_start"

    def test_unknown_returns_none(self):
        assert parse_desktop_event({"type": "BOGUS", "data": {}}) is None
