"""
User-tunable runtime settings — persisted to data/settings.json.

Import get_settings() anywhere in the engine to read current values.
Import update_settings(patch) to mutate and save.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .config import config

_FILE: Path = config.data_dir / "settings.json"

DEFAULTS: dict[str, Any] = {
    "short_break_seconds": 300,      # 5 min short break
    "long_break_seconds":  1200,     # 20 min long break
    "high_load_threshold": 0.75,     # load >= this → "high"
    "fatigue_threshold":   0.85,     # load >= this → "fatigue / overload"
    "session_gap_minutes": 10,       # idle gap that splits sessions
}

_current: dict[str, Any] = {}


def _load() -> None:
    global _current
    _current = dict(DEFAULTS)
    if _FILE.exists():
        try:
            saved = json.loads(_FILE.read_text())
            for k, v in saved.items():
                if k in DEFAULTS:
                    # coerce to the same type as the default
                    _current[k] = type(DEFAULTS[k])(v)
        except Exception:
            pass  # malformed file — fall back to defaults


def get_settings() -> dict[str, Any]:
    """Return a copy of the current settings dict."""
    if not _current:
        _load()
    return dict(_current)


def update_settings(patch: dict[str, Any]) -> dict[str, Any]:
    """Apply *patch* (unknown keys ignored), persist to disk, return full settings."""
    if not _current:
        _load()
    for k, v in patch.items():
        if k in DEFAULTS:
            _current[k] = type(DEFAULTS[k])(v)
    _FILE.parent.mkdir(parents=True, exist_ok=True)
    _FILE.write_text(json.dumps(_current, indent=2))
    return dict(_current)


# Eagerly load on import
_load()
