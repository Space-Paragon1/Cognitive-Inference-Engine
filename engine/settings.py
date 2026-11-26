"""
Per-user tunable settings, stored in the ``user_settings`` table.

    store = SettingsStore(engine)
    store.get(user_id)                       # full dict, defaults filled in
    store.update(user_id, {"session_gap_minutes": 15})

Reads are cached in memory (settings are read on every inference tick); the
cache is updated on write, so a single engine process always sees fresh values.
"""

from __future__ import annotations

import json
import threading
import time
from typing import Any, Callable, Dict

from sqlalchemy import select
from sqlalchemy.engine import Engine

from .db.connection import user_settings_table

DEFAULTS: Dict[str, Any] = {
    "short_break_seconds": 300,      # 5 min short break
    "long_break_seconds":  1200,     # 20 min long break
    "high_load_threshold": 0.75,     # load >= this → "high"
    "fatigue_threshold":   0.85,     # load >= this → "fatigue / overload"
    "session_gap_minutes": 10,       # idle gap that splits sessions
}

SettingsProvider = Callable[[], Dict[str, Any]]


def defaults_provider() -> Dict[str, Any]:
    """Provider for code paths with no user (unit tests, scripts)."""
    return dict(DEFAULTS)


def coerce(values: Dict[str, Any]) -> Dict[str, Any]:
    """Keep known keys only and coerce each to its default's type."""
    out: Dict[str, Any] = {}
    for k, v in values.items():
        if k in DEFAULTS:
            try:
                out[k] = type(DEFAULTS[k])(v)
            except (TypeError, ValueError):
                continue
    return out


class SettingsStore:
    def __init__(self, engine: Engine):
        self._engine = engine
        self._cache: Dict[int, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def get(self, user_id: int) -> Dict[str, Any]:
        """Return a copy of the user's settings with defaults filled in."""
        with self._lock:
            cached = self._cache.get(user_id)
        if cached is not None:
            return dict(cached)

        with self._engine.connect() as conn:
            row = conn.execute(
                select(user_settings_table.c.settings_json).where(
                    user_settings_table.c.user_id == user_id
                )
            ).fetchone()
        merged = dict(DEFAULTS)
        if row is not None:
            try:
                merged.update(coerce(json.loads(row.settings_json)))
            except (ValueError, TypeError):
                pass  # malformed row → defaults
        with self._lock:
            self._cache[user_id] = merged
        return dict(merged)

    def update(self, user_id: int, patch: Dict[str, Any]) -> Dict[str, Any]:
        """Apply a partial update (unknown keys ignored) and return full settings."""
        merged = self.get(user_id)
        merged.update(coerce(patch))
        payload = json.dumps(merged)
        now = time.time()
        with self._engine.begin() as conn:
            updated = conn.execute(
                user_settings_table.update()
                .where(user_settings_table.c.user_id == user_id)
                .values(settings_json=payload, updated_at=now)
            )
            if updated.rowcount == 0:
                conn.execute(
                    user_settings_table.insert().values(
                        user_id=user_id, settings_json=payload, updated_at=now
                    )
                )
        with self._lock:
            self._cache[user_id] = merged
        return dict(merged)

    def provider_for(self, user_id: int) -> SettingsProvider:
        return lambda: self.get(user_id)
