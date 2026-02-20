"""
Learning Activity Timeline — append-only SQLite store of cognitive events.
Acts as the "git history for your attention".
"""

from __future__ import annotations

import sqlite3
import time
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterator, List, Optional


@dataclass
class TimelineEntry:
    id: Optional[int]
    timestamp: float
    source: str
    event_type: str
    load_score: float
    context: str
    metadata_json: str = "{}"


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
                INSERT INTO timeline (timestamp, source, event_type, load_score, context, metadata_json)
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
    # Read
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
