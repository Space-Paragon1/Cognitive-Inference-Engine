"""
Users store — SQLAlchemy Core backed store for registered accounts.
Works with both SQLite (local) and PostgreSQL (hosted).
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.engine import Engine

from .connection import users_table


@dataclass
class UserRecord:
    id: int
    email: str
    hashed_password: str
    created_at: float


class UsersDB:
    """Thread-safe user account store backed by SQLAlchemy Core."""

    def __init__(self, engine: Engine):
        self._engine = engine

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def create_user(self, email: str, hashed_password: str) -> UserRecord:
        now = time.time()
        normalized = email.lower().strip()
        with self._engine.begin() as conn:
            result = conn.execute(
                users_table.insert().values(
                    email=normalized,
                    hashed_password=hashed_password,
                    created_at=now,
                )
            )
            return UserRecord(
                id=result.inserted_primary_key[0],
                email=normalized,
                hashed_password=hashed_password,
                created_at=now,
            )

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def get_by_email(self, email: str) -> Optional[UserRecord]:
        normalized = email.lower().strip()
        with self._engine.connect() as conn:
            row = conn.execute(
                users_table.select().where(users_table.c.email == normalized)
            ).fetchone()
        return UserRecord(*row) if row else None

    def get_by_id(self, user_id: int) -> Optional[UserRecord]:
        with self._engine.connect() as conn:
            row = conn.execute(
                users_table.select().where(users_table.c.id == user_id)
            ).fetchone()
        return UserRecord(*row) if row else None
