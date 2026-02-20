"""
/timeline — query the cognitive activity timeline.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request

from ...api.schemas import TimelineEntryOut

router = APIRouter(prefix="/timeline", tags=["timeline"])


def _get_timeline(request: Request):
    return request.app.state.timeline


@router.get("", response_model=List[TimelineEntryOut])
def query_timeline(
    since: Optional[float] = Query(default=None, description="Unix timestamp lower bound"),
    until: Optional[float] = Query(default=None, description="Unix timestamp upper bound"),
    source: Optional[str] = Query(default=None, description="Filter by source (browser|ide|desktop|engine)"),
    limit: int = Query(default=200, le=1000),
    timeline=Depends(_get_timeline),
):
    entries = timeline.query(since=since, until=until, source=source, limit=limit)
    return [
        TimelineEntryOut(
            id=e.id,
            timestamp=e.timestamp,
            source=e.source,
            event_type=e.event_type,
            load_score=e.load_score,
            context=e.context,
            metadata_json=e.metadata_json,
        )
        for e in entries
    ]


@router.get("/load-history")
def load_history(
    window_s: int = Query(default=300, description="Rolling window in seconds"),
    timeline=Depends(_get_timeline),
):
    scores = timeline.recent_load_scores(window_s=window_s)
    return {"scores": scores, "window_seconds": window_s, "count": len(scores)}
