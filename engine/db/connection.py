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
    Column,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    Text,
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
