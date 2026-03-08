"""
Auth service — password hashing, JWT creation and verification,
and the FastAPI dependency that resolves the current user from a request.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from ..config import config
from ..db.users import UserRecord, UsersDB

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
    except VerifyMismatchError:
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
    except JWTError:
        return None


# ---------------------------------------------------------------------------
# FastAPI dependency — resolves UsersDB from app state
# ---------------------------------------------------------------------------

def _get_users_db(request: Request) -> UsersDB:
    return request.app.state.users_db


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    users_db: UsersDB = Depends(_get_users_db),
) -> UserRecord:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = _decode_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = users_db.get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
