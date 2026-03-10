"""
/auth — registration, login, and current-user endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..db.users import UsersDB
from .schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut
from .service import create_access_token, get_current_user, hash_password, verify_password
from ..db.users import UserRecord

router = APIRouter(prefix="/auth", tags=["auth"])


def _get_users_db(request: Request) -> UsersDB:
    return request.app.state.users_db


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, users_db: UsersDB = Depends(_get_users_db)):
    """Create a new user account and return an access token."""
    if users_db.get_by_email(body.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists",
        )
    user = users_db.create_user(body.email, hash_password(body.password))
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, users_db: UsersDB = Depends(_get_users_db)):
    """Authenticate and receive a JWT access token."""
    user = users_db.get_by_email(body.email)
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
def me(current_user: UserRecord = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        created_at=current_user.created_at,
    )
