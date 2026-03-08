"""
Learning Activity Timeline — append-only store of cognitive events.
Acts as the "git history for your attention".

Backed by SQLAlchemy Core so it works with both SQLite (local desktop)
and PostgreSQL (hosted/production) without any query changes.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import and_, select
from sqlalchemy.engine import Engine

from ..db.connection import timeline_table


@dataclass
class TimelineEntry:
    id: Optional[int]
    timestamp: float
    source: str
    event_type: str
    load_score: float
    context: str
    metadata_json: str = "{}"
    user_id: Optional[int] = None


@dataclass
class SessionSummary:
    """A detected work session (contiguous inference ticks without a long gap)."""
    session_index: int
    start_ts: float
    end_ts: float
    duration_minutes: float
    tick_count: int
    avg_load_score: float
    peak_load_score: float
    context_distribution: Dict[str, float]
    dominant_context: str


@dataclass
class DailyStats:
    """Aggregate statistics for a single calendar day (UTC)."""
    date: str
    tick_count: int
    session_count: int
    avg_load_score: float
    peak_load_score: float
    total_session_minutes: float
    focus_minutes: float
    context_distribution: Dict[str, float]


class CognitiveTimeline:
    """Thread-safe SQLAlchemy-backed timeline store."""

    def __init__(self, engine: Engine):
        self._engine = engine

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def append(self, entry: TimelineEntry) -> int:
        with self._engine.begin() as conn:
            result = conn.execute(
                timeline_table.insert().values(
                    timestamp=entry.timestamp,
                    source=entry.source,
                    event_type=entry.event_type,
                    load_score=entry.load_score,
                    context=entry.context,
                    metadata_json=entry.metadata_json,
                    user_id=entry.user_id,
                )
            )
            return result.inserted_primary_key[0]

    # ------------------------------------------------------------------
    # Read — raw entries
    # ------------------------------------------------------------------

    def query(
        self,
        since: Optional[float] = None,
        until: Optional[float] = None,
        source: Optional[str] = None,
        limit: int = 500,
        user_id: Optional[int] = None,
    ) -> List[TimelineEntry]:
        stmt = select(timeline_table).order_by(timeline_table.c.timestamp.desc()).limit(limit)

        filters = []
        if since is not None:
            filters.append(timeline_table.c.timestamp >= since)
        if until is not None:
            filters.append(timeline_table.c.timestamp <= until)
        if source is not None:
            filters.append(timeline_table.c.source == source)
        if user_id is not None:
            filters.append(timeline_table.c.user_id == user_id)
        if filters:
            stmt = stmt.where(and_(*filters))

        with self._engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()

        return [
            TimelineEntry(
                id=row.id,
                timestamp=row.timestamp,
                source=row.source,
                event_type=row.event_type,
                load_score=row.load_score,
                context=row.context,
                metadata_json=row.metadata_json,
                user_id=row.user_id,
            )
            for row in rows
        ]

    def recent_load_scores(self, window_s: int = 300) -> List[float]:
        since = time.time() - window_s
        entries = self.query(since=since, limit=1000)
        return [e.load_score for e in reversed(entries)]

    # ------------------------------------------------------------------
    # Read — session analytics
    # ------------------------------------------------------------------

    def get_sessions(
        self,
        since: Optional[float] = None,
        until: Optional[float] = None,
        gap_minutes: float = 10.0,
        user_id: Optional[int] = None,
    ) -> List[SessionSummary]:
        entries = self.query(
            since=since, until=until, source="engine", limit=10_000, user_id=user_id
        )
        ticks = [e for e in reversed(entries) if e.event_type == "inference_tick"]
        if not ticks:
            return []

        gap_s = gap_minutes * 60.0
        raw_sessions: list[list[TimelineEntry]] = []
        current: list[TimelineEntry] = [ticks[0]]

        for tick in ticks[1:]:
            if tick.timestamp - current[-1].timestamp > gap_s:
                raw_sessions.append(current)
                current = [tick]
            else:
                current.append(tick)
        raw_sessions.append(current)

        return [_build_session(idx, s) for idx, s in enumerate(raw_sessions)]

    def get_daily_stats(
        self,
        since: Optional[float] = None,
        until: Optional[float] = None,
        gap_minutes: float = 10.0,
        user_id: Optional[int] = None,
    ) -> List[DailyStats]:
        if since is None:
            since = time.time() - 7 * 24 * 3600
        if until is None:
            until = time.time()

        entries = self.query(
            since=since, until=until, source="engine", limit=50_000, user_id=user_id
        )
        ticks = [e for e in reversed(entries) if e.event_type == "inference_tick"]
        if not ticks:
            return []

        by_date: Dict[str, List[TimelineEntry]] = {}
        for t in ticks:
            day = datetime.fromtimestamp(t.timestamp, tz=timezone.utc).strftime("%Y-%m-%d")
            by_date.setdefault(day, []).append(t)

        sessions = self.get_sessions(
            since=since, until=until, gap_minutes=gap_minutes, user_id=user_id
        )
        session_by_date: Dict[str, List[SessionSummary]] = {}
        for s in sessions:
            day = datetime.fromtimestamp(s.start_ts, tz=timezone.utc).strftime("%Y-%m-%d")
            session_by_date.setdefault(day, []).append(s)

        result = []
        for day in sorted(by_date.keys()):
            day_ticks = by_date[day]
            scores = [t.load_score for t in day_ticks]
            ctx_counts: Dict[str, int] = {}
            for t in day_ticks:
                ctx_counts[t.context] = ctx_counts.get(t.context, 0) + 1
            total = len(day_ticks)
            ctx_dist = {k: v / total for k, v in ctx_counts.items()}

            day_sessions = session_by_date.get(day, [])
            total_session_min = sum(s.duration_minutes for s in day_sessions)
            focus_fraction = ctx_dist.get("deep_focus", 0.0)

            result.append(DailyStats(
                date=day,
                tick_count=total,
                session_count=len(day_sessions),
                avg_load_score=sum(scores) / len(scores),
                peak_load_score=max(scores),
                total_session_minutes=round(total_session_min, 1),
                focus_minutes=round(total_session_min * focus_fraction, 1),
                context_distribution=ctx_dist,
            ))
        return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_session(idx: int, ticks: List[TimelineEntry]) -> SessionSummary:
    scores = [t.load_score for t in ticks]
    ctx_counts: Dict[str, int] = {}
    for t in ticks:
        ctx_counts[t.context] = ctx_counts.get(t.context, 0) + 1
    total = len(ticks)
    ctx_dist = {k: round(v / total, 4) for k, v in ctx_counts.items()}
    dominant = max(ctx_counts, key=lambda k: ctx_counts[k])
    duration_min = (ticks[-1].timestamp - ticks[0].timestamp) / 60.0
    return SessionSummary(
        session_index=idx,
        start_ts=ticks[0].timestamp,
        end_ts=ticks[-1].timestamp,
        duration_minutes=round(duration_min, 2),
        tick_count=total,
        avg_load_score=round(sum(scores) / len(scores), 4),
        peak_load_score=round(max(scores), 4),
        context_distribution=ctx_dist,
        dominant_context=dominant,
    )
