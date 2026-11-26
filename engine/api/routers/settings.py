"""
/settings — read and update the signed-in user's tunable settings.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ...auth.service import get_current_user
from ...db.users import UserRecord
from ...settings import DEFAULTS, SettingsStore

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsPatch(BaseModel):
    short_break_seconds: Optional[int]   = Field(None, ge=60,   le=900)
    long_break_seconds:  Optional[int]   = Field(None, ge=300,  le=3600)
    high_load_threshold: Optional[float] = Field(None, ge=0.4,  le=0.95)
    fatigue_threshold:   Optional[float] = Field(None, ge=0.5,  le=0.99)
    session_gap_minutes: Optional[int]   = Field(None, ge=2,    le=60)


def _store(request: Request) -> SettingsStore:
    return request.app.state.settings_store


@router.get("")
def read_settings(
    user: UserRecord = Depends(get_current_user),
    store: SettingsStore = Depends(_store),
):
    """Return the user's settings with the defaults for reference."""
    return {"settings": store.get(user.id), "defaults": DEFAULTS}


@router.put("")
def write_settings(
    patch: SettingsPatch,
    user: UserRecord = Depends(get_current_user),
    store: SettingsStore = Depends(_store),
):
    """Apply a partial update. The fatigue threshold must stay above the high-load one."""
    data = {k: v for k, v in patch.model_dump().items() if v is not None}
    merged = {**store.get(user.id), **data}
    if merged["fatigue_threshold"] <= merged["high_load_threshold"]:
        raise HTTPException(
            status_code=422,
            detail="fatigue_threshold must be greater than high_load_threshold",
        )
    return {"settings": store.update(user.id, data)}
