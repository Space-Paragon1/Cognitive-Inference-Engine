"""
Helpers for opaque secrets (reset tokens, device tokens, pairing codes).

Only SHA-256 hashes ever touch the database, so a leaked database dump does
not hand out working credentials. SHA-256 (rather than argon2) is fine here
because these secrets are long and random, not user-chosen passwords.
"""

from __future__ import annotations

import hashlib
import secrets

DEVICE_TOKEN_PREFIX = "clr_dev_"

# Pairing codes are typed by hand, so leave out characters that are easy to
# confuse (0/O, 1/I/L).
_PAIRING_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
PAIRING_CODE_LENGTH = 8


def hash_secret(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def new_reset_token() -> str:
    return secrets.token_hex(32)


def new_device_token() -> str:
    return DEVICE_TOKEN_PREFIX + secrets.token_urlsafe(32)


def is_device_token(raw: str) -> bool:
    return raw.startswith(DEVICE_TOKEN_PREFIX)


def new_pairing_code() -> str:
    """Return a code like ``K7QM-9TXR`` (hyphen is cosmetic)."""
    chars = "".join(secrets.choice(_PAIRING_ALPHABET) for _ in range(PAIRING_CODE_LENGTH))
    return f"{chars[:4]}-{chars[4:]}"


def normalise_pairing_code(code: str) -> str:
    return "".join(c for c in code.upper() if c.isalnum())
