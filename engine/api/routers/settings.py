"""
/settings — read and update user-tunable runtime settings.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ...settings import DEFAULTS, get_settings, update_settings

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsPatch(BaseModel):
    short_break_seconds: Optional[int]   = Field(None, ge=60,   le=900)
    long_break_seconds:  Optional[int]   = Field(None, ge=300,  le=3600)
    high_load_threshold: Optional[float] = Field(None, ge=0.4,  le=0.95)
    fatigue_threshold:   Optional[float] = Field(None, ge=0.5,  le=0.99)
    session_gap_minutes: Optional[int]   = Field(None, ge=2,    le=60)


@router.get("")
def read_settings():
    """Return current settings with their defaults for reference."""
    current = get_settings()
    return {"settings": current, "defaults": DEFAULTS}


@router.put("")
def write_settings(patch: SettingsPatch):
    """Apply a partial update; unknown keys are ignored. Persists to data/settings.json."""
    data = {k: v for k, v in patch.model_dump().items() if v is not None}
    return {"settings": update_settings(data)}
