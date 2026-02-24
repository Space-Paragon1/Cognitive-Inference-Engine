"""
/timeline — query the cognitive activity timeline and analytics.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request

from ...api.schemas import DailyStatsOut, SessionSummaryOut, TimelineEntryOut
from ...settings import get_settings

router = APIRouter(prefix="/timeline", tags=["timeline"])


def _get_timeline(request: Request):
    return request.app.state.timeline


@router.get("", response_model=List[TimelineEntryOut])
def query_timeline(
    since: Optional[float] = Query(default=None, description="Unix timestamp lower bound"),
    until: Optional[float] = Query(default=None, description="Unix timestamp upper bound"),
    source: Optional[str] = Query(
        default=None, description="Filter by source (browser|ide|desktop|engine|lms)"
    ),
    limit: int = Query(default=200, le=1000),
    timeline=Depends(_get_timeline),
):
    entries = timeline.query(since=since, until=until, source=source, limit=limit)
    return [
        TimelineEntryOut(
            id=e.id,
            timestamp=e.timestamp,
            source=e.source,
            event_type=e.event_type,
            load_score=e.load_score,
            context=e.context,
            metadata_json=e.metadata_json,
        )
        for e in entries
    ]


@router.get("/load-history")
def load_history(
    window_s: int = Query(default=300, description="Rolling window in seconds"),
    timeline=Depends(_get_timeline),
):
    scores = timeline.recent_load_scores(window_s=window_s)
    return {"scores": scores, "window_seconds": window_s, "count": len(scores)}


@router.get("/sessions", response_model=List[SessionSummaryOut])
def get_sessions(
    since: Optional[float] = Query(default=None, description="Unix timestamp lower bound"),
    until: Optional[float] = Query(default=None, description="Unix timestamp upper bound"),
    gap_minutes: Optional[float] = Query(
        default=None,
        description="Inactivity gap that ends a session (minutes); defaults to user setting",
    ),
    timeline=Depends(_get_timeline),
):
    """
    Detect and return work sessions within the given time range.
    A session ends when there is a gap of > gap_minutes between inference ticks.
    """
    effective_gap = (
        gap_minutes if gap_minutes is not None else get_settings()["session_gap_minutes"]
    )
    sessions = timeline.get_sessions(since=since, until=until, gap_minutes=effective_gap)
    return [
        SessionSummaryOut(
            session_index=s.session_index,
            start_ts=s.start_ts,
            end_ts=s.end_ts,
            duration_minutes=s.duration_minutes,
            tick_count=s.tick_count,
            avg_load_score=s.avg_load_score,
            peak_load_score=s.peak_load_score,
            context_distribution=s.context_distribution,
            dominant_context=s.dominant_context,
        )
        for s in sessions
    ]


@router.get("/stats/daily", response_model=List[DailyStatsOut])
def get_daily_stats(
    since: Optional[float] = Query(
        default=None, description="Unix timestamp lower bound (default: 7 days ago)"
    ),
    until: Optional[float] = Query(
        default=None, description="Unix timestamp upper bound (default: now)"
    ),
    gap_minutes: Optional[float] = Query(
        default=None,
        description="Session gap threshold (minutes); defaults to user setting",
    ),
    timeline=Depends(_get_timeline),
):
    """
    Return per-day productivity statistics: session count, avg/peak load,
    focus minutes, and context distribution. Defaults to the last 7 days.
    """
    effective_gap = (
        gap_minutes if gap_minutes is not None else get_settings()["session_gap_minutes"]
    )
    stats = timeline.get_daily_stats(since=since, until=until, gap_minutes=effective_gap)
    return [
        DailyStatsOut(
            date=d.date,
            tick_count=d.tick_count,
            session_count=d.session_count,
            avg_load_score=d.avg_load_score,
            peak_load_score=d.peak_load_score,
            total_session_minutes=d.total_session_minutes,
            focus_minutes=d.focus_minutes,
            context_distribution=d.context_distribution,
        )
        for d in stats
    ]
