"""
/state — current cognitive state endpoint + WebSocket stream.
"""

from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, WebSocket, WebSocketDisconnect

from ...api.schemas import CognitiveStateOut, LoadBreakdown
from ...auth.service import _decode_token, _get_users_db, get_current_user

router = APIRouter(prefix="/state", tags=["state"], dependencies=[Depends(get_current_user)])


def _get_aggregator(request: Request):
    return request.app.state.aggregator


@router.get("", response_model=CognitiveStateOut)
def get_state(aggregator=Depends(_get_aggregator)):
    """Return the current cognitive load snapshot."""
    s = aggregator.current_state()
    est = aggregator._latest_estimate
    return CognitiveStateOut(
        load_score=s["load_score"],
        context=s["context"],
        confidence=s["confidence"],
        breakdown=LoadBreakdown(
            intrinsic=est.intrinsic if est else 0.0,
            extraneous=est.extraneous if est else 0.0,
            germane=est.germane if est else 0.0,
        ),
        timestamp=s["timestamp"],
    )


@router.websocket("/ws")
async def state_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
    aggregator=Depends(_get_aggregator),
    users_db=Depends(_get_users_db),
):
    """
    WebSocket stream — pushes a new cognitive state JSON object every 2 seconds.
    Auth via ?token=<jwt> query parameter (browsers cannot set WS headers).
    """
    user_id = _decode_token(token) if token else None
    if user_id is None or users_db.get_by_id(user_id) is None:
        await websocket.close(code=4001)
        return
    await websocket.accept()
    try:
        while True:
            s = aggregator.current_state()
            est = aggregator._latest_estimate
            payload = {
                "load_score": s["load_score"],
                "context": s["context"],
                "confidence": s["confidence"],
                "breakdown": {
                    "intrinsic": est.intrinsic if est else 0.0,
                    "extraneous": est.extraneous if est else 0.0,
                    "germane": est.germane if est else 0.0,
                },
                "timestamp": s["timestamp"],
            }
            await websocket.send_json(payload)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
