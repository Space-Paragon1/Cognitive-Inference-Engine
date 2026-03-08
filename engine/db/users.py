"""
Users table — SQLite-backed store for registered accounts.
Lives in the same timeline.db so no second database file is needed.
"""

from __future__ import annotations

import sqlite3
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Optional


@dataclass
class UserRecord:
    id: int
    email: str
    hashed_password: str
    created_at: float


class UsersDB:
    """Thread-safe SQLite store for user accounts."""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def create_user(self, email: str, hashed_password: str) -> UserRecord:
        now = time.time()
        with self._conn() as conn:
            cur = conn.execute(
                "INSERT INTO users (email, hashed_password, created_at) VALUES (?, ?, ?)",
                (email.lower().strip(), hashed_password, now),
            )
            return UserRecord(
                id=cur.lastrowid,  # type: ignore[arg-type]
                email=email.lower().strip(),
                hashed_password=hashed_password,
                created_at=now,
            )

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def get_by_email(self, email: str) -> Optional[UserRecord]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT id, email, hashed_password, created_at FROM users WHERE email = ?",
                (email.lower().strip(),),
            ).fetchone()
        return UserRecord(*row) if row else None

    def get_by_id(self, user_id: int) -> Optional[UserRecord]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT id, email, hashed_password, created_at FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
        return UserRecord(*row) if row else None

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    email           TEXT    NOT NULL UNIQUE,
                    hashed_password TEXT    NOT NULL,
                    created_at      REAL    NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()
