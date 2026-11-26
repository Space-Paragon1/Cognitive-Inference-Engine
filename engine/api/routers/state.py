"""
/state — current cognitive state endpoint + WebSocket stream.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from ...api.schemas import CognitiveStateOut
from ...auth.service import resolve_token
from ...runtime import UserEngine
from ..deps import principal_engine

router = APIRouter(prefix="/state", tags=["state"])

# How long a new WebSocket has to send its auth message.
_WS_AUTH_TIMEOUT_S = 5.0
_WS_PUSH_INTERVAL_S = 2.0


@router.get("", response_model=CognitiveStateOut)
def get_state(engine: UserEngine = Depends(principal_engine)):
    """Return the caller's current cognitive load snapshot (user JWT or device token)."""
    return CognitiveStateOut(**engine.aggregator.current_state())


@router.websocket("/ws")
async def state_websocket(websocket: WebSocket):
    """
    WebSocket stream — pushes the caller's cognitive state every 2 seconds.

    Auth: the first message must be ``{"type": "auth", "token": "<jwt or device token>"}``,
    sent within 5 seconds of connecting. (Tokens are not accepted in the URL,
    where they would end up in proxy and server logs.) Close codes:
    4001 = missing/invalid token.
    """
    await websocket.accept()
    app = websocket.app
    try:
        msg = await asyncio.wait_for(websocket.receive_json(), timeout=_WS_AUTH_TIMEOUT_S)
    except (asyncio.TimeoutError, ValueError, WebSocketDisconnect):
        await _close(websocket, 4001)
        return

    token = msg.get("token") if isinstance(msg, dict) and msg.get("type") == "auth" else None
    loop = asyncio.get_running_loop()
    principal = await loop.run_in_executor(
        None, resolve_token, token or "", app.state.users_db, app.state.devices_db
    )
    if principal is None:
        await _close(websocket, 4001)
        return

    user_id = principal.user.id
    try:
        while True:
            engine = app.state.engines.get(user_id)   # also keeps the engine alive
            payload = CognitiveStateOut(**engine.aggregator.current_state())
            await websocket.send_json(payload.model_dump())
            await asyncio.sleep(_WS_PUSH_INTERVAL_S)
    except (WebSocketDisconnect, RuntimeError):
        pass


async def _close(websocket: WebSocket, code: int) -> None:
    try:
        await websocket.close(code=code)
    except RuntimeError:
        pass
