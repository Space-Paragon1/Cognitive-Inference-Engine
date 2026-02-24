"""
Pydantic schemas for the FastAPI local API.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# ── Telemetry ──────────────────────────────────────────────────────────────

class TelemetryEventIn(BaseModel):
    source: str = Field(..., description="browser | ide | desktop")
    type: str   = Field(..., description="Raw event type string from the plugin")
    timestamp: Optional[float] = None
    data: Dict[str, Any] = Field(default_factory=dict)


# ── Cognitive State ────────────────────────────────────────────────────────

class LoadBreakdown(BaseModel):
    intrinsic: float
    extraneous: float
    germane: float


class CognitiveStateOut(BaseModel):
    load_score: float = Field(..., ge=0.0, le=1.0)
    context: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    breakdown: LoadBreakdown
    timestamp: float


# ── Actions ────────────────────────────────────────────────────────────────

class ActionDirectiveOut(BaseModel):
    action_type: str
    params: Dict[str, Any] = Field(default_factory=dict)
    priority: int
    reason: str


class ActiveActionsOut(BaseModel):
    directives: List[ActionDirectiveOut]
    load_score: float
    context: str


# ── Focus Mode ─────────────────────────────────────────────────────────────

class FocusModeRequest(BaseModel):
    duration_minutes: int = 25
    block_tabs: bool = True
    reason: str = ""


class FocusModeStateOut(BaseModel):
    active: bool
    elapsed_minutes: float
    duration_minutes: int
    block_tabs: bool
    reason: str


# ── Tasks ──────────────────────────────────────────────────────────────────

class TaskIn(BaseModel):
    id: str
    title: str
    difficulty: str = Field(..., description="easy | medium | hard | review")
    estimated_minutes: int = 25
    tags: List[str] = Field(default_factory=list)


class TaskOut(BaseModel):
    id: str
    title: str
    difficulty: str
    estimated_minutes: int
    tags: List[str]


class TaskQueueOut(BaseModel):
    tasks: List[TaskOut]
    recommended_duration_minutes: int


# ── Timeline ───────────────────────────────────────────────────────────────

class TimelineEntryOut(BaseModel):
    id: Optional[int]
    timestamp: float
    source: str
    event_type: str
    load_score: float
    context: str
    metadata_json: str


class TimelineQueryParams(BaseModel):
    since: Optional[float] = None
    until: Optional[float] = None
    source: Optional[str] = None
    limit: int = Field(default=200, le=1000)


# ── Session Analytics ──────────────────────────────────────────────────────

class SessionSummaryOut(BaseModel):
    session_index: int
    start_ts: float
    end_ts: float
    duration_minutes: float
    tick_count: int
    avg_load_score: float
    peak_load_score: float
    context_distribution: Dict[str, float]
    dominant_context: str


class DailyStatsOut(BaseModel):
    date: str
    tick_count: int
    session_count: int
    avg_load_score: float
    peak_load_score: float
    total_session_minutes: float
    focus_minutes: float
    context_distribution: Dict[str, float]


# ── Pomodoro ───────────────────────────────────────────────────────────────

class PomodoroStateOut(BaseModel):
    phase: str
    elapsed_seconds: float
    remaining_seconds: float
    sessions_completed: int
    duration_seconds: int
