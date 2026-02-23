"""Tests for SignalProcessor."""

import time

import pytest

from engine.inference.signal_processor import SignalProcessor, TelemetryEvent


def _evt(event_type: str, metadata: dict = {}) -> TelemetryEvent:
    return TelemetryEvent(source="browser", event_type=event_type, metadata=metadata)


class TestSignalProcessor:
    def test_empty_features_are_zero(self):
        proc = SignalProcessor(window_seconds=60)
        f = proc.extract_features()
        assert f.tab_switch_rate == 0.0
        assert f.compile_error_rate == 0.0
        assert f.idle_fraction == 0.0

    def test_tab_switch_rate_counted(self):
        proc = SignalProcessor(window_seconds=300)
        for _ in range(5):
            proc.push(_evt("tab_switch"))
        f = proc.extract_features()
        # rate_window_min floors at 1.0 when elapsed < 1 min (fresh session)
        # → rate = 5 / 1.0 = 5.0 events/min
        assert f.tab_switch_rate == 5.0

    def test_compile_error_rate_counted(self):
        proc = SignalProcessor(window_seconds=300)
        for _ in range(3):
            proc.push(_evt("compile_error"))
        f = proc.extract_features()
        # Fresh session → rate_window_min = 1.0 → rate = 3 / 1.0 = 3.0
        assert f.compile_error_rate == 3.0

    def test_typing_burst_score_zero_without_keystrokes(self):
        proc = SignalProcessor(window_seconds=300)
        f = proc.extract_features()
        assert f.typing_burst_score == 0.0

    def test_typing_burst_score_nonzero_with_variance(self):
        proc = SignalProcessor(window_seconds=300)
        # Highly variable intervals → high burst score
        for interval in [10, 500, 20, 800, 5]:
            proc.push(_evt("keystroke", {"interval_ms": interval}))
        f = proc.extract_features()
        assert f.typing_burst_score > 0.0
        assert f.typing_burst_score <= 1.0

    def test_stale_events_evicted(self):
        proc = SignalProcessor(window_seconds=1)
        # Push event with a timestamp in the past
        old_event = TelemetryEvent(
            source="browser",
            event_type="tab_switch",
            timestamp=time.time() - 10,
        )
        proc.push(old_event)
        f = proc.extract_features()
        assert f.tab_switch_rate == 0.0  # evicted

    def test_scroll_velocity_normalized(self):
        proc = SignalProcessor(window_seconds=300)
        proc.push(_evt("scroll", {"delta_y": 1500}))
        f = proc.extract_features()
        assert 0.0 < f.scroll_velocity_norm <= 1.0

    def test_app_entropy_single_app_is_zero(self):
        proc = SignalProcessor(window_seconds=300)
        for _ in range(5):
            proc.push(_evt("window_change", {"app": "VSCode"}))
        f = proc.extract_features()
        assert f.task_switch_entropy == 0.0

    def test_app_entropy_multiple_apps(self):
        proc = SignalProcessor(window_seconds=300)
        for app in ["VSCode", "Chrome", "Discord", "Notion"]:
            for _ in range(3):
                proc.push(_evt("window_change", {"app": app}))
        f = proc.extract_features()
        assert f.task_switch_entropy > 0.5  # high entropy with 4 equal apps

    def test_reset_session(self):
        proc = SignalProcessor(window_seconds=300)
        t_before = proc._session_start
        time.sleep(0.01)
        proc.reset_session()
        assert proc._session_start > t_before
