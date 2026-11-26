"""
Shared FastAPI dependencies: resolve the caller's per-user engine.
"""

from __future__ import annotations

from fastapi import Depends, Request

from ..auth.service import Principal, get_current_user, get_principal
from ..db.users import UserRecord
from ..runtime import EngineRegistry, UserEngine


def get_registry(request: Request) -> EngineRegistry:
    return request.app.state.engines


def user_engine(
    user: UserRecord = Depends(get_current_user),
    registry: EngineRegistry = Depends(get_registry),
) -> UserEngine:
    """Engine for a signed-in user (JWT only)."""
    return registry.get(user.id)


def principal_engine(
    principal: Principal = Depends(get_principal),
    registry: EngineRegistry = Depends(get_registry),
) -> UserEngine:
    """Engine for a user or one of their paired devices."""
    return registry.get(principal.user.id)
