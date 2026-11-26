"""
Auth service — password hashing, JWT creation and verification, and the
FastAPI dependencies that resolve who is calling.

Two kinds of bearer token are accepted:
  * user JWTs, issued by /auth/login (the dashboard and mobile app)
  * device tokens (``clr_dev_...``), issued by /devices/claim (plugins)

``get_current_user`` accepts user JWTs only. ``get_principal`` accepts either;
it is used on the few endpoints plugins need (telemetry, live state, focus).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from ..config import config
from ..db.devices import DeviceRecord, DevicesDB
from ..db.users import UserRecord, UsersDB
from .tokens import is_device_token

_ALGORITHM = "HS256"
_ph = PasswordHasher()
_bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, plain)
    except (VerifyMismatchError, VerificationError):
        return False


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=config.jwt_expire_days)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, config.jwt_secret, algorithm=_ALGORITHM)


def _decode_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, config.jwt_secret, algorithms=[_ALGORITHM])
        user_id = payload.get("sub")
        return int(user_id) if user_id is not None else None
    except (JWTError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Principal resolution
# ---------------------------------------------------------------------------

@dataclass
class Principal:
    """Who is calling: a user, optionally acting through a paired device."""
    user: UserRecord
    device: Optional[DeviceRecord] = None


def resolve_token(raw: str, users_db: UsersDB, devices_db: DevicesDB) -> Optional[Principal]:
    """Resolve a bearer token (user JWT or device token) to a Principal, or None."""
    if not raw:
        return None
    if is_device_token(raw):
        device = devices_db.get_by_token(raw)
        if device is None:
            return None
        user = users_db.get_by_id(device.user_id)
        if user is None:
            return None
        devices_db.touch(device.id)
        return Principal(user=user, device=device)
    user_id = _decode_token(raw)
    if user_id is None:
        return None
    user = users_db.get_by_id(user_id)
    return Principal(user=user) if user else None


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

def _get_users_db(request: Request) -> UsersDB:
    return request.app.state.users_db


def _get_devices_db(request: Request) -> DevicesDB:
    return request.app.state.devices_db


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_principal(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    users_db: UsersDB = Depends(_get_users_db),
    devices_db: DevicesDB = Depends(_get_devices_db),
) -> Principal:
    """Accept a user JWT or a device token."""
    if credentials is None:
        raise _unauthorized("Not authenticated")
    principal = resolve_token(credentials.credentials, users_db, devices_db)
    if principal is None:
        raise _unauthorized("Invalid, expired or revoked token")
    return principal


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    users_db: UsersDB = Depends(_get_users_db),
) -> UserRecord:
    """Accept a user JWT only (device tokens are limited to plugin endpoints)."""
    if credentials is None:
        raise _unauthorized("Not authenticated")
    if is_device_token(credentials.credentials):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device tokens cannot access this endpoint",
        )
    user_id = _decode_token(credentials.credentials)
    if user_id is None:
        raise _unauthorized("Invalid or expired token")
    user = users_db.get_by_id(user_id)
    if user is None:
        raise _unauthorized("User not found")
    return user
