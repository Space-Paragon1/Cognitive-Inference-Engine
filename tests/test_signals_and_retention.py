"""
Signal fixes (time-based idle, scroll velocity, sessions), tick persistence,
timeline retention, and the ML model version guard.
"""

from __future__ import annotations

import time

import joblib
import pytest
from sqlalchemy import create_engine

from engine.db.connection import metadata
from engine.inference.ml_estimator import FEATURE_COLS, load_bundled_model
from engine.inference.signal_processor import SignalProcessor, TelemetryEvent
from engine.telemetry.aggregator import TelemetryAggregator
from engine.telemetry.timeline import CognitiveTimeline, TimelineEntry


def _evt(event_type, ago=0.0, source="browser", **metadata):
    return TelemetryEvent(
        source=source, event_type=event_type, timestamp=time.time() - ago, metadata=metadata
    )


@pytest.fixture
def tl():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    metadata.create_all(engine)
    return CognitiveTimeline(engine)


class TestIdleFraction:
    def test_continuous_activity_is_not_idle(self):
        proc = SignalProcessor(window_seconds=300)
        for ago in range(240, -1, -20):
            proc.push(_evt("tab_switch", ago=ago))
        assert proc.extract_features().idle_fraction == 0.0

    def test_long_silence_counts_as_idle(self):
        proc = SignalProcessor(window_seconds=300)
        proc.push(_evt("tab_switch", ago=240))
        proc.push(_evt("tab_switch", ago=120))   # 120 s gap → idle
        proc.push(_evt("tab_switch", ago=0))     # another 120 s gap → idle
        f = proc.extract_features()
        assert f.idle_fraction == pytest.approx(1.0, abs=0.02)

    def test_explicit_idle_start_counts_until_next_activity(self):
        proc = SignalProcessor(window_seconds=300)
        proc.push(_evt("tab_switch", ago=100))
        proc.push(_evt("idle_start", ago=90))    # idle from here...
        proc.push(_evt("idle_end", ago=40))      # ...to here: 50 of 100 s
        proc.push(_evt("tab_switch", ago=20))
        proc.push(_evt("tab_switch", ago=0))
        assert proc.extract_features().idle_fraction == pytest.approx(0.5, abs=0.03)

    def test_idle_events_alone_are_not_counted_per_event(self):
        """Old bug: two idle_start events out of four meant 50% idle regardless of time."""
        proc = SignalProcessor(window_seconds=300)
        proc.push(_evt("tab_switch", ago=10))
        proc.push(_evt("idle_start", ago=9))
        proc.push(_evt("idle_end", ago=8.5))
        proc.push(_evt("tab_switch", ago=0))
        assert proc.extract_features().idle_fraction < 0.1


class TestScrollAndSessions:
    def test_velocity_metadata_preferred(self):
        proc = SignalProcessor(window_seconds=300)
        proc.push(_evt("scroll", delta_y=90000, velocity=1500))
        assert proc.extract_features().scroll_velocity_norm == pytest.approx(0.5)

    def test_session_restarts_after_long_gap(self):
        proc = SignalProcessor(window_seconds=300, session_gap_s=600)
        proc.push(_evt("tab_switch", ago=2000))
        proc.push(_evt("tab_switch", ago=0))
        assert proc.extract_features().session_duration_min < 0.1

    def test_future_timestamps_clamped(self):
        proc = SignalProcessor(window_seconds=1)
        proc.push(_evt("tab_switch", ago=-3600))   # an hour in the future
        time.sleep(1.1)
        assert proc.has_recent_activity() is False

    def test_out_of_order_events_kept_sorted(self):
        proc = SignalProcessor(window_seconds=300)
        proc.push(_evt("tab_switch", ago=1))
        proc.push(_evt("tab_switch", ago=30))
        ts = [e.timestamp for e in proc._events]
        assert ts == sorted(ts)

    def test_no_events_means_no_data(self):
        f = SignalProcessor(window_seconds=300).extract_features()
        assert f.idle_fraction == 0.0 and f.session_duration_min == 0.0


class TestTickPersistence:
    def test_no_rows_without_activity(self, tl):
        agg = TelemetryAggregator(tl, user_id=5)
        for _ in range(3):
            agg.tick()
        assert tl.query() == []
        assert agg.current_state()["confidence"] == 0.0

    def test_rows_carry_user_id(self, tl):
        agg = TelemetryAggregator(tl, user_id=5)
        agg.push_event(_evt("tab_switch"))
        agg.tick()
        rows = tl.query(user_id=5)
        assert len(rows) == 1 and rows[0].user_id == 5
        assert tl.query(user_id=6) == []


class TestRetention:
    def test_old_ticks_thinned_to_one_per_minute(self, tl):
        base = 1_700_000_000.0
        for i in range(60):                      # one tick every 2 s for 2 minutes
            tl.append(TimelineEntry(None, base + i * 2, "engine", "inference_tick", 0.5,
                                    "deep_focus", "{}", user_id=1))
        recent = time.time()
        tl.append(TimelineEntry(None, recent, "engine", "inference_tick", 0.5,
                                "deep_focus", "{}", user_id=1))

        deleted = tl.downsample_before(cutoff_ts=recent - 1)
        remaining = tl.query(limit=1000)
        assert deleted > 50
        assert len(remaining) <= 4           # ~1 per minute bucket + the recent tick
        assert any(e.timestamp == recent for e in remaining)

    def test_users_thinned_independently(self, tl):
        for uid in (1, 2):
            tl.append(TimelineEntry(None, 1000.0, "engine", "inference_tick", 0.5, "x", "{}", uid))
            tl.append(TimelineEntry(None, 1001.0, "engine", "inference_tick", 0.5, "x", "{}", uid))
        tl.downsample_before(cutoff_ts=5000.0)
        assert len(tl.query(user_id=1)) == 1
        assert len(tl.query(user_id=2)) == 1


class TestModelVersionGuard:
    def test_mismatched_sklearn_version_rejected(self, tmp_path):
        path = tmp_path / "model.joblib"
        joblib.dump({"model": object(), "sklearn_version": "0.1.0", "features": FEATURE_COLS}, path)
        assert load_bundled_model(path) is None

    def test_matching_version_loads(self, tmp_path):
        import sklearn

        path = tmp_path / "model.joblib"
        joblib.dump({"model": "fake", "sklearn_version": sklearn.__version__,
                     "features": FEATURE_COLS}, path)
        assert load_bundled_model(path) == "fake"

    def test_missing_model_is_none(self, tmp_path):
        assert load_bundled_model(tmp_path / "nope.joblib") is None
