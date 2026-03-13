"""
Users store — SQLAlchemy Core backed store for registered accounts.
Works with both SQLite (local) and PostgreSQL (hosted).
"""

from __future__ import annotations

import secrets
import time
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.engine import Engine

from .connection import password_reset_table, users_table


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

    def update_password(self, user_id: int, hashed_password: str) -> None:
        with self._engine.begin() as conn:
            conn.execute(
                users_table.update()
                .where(users_table.c.id == user_id)
                .values(hashed_password=hashed_password)
            )

    # ------------------------------------------------------------------
    # Password reset tokens
    # ------------------------------------------------------------------

    def create_reset_token(self, user_id: int, ttl_seconds: int = 3600) -> str:
        """Create a single-use reset token valid for ttl_seconds. Returns the raw token."""
        token = secrets.token_hex(32)
        expires_at = time.time() + ttl_seconds
        # Delete any existing tokens for this user first
        with self._engine.begin() as conn:
            conn.execute(
                password_reset_table.delete().where(
                    password_reset_table.c.user_id == user_id
                )
            )
            conn.execute(
                password_reset_table.insert().values(
                    user_id=user_id,
                    token=token,
                    expires_at=expires_at,
                    used=False,
                )
            )
        return token

    def get_valid_reset_token(self, token: str) -> Optional[int]:
        """Return user_id if the token is valid and unused, else None."""
        with self._engine.connect() as conn:
            row = conn.execute(
                password_reset_table.select().where(
                    password_reset_table.c.token == token
                )
            ).fetchone()
        if row is None:
            return None
        _id, user_id, _token, expires_at, used = row
        if used or time.time() > expires_at:
            return None
        return user_id

    def consume_reset_token(self, token: str) -> None:
        """Mark the token as used."""
        with self._engine.begin() as conn:
            conn.execute(
                password_reset_table.update()
                .where(password_reset_table.c.token == token)
                .values(used=True)
            )
