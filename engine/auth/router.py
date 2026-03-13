"""
/auth — registration, login, and current-user endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..db.users import UserRecord, UsersDB
from .email import send_password_reset
from .schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserOut,
)
from .service import create_access_token, get_current_user, hash_password, verify_password

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


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(body: ForgotPasswordRequest, users_db: UsersDB = Depends(_get_users_db)):
    """
    Send a password-reset email if the account exists.
    Always returns 200 to avoid user-enumeration.
    """
    user = users_db.get_by_email(body.email)
    if user:
        token = users_db.create_reset_token(user.id)
        try:
            send_password_reset(user.email, token)
        except Exception:
            # Don't leak SMTP errors to the client
            pass
    return {"detail": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password", response_model=TokenResponse)
def reset_password(body: ResetPasswordRequest, users_db: UsersDB = Depends(_get_users_db)):
    """Verify the reset token and set a new password. Returns a fresh JWT."""
    user_id = users_db.get_valid_reset_token(body.token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset link is invalid or has expired.",
        )
    users_db.update_password(user_id, hash_password(body.new_password))
    users_db.consume_reset_token(body.token)
    return TokenResponse(access_token=create_access_token(user_id))
