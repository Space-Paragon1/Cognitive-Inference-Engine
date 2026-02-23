"""
Unit tests for CognitiveTimeline session detection and daily stats.

Uses an in-memory SQLite (`:memory:`) database so no filesystem access is needed.
"""

from __future__ import annotations

import time
from pathlib import Path

import pytest

from engine.telemetry.timeline import CognitiveTimeline, TimelineEntry

# ── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def tl(tmp_path):
    """A fresh CognitiveTimeline backed by a temp file."""
    return CognitiveTimeline(tmp_path / "test.db")


def _tick(tl: CognitiveTimeline, ts: float, load: float = 0.5, context: str = "deep_focus"):
    """Helper: append a single inference_tick entry at the given Unix timestamp."""
    tl.append(TimelineEntry(
        id=None,
        timestamp=ts,
        source="engine",
        event_type="inference_tick",
        load_score=load,
        context=context,
        metadata_json="{}",
    ))


# ── get_sessions ─────────────────────────────────────────────────────────────


def test_empty_timeline_returns_no_sessions(tl):
    assert tl.get_sessions() == []


def test_single_tick_forms_one_session(tl):
    _tick(tl, 1_700_000_000.0)
    sessions = tl.get_sessions()
    assert len(sessions) == 1
    s = sessions[0]
    assert s.tick_count == 1
    assert s.start_ts == s.end_ts


def test_consecutive_ticks_form_one_session(tl):
    base = 1_700_000_000.0
    for i in range(10):
        _tick(tl, base + i * 2.0)   # 2-second intervals — well within gap
    sessions = tl.get_sessions(gap_minutes=10.0)
    assert len(sessions) == 1
    assert sessions[0].tick_count == 10


def test_gap_splits_into_two_sessions(tl):
    base = 1_700_000_000.0
    for i in range(5):
        _tick(tl, base + i * 2.0)           # session 1: ~8 s
    gap_start = base + 5 * 2.0 + 15 * 60   # 15-minute gap
    for i in range(5):
        _tick(tl, gap_start + i * 2.0)      # session 2
    sessions = tl.get_sessions(gap_minutes=10.0)
    assert len(sessions) == 2
    assert sessions[0].tick_count == 5
    assert sessions[1].tick_count == 5


def test_session_duration_calculated_correctly(tl):
    base = 1_700_000_000.0
    for i in range(5):
        _tick(tl, base + i * 60.0)   # one tick per minute = 4-minute session
    sessions = tl.get_sessions()
    assert len(sessions) == 1
    assert abs(sessions[0].duration_minutes - 4.0) < 0.1


def test_session_avg_and_peak_load(tl):
    base = 1_700_000_000.0
    scores = [0.2, 0.4, 0.6, 0.8, 1.0]
    for i, s in enumerate(scores):
        _tick(tl, base + i * 2.0, load=s)
    session = tl.get_sessions()[0]
    assert abs(session.avg_load_score - sum(scores) / len(scores)) < 0.001
    assert session.peak_load_score == 1.0


def test_session_dominant_context(tl):
    base = 1_700_000_000.0
    contexts = ["deep_focus", "deep_focus", "deep_focus", "stuck", "stuck"]
    for i, ctx in enumerate(contexts):
        _tick(tl, base + i * 2.0, context=ctx)
    session = tl.get_sessions()[0]
    assert session.dominant_context == "deep_focus"


def test_session_context_distribution_sums_to_one(tl):
    base = 1_700_000_000.0
    for i, ctx in enumerate(["deep_focus", "deep_focus", "stuck", "shallow_work", "stuck"]):
        _tick(tl, base + i * 2.0, context=ctx)
    session = tl.get_sessions()[0]
    total = sum(session.context_distribution.values())
    assert abs(total - 1.0) < 0.001


def test_sessions_ordered_oldest_first(tl):
    base = 1_700_000_000.0
    # Two sessions separated by 20-minute gap
    for i in range(3):
        _tick(tl, base + i * 2.0)
    for i in range(3):
        _tick(tl, base + 20 * 60 + i * 2.0)
    sessions = tl.get_sessions()
    assert sessions[0].start_ts < sessions[1].start_ts


def test_get_sessions_respects_since_until(tl):
    base = 1_700_000_000.0
    for i in range(4):
        _tick(tl, base + i * 2.0)
    # Separate session 20 min later
    for i in range(4):
        _tick(tl, base + 20 * 60 + i * 2.0)
    # Query only the second session
    sessions = tl.get_sessions(since=base + 15 * 60)
    assert len(sessions) == 1
    assert sessions[0].start_ts >= base + 15 * 60


def test_non_engine_events_ignored_by_sessions(tl):
    """Browser and LMS events should not be counted as inference ticks."""
    base = 1_700_000_000.0
    for i in range(3):
        _tick(tl, base + i * 2.0)
    # Add a browser event — should be excluded from session detection
    tl.append(TimelineEntry(
        id=None, timestamp=base + 10.0, source="browser",
        event_type="tab_switch", load_score=0.0, context="unknown",
    ))
    sessions = tl.get_sessions()
    assert len(sessions) == 1
    assert sessions[0].tick_count == 3


def test_three_sessions(tl):
    base = 1_700_000_000.0
    for session_num in range(3):
        offset = session_num * 30 * 60      # 30-minute gap between sessions
        for i in range(5):
            _tick(tl, base + offset + i * 2.0)
    sessions = tl.get_sessions(gap_minutes=10.0)
    assert len(sessions) == 3


# ── get_daily_stats ──────────────────────────────────────────────────────────


def test_empty_timeline_returns_no_daily_stats(tl):
    assert tl.get_daily_stats() == []


def test_daily_stats_one_day(tl):
    # 2024-01-15 UTC midnight = 1705276800
    base = 1_705_276_800.0
    for i in range(10):
        _tick(tl, base + i * 2.0, load=0.4, context="deep_focus")
    stats = tl.get_daily_stats(since=base - 1, until=base + 3600)
    assert len(stats) == 1
    d = stats[0]
    assert d.tick_count == 10
    assert abs(d.avg_load_score - 0.4) < 0.001
    assert d.peak_load_score == 0.4


def test_daily_stats_multiple_days(tl):
    day1 = 1_705_276_800.0   # 2024-01-15 UTC
    day2 = day1 + 86_400     # 2024-01-16 UTC
    for i in range(5):
        _tick(tl, day1 + i * 2.0, context="deep_focus")
    for i in range(7):
        _tick(tl, day2 + i * 2.0, context="stuck")
    stats = tl.get_daily_stats(since=day1 - 1, until=day2 + 3600)
    assert len(stats) == 2
    assert stats[0].tick_count == 5
    assert stats[1].tick_count == 7


def test_daily_stats_context_distribution_sums_to_one(tl):
    base = 1_705_276_800.0
    for ctx in ["deep_focus", "deep_focus", "stuck", "fatigue"]:
        _tick(tl, base, context=ctx)
        base += 2.0
    stats = tl.get_daily_stats(since=base - 100)
    assert len(stats) == 1
    total = sum(stats[0].context_distribution.values())
    assert abs(total - 1.0) < 0.001


def test_daily_stats_focus_minutes_within_session_minutes(tl):
    base = 1_705_276_800.0
    # Half deep_focus, half stuck
    for i in range(6):
        ctx = "deep_focus" if i < 3 else "stuck"
        _tick(tl, base + i * 60.0, context=ctx)
    stats = tl.get_daily_stats(since=base - 1, until=base + 400)
    assert len(stats) == 1
    d = stats[0]
    assert d.focus_minutes <= d.total_session_minutes
