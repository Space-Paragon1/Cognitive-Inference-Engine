"""
/telemetry — ingest events from browser extension, IDE extension, desktop agent.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ...api.schemas import TelemetryEventIn
from ...telemetry.sources.browser import parse_browser_event
from ...telemetry.sources.desktop import parse_desktop_event
from ...telemetry.sources.ide import parse_ide_event

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


def _get_aggregator(request: Request):
    """Dependency — resolved by the app lifespan state."""
    return request.app.state.aggregator


def _to_payload(event: TelemetryEventIn) -> dict:
    payload = {"type": event.type, "data": event.data}
    if event.timestamp is not None:
        payload["timestamp"] = event.timestamp
    return payload


@router.post("/event", status_code=status.HTTP_202_ACCEPTED)
async def ingest_event(
    event: TelemetryEventIn,
    aggregator=Depends(_get_aggregator),
):
    """Accept a single telemetry event from any plugin source."""
    payload = _to_payload(event)

    parsed = None
    if event.source == "browser":
        parsed = parse_browser_event(payload)
    elif event.source == "ide":
        parsed = parse_ide_event(payload)
    elif event.source == "desktop":
        parsed = parse_desktop_event(payload)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown source: {event.source!r}")

    if parsed is None:
        raise HTTPException(status_code=422, detail=f"Unrecognised event type: {event.type!r}")

    await aggregator.push_event_async(parsed)
    return {"status": "accepted"}


@router.post("/batch", status_code=status.HTTP_202_ACCEPTED)
async def ingest_batch(
    events: list[TelemetryEventIn],
    aggregator=Depends(_get_aggregator),
):
    """Accept a batch of events (used by plugins that buffer locally)."""
    accepted = 0
    for event in events:
        payload = _to_payload(event)
        parsed = None
        if event.source == "browser":
            parsed = parse_browser_event(payload)
        elif event.source == "ide":
            parsed = parse_ide_event(payload)
        elif event.source == "desktop":
            parsed = parse_desktop_event(payload)
        if parsed:
            await aggregator.push_event_async(parsed)
            accepted += 1
    return {"accepted": accepted, "total": len(events)}
