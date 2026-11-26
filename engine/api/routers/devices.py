"""
/devices — pair plugins with an account and manage paired devices.

  POST   /devices/pairing-code   (user)    → short code, valid 10 minutes
  POST   /devices/claim          (public)  → exchange code for a device token
  GET    /devices                (user)    → list paired devices
  DELETE /devices/{id}           (user)    → revoke a device
  GET    /devices/whoami         (either)  → check which account a token belongs to
  DELETE /devices/self           (device)  → a plugin un-pairs itself
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ...auth.ratelimit import client_ip, enforce
from ...auth.service import Principal, get_current_user, get_principal
from ...db.devices import DeviceRecord, DevicesDB
from ...db.users import UserRecord
from ..schemas import DeviceClaimIn, DeviceClaimOut, DeviceOut, PairingCodeOut, WhoAmIOut

router = APIRouter(prefix="/devices", tags=["devices"])


def _devices(request: Request) -> DevicesDB:
    return request.app.state.devices_db


def _out(d: DeviceRecord) -> DeviceOut:
    return DeviceOut(
        id=d.id, name=d.name, kind=d.kind, created_at=d.created_at, last_seen_at=d.last_seen_at
    )


@router.post("/pairing-code", response_model=PairingCodeOut, status_code=201)
def create_pairing_code(
    user: UserRecord = Depends(get_current_user),
    devices: DevicesDB = Depends(_devices),
):
    """Create a single-use code the user types into a plugin. Replaces any older code."""
    code, expires_at = devices.create_pairing_code(user.id)
    return PairingCodeOut(code=code, expires_at=expires_at)


@router.post("/claim", response_model=DeviceClaimOut, status_code=201)
def claim_device(
    body: DeviceClaimIn,
    request: Request,
    devices: DevicesDB = Depends(_devices),
):
    """Exchange a pairing code for a long-lived device token."""
    enforce(request, "claim_ip", client_ip(request))
    claimed = devices.claim_pairing_code(body.code, body.name, body.kind)
    if claimed is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That pairing code is invalid or has expired. Generate a new one.",
        )
    device, token = claimed
    user = request.app.state.users_db.get_by_id(device.user_id)
    return DeviceClaimOut(device_token=token, device=_out(device), user_email=user.email)


@router.get("", response_model=List[DeviceOut])
def list_devices(
    user: UserRecord = Depends(get_current_user),
    devices: DevicesDB = Depends(_devices),
):
    return [_out(d) for d in devices.list_for_user(user.id)]


@router.get("/whoami", response_model=WhoAmIOut)
def whoami(principal: Principal = Depends(get_principal)):
    return WhoAmIOut(
        user_email=principal.user.email,
        device=_out(principal.device) if principal.device else None,
    )


@router.delete("/self")
def unpair_self(
    principal: Principal = Depends(get_principal),
    devices: DevicesDB = Depends(_devices),
):
    if principal.device is None:
        raise HTTPException(status_code=400, detail="Not a device token")
    devices.revoke(principal.user.id, principal.device.id)
    return {"status": "revoked"}


@router.delete("/{device_id}")
def revoke_device(
    device_id: int,
    user: UserRecord = Depends(get_current_user),
    devices: DevicesDB = Depends(_devices),
):
    if not devices.revoke(user.id, device_id):
        raise HTTPException(status_code=404, detail="Device not found")
    return {"status": "revoked"}
