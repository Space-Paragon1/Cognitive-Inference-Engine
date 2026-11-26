"""
Database engine factory.

Reads DATABASE_URL (via config) to decide which backend to use:
  - Empty / unset  →  SQLite at data/timeline.db  (local desktop default)
  - postgresql://… →  PostgreSQL                  (hosted / production)

All other modules import `get_engine()` or use the `metadata` / table
objects defined here.  Raw SQL is avoided in favour of SQLAlchemy Core so
the same queries run on both backends without changes.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    Float,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.engine import Engine

from ..config import config

# ---------------------------------------------------------------------------
# Shared metadata — single source of truth for the schema
# ---------------------------------------------------------------------------

metadata = MetaData()

users_table = Table(
    "users",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("email", String(255), nullable=False, unique=True),
    Column("hashed_password", Text, nullable=False),
    Column("created_at", Float, nullable=False),
)

password_reset_table = Table(
    "password_reset_tokens",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("token", String(64), nullable=False, unique=True),
    Column("expires_at", Float, nullable=False),
    Column("used", Boolean, nullable=False, default=False),
)

timeline_table = Table(
    "timeline",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("timestamp", Float, nullable=False, index=True),
    Column("source", String(64), nullable=False),
    Column("event_type", String(64), nullable=False),
    Column("load_score", Float, nullable=False, default=0.0),
    Column("context", String(64), nullable=False, default="unknown"),
    Column("metadata_json", Text, nullable=False, default="{}"),
    Column("user_id", Integer, nullable=True),
    Index("idx_timeline_user_ts", "user_id", "timestamp"),
)

# Long-lived tokens that plugins (browser extension, VS Code, desktop agent,
# LMS connector) use instead of a user's JWT. Only the SHA-256 hash is stored.
device_tokens_table = Table(
    "device_tokens",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("name", String(128), nullable=False),
    Column("kind", String(32), nullable=False),
    Column("token_hash", String(64), nullable=False, unique=True),
    Column("created_at", Float, nullable=False),
    Column("last_seen_at", Float, nullable=True),
    Column("revoked", Boolean, nullable=False, default=False),
)

# Short-lived, single-use codes shown in the dashboard and typed into a plugin
# to exchange for a device token. Only the SHA-256 hash is stored.
pairing_codes_table = Table(
    "pairing_codes",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("code_hash", String(64), nullable=False, unique=True),
    Column("expires_at", Float, nullable=False),
    Column("used", Boolean, nullable=False, default=False),
)

user_settings_table = Table(
    "user_settings",
    metadata,
    Column("user_id", Integer, primary_key=True, autoincrement=False),
    Column("settings_json", Text, nullable=False, default="{}"),
    Column("updated_at", Float, nullable=False),
)

tasks_table = Table(
    "tasks",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("task_id", String(128), nullable=False),
    Column("title", Text, nullable=False),
    Column("difficulty", String(16), nullable=False),
    Column("estimated_minutes", Integer, nullable=False, default=25),
    Column("tags_json", Text, nullable=False, default="[]"),
    Column("created_at", Float, nullable=False),
    UniqueConstraint("user_id", "task_id", name="uq_tasks_user_task"),
)

# ---------------------------------------------------------------------------
# Engine factory
# ---------------------------------------------------------------------------

_engine: Optional[Engine] = None


def get_engine(db_path: Optional[Path] = None) -> Engine:
    """
    Return (and cache) the SQLAlchemy engine.

    Priority:
      1. config.database_url  (set via CLR_DATABASE_URL env var or config.json)
      2. db_path argument     (SQLite file path, used by tests and lifespan)
      3. default SQLite       (data/timeline.db)
    """
    global _engine
    if _engine is not None:
        return _engine

    if config.database_url:
        url = config.database_url
    else:
        path = db_path or (config.data_dir / config.timeline_db)
        url = f"sqlite:///{path}"

    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    _engine = create_engine(url, connect_args=connect_args, pool_pre_ping=True)
    return _engine


def reset_engine() -> None:
    """Dispose and clear the cached engine. Used in tests to get a fresh instance."""
    global _engine
    if _engine is not None:
        _engine.dispose()
        _engine = None


def init_db(engine: Engine) -> None:
    """Create all tables if they don't exist. Skips existing tables safely."""
    metadata.create_all(engine)
