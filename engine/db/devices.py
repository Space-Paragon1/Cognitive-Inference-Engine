"""
Device store — pairing codes and long-lived device tokens for plugins.

Flow:
  1. The signed-in user asks the dashboard for a pairing code (valid 10 min).
  2. They type that code into a plugin (browser extension, VS Code, ...).
  3. The plugin exchanges the code for a device token and keeps it.
  4. The plugin sends ``Authorization: Bearer <device token>`` on every call.

Only SHA-256 hashes of codes and tokens are stored.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import List, Optional, Tuple

from sqlalchemy import and_, select
from sqlalchemy.engine import Engine

from ..auth.tokens import (
    hash_secret,
    new_device_token,
    new_pairing_code,
    normalise_pairing_code,
)
from .connection import device_tokens_table, pairing_codes_table

PAIRING_CODE_TTL_S = 600
# Writing last_seen_at on every telemetry batch would mean a DB write every
# few seconds per device; once a minute is plenty for "last seen 12s ago".
_TOUCH_INTERVAL_S = 60.0

DEVICE_KINDS = {"browser", "ide", "desktop", "lms", "other"}


@dataclass
class DeviceRecord:
    id: int
    user_id: int
    name: str
    kind: str
    created_at: float
    last_seen_at: Optional[float]
    revoked: bool


def _row_to_device(row) -> DeviceRecord:
    return DeviceRecord(
        id=row.id,
        user_id=row.user_id,
        name=row.name,
        kind=row.kind,
        created_at=row.created_at,
        last_seen_at=row.last_seen_at,
        revoked=bool(row.revoked),
    )


class DevicesDB:
    def __init__(self, engine: Engine):
        self._engine = engine
        self._last_touch: dict[int, float] = {}

    # ------------------------------------------------------------------
    # Pairing codes
    # ------------------------------------------------------------------

    def create_pairing_code(
        self, user_id: int, ttl_seconds: int = PAIRING_CODE_TTL_S
    ) -> Tuple[str, float]:
        """Return (display code, expires_at). Older unused codes for the user are dropped."""
        code = new_pairing_code()
        expires_at = time.time() + ttl_seconds
        with self._engine.begin() as conn:
            conn.execute(
                pairing_codes_table.delete().where(pairing_codes_table.c.user_id == user_id)
            )
            conn.execute(
                pairing_codes_table.insert().values(
                    user_id=user_id,
                    code_hash=hash_secret(normalise_pairing_code(code)),
                    expires_at=expires_at,
                    used=False,
                )
            )
        return code, expires_at

    def claim_pairing_code(
        self, code: str, name: str, kind: str
    ) -> Optional[Tuple[DeviceRecord, str]]:
        """
        Exchange a valid pairing code for a new device token.
        Returns (device, raw token) or None if the code is unknown, used or expired.
        """
        code_hash = hash_secret(normalise_pairing_code(code))
        now = time.time()
        raw_token = new_device_token()
        with self._engine.begin() as conn:
            row = conn.execute(
                select(pairing_codes_table).where(pairing_codes_table.c.code_hash == code_hash)
            ).fetchone()
            if row is None or row.used or now > row.expires_at:
                return None
            # Mark used in the same transaction so a code can only be claimed once.
            updated = conn.execute(
                pairing_codes_table.update()
                .where(
                    and_(
                        pairing_codes_table.c.id == row.id,
                        pairing_codes_table.c.used == False,  # noqa: E712
                    )
                )
                .values(used=True)
            )
            if updated.rowcount != 1:
                return None
            result = conn.execute(
                device_tokens_table.insert().values(
                    user_id=row.user_id,
                    name=name[:128],
                    kind=kind if kind in DEVICE_KINDS else "other",
                    token_hash=hash_secret(raw_token),
                    created_at=now,
                    last_seen_at=now,
                    revoked=False,
                )
            )
            device_id = result.inserted_primary_key[0]
        device = self.get(device_id)
        assert device is not None
        return device, raw_token

    # ------------------------------------------------------------------
    # Device tokens
    # ------------------------------------------------------------------

    def get(self, device_id: int) -> Optional[DeviceRecord]:
        with self._engine.connect() as conn:
            row = conn.execute(
                select(device_tokens_table).where(device_tokens_table.c.id == device_id)
            ).fetchone()
        return _row_to_device(row) if row else None

    def get_by_token(self, raw_token: str) -> Optional[DeviceRecord]:
        """Return the device for an active (non-revoked) token, else None."""
        with self._engine.connect() as conn:
            row = conn.execute(
                select(device_tokens_table).where(
                    device_tokens_table.c.token_hash == hash_secret(raw_token)
                )
            ).fetchone()
        if row is None or row.revoked:
            return None
        return _row_to_device(row)

    def touch(self, device_id: int) -> None:
        """Record that the device was just seen (rate-limited to one write a minute)."""
        now = time.time()
        if now - self._last_touch.get(device_id, 0.0) < _TOUCH_INTERVAL_S:
            return
        self._last_touch[device_id] = now
        with self._engine.begin() as conn:
            conn.execute(
                device_tokens_table.update()
                .where(device_tokens_table.c.id == device_id)
                .values(last_seen_at=now)
            )

    def list_for_user(self, user_id: int) -> List[DeviceRecord]:
        with self._engine.connect() as conn:
            rows = conn.execute(
                select(device_tokens_table)
                .where(
                    and_(
                        device_tokens_table.c.user_id == user_id,
                        device_tokens_table.c.revoked == False,  # noqa: E712
                    )
                )
                .order_by(device_tokens_table.c.created_at.desc())
            ).fetchall()
        return [_row_to_device(r) for r in rows]

    def revoke(self, user_id: int, device_id: int) -> bool:
        with self._engine.begin() as conn:
            result = conn.execute(
                device_tokens_table.update()
                .where(
                    and_(
                        device_tokens_table.c.id == device_id,
                        device_tokens_table.c.user_id == user_id,
                        device_tokens_table.c.revoked == False,  # noqa: E712
                    )
                )
                .values(revoked=True)
            )
        self._last_touch.pop(device_id, None)
        return result.rowcount == 1
