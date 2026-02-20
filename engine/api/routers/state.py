"""
/state — current cognitive state endpoint + WebSocket stream.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Request, WebSocket, WebSocketDisconnect

from ...api.schemas import CognitiveStateOut, LoadBreakdown

router = APIRouter(prefix="/state", tags=["state"])


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
async def state_websocket(websocket: WebSocket, aggregator=Depends(_get_aggregator)):
    """
    WebSocket stream — pushes a new cognitive state JSON object every 2 seconds.
    The React dashboard subscribes to this for live updates.
    """
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
