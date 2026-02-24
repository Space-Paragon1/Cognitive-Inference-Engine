"""
Learning Activity Timeline — append-only SQLite store of cognitive events.
Acts as the "git history for your attention".
"""

from __future__ import annotations

import sqlite3
import time
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterator, List, Optional


@dataclass
class TimelineEntry:
    id: Optional[int]
    timestamp: float
    source: str
    event_type: str
    load_score: float
    context: str
    metadata_json: str = "{}"


@dataclass
class SessionSummary:
    """A detected work session (contiguous inference ticks without a long gap)."""
    session_index: int          # 0 = oldest in the queried window
    start_ts: float
    end_ts: float
    duration_minutes: float
    tick_count: int
    avg_load_score: float
    peak_load_score: float
    context_distribution: Dict[str, float]   # context → fraction (sums to 1.0)
    dominant_context: str


@dataclass
class DailyStats:
    """Aggregate statistics for a single calendar day (UTC)."""
    date: str                   # "YYYY-MM-DD"
    tick_count: int
    session_count: int
    avg_load_score: float
    peak_load_score: float
    total_session_minutes: float
    focus_minutes: float        # time in deep_focus context
    context_distribution: Dict[str, float]


class CognitiveTimeline:
    """Thread-safe SQLite-backed timeline store."""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def append(self, entry: TimelineEntry) -> int:
        with self._conn() as conn:
            cur = conn.execute(
                """
                INSERT INTO timeline
                    (timestamp, source, event_type, load_score, context, metadata_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    entry.timestamp,
                    entry.source,
                    entry.event_type,
                    entry.load_score,
                    entry.context,
                    entry.metadata_json,
                ),
            )
            return cur.lastrowid  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Read — raw entries
    # ------------------------------------------------------------------

    def query(
        self,
        since: Optional[float] = None,
        until: Optional[float] = None,
        source: Optional[str] = None,
        limit: int = 500,
    ) -> List[TimelineEntry]:
        clauses = []
        params: list = []

        if since:
            clauses.append("timestamp >= ?")
            params.append(since)
        if until:
            clauses.append("timestamp <= ?")
            params.append(until)
        if source:
            clauses.append("source = ?")
            params.append(source)

        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        params.append(limit)

        with self._conn() as conn:
            rows = conn.execute(
                f"SELECT id, timestamp, source, event_type, load_score, context, metadata_json "
                f"FROM timeline {where} ORDER BY timestamp DESC LIMIT ?",
                params,
            ).fetchall()

        return [TimelineEntry(*row) for row in rows]

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
    ) -> List[SessionSummary]:
        """
        Group inference ticks into work sessions.
        A gap of > gap_minutes between consecutive ticks ends the current session.
        Returns sessions ordered oldest → newest.
        """
        entries = self.query(
            since=since, until=until, source="engine", limit=10_000
        )
        # query() returns newest-first; reverse to chronological
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

        result = []
        for idx, session_ticks in enumerate(raw_sessions):
            result.append(_build_session(idx, session_ticks))
        return result

    def get_daily_stats(
        self,
        since: Optional[float] = None,
        until: Optional[float] = None,
        gap_minutes: float = 10.0,
    ) -> List[DailyStats]:
        """
        Returns one DailyStats record per calendar day (UTC) in the given range.
        """
        if since is None:
            since = time.time() - 7 * 24 * 3600
        if until is None:
            until = time.time()

        entries = self.query(since=since, until=until, source="engine", limit=50_000)
        ticks = [e for e in reversed(entries) if e.event_type == "inference_tick"]
        if not ticks:
            return []

        # Group ticks by UTC date
        by_date: Dict[str, List[TimelineEntry]] = {}
        for t in ticks:
            day = datetime.fromtimestamp(t.timestamp, tz=timezone.utc).strftime("%Y-%m-%d")
            by_date.setdefault(day, []).append(t)

        # Compute sessions per day for session_count + total_session_minutes
        sessions = self.get_sessions(since=since, until=until, gap_minutes=gap_minutes)

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

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS timeline (
                    id            INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp     REAL    NOT NULL,
                    source        TEXT    NOT NULL,
                    event_type    TEXT    NOT NULL,
                    load_score    REAL    NOT NULL DEFAULT 0.0,
                    context       TEXT    NOT NULL DEFAULT 'unknown',
                    metadata_json TEXT    NOT NULL DEFAULT '{}'
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_ts ON timeline(timestamp)")

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()


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
