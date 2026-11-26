"""
/actions — query active directives, control focus mode, manage task queue, Pomodoro.

Everything here acts on the caller's own engine. Focus-mode endpoints also
accept device tokens, because the browser extension polls focus state to
block tabs and its popup can start/stop a session.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ...api.schemas import (
    ActionDirectiveOut,
    ActiveActionsOut,
    DnDOut,
    DnDRequest,
    FocusModeRequest,
    FocusModeStateOut,
    PomodoroStateOut,
    TaskIn,
    TaskOut,
    TaskQueueOut,
)
from ...auth.service import get_current_user
from ...config import config
from ...router.scheduler import Difficulty, Task
from ...runtime import UserEngine
from ..deps import principal_engine, user_engine

router = APIRouter(prefix="/actions", tags=["actions"])


def _focus_out(state) -> FocusModeStateOut:
    return FocusModeStateOut(
        active=state.active,
        elapsed_minutes=state.elapsed_minutes(),
        duration_minutes=state.duration_minutes,
        block_tabs=state.block_tabs,
        reason=state.reason,
    )


def _pomodoro_out(state) -> PomodoroStateOut:
    return PomodoroStateOut(
        phase=state.phase.value,
        elapsed_seconds=state.elapsed_seconds(),
        remaining_seconds=state.remaining_seconds(),
        sessions_completed=state.sessions_completed,
        duration_seconds=state.duration_seconds,
    )


# ── Directives ──────────────────────────────────────────────────────────────

@router.get("/directives", response_model=ActiveActionsOut)
def get_directives(engine: UserEngine = Depends(user_engine)):
    """Return the routing engine's current action directives."""
    agg = engine.aggregator
    state = agg.current_state()
    estimate = agg.latest_estimate
    directives = (
        engine.policy.evaluate(estimate, agg.latest_context) if estimate and state["active"] else []
    )
    return ActiveActionsOut(
        directives=[
            ActionDirectiveOut(
                action_type=d.action_type,
                params=d.params,
                priority=d.priority,
                reason=d.reason,
            )
            for d in directives
        ],
        load_score=state["load_score"],
        context=state["context"],
    )


# ── Focus Mode ──────────────────────────────────────────────────────────────

@router.post("/focus/start", response_model=FocusModeStateOut)
def start_focus(req: FocusModeRequest, engine: UserEngine = Depends(principal_engine)):
    """Activate focus mode."""
    return _focus_out(
        engine.focus.activate(
            duration_minutes=req.duration_minutes,
            reason=req.reason,
            block_tabs=req.block_tabs,
        )
    )


@router.post("/focus/stop", response_model=FocusModeStateOut)
def stop_focus(engine: UserEngine = Depends(principal_engine)):
    """Deactivate focus mode."""
    return _focus_out(engine.focus.deactivate())


@router.get("/focus", response_model=FocusModeStateOut)
def get_focus(engine: UserEngine = Depends(principal_engine)):
    return _focus_out(engine.focus.tick())


# ── Task Queue ──────────────────────────────────────────────────────────────

@router.get("/tasks", response_model=TaskQueueOut)
def get_tasks(engine: UserEngine = Depends(user_engine)):
    q = engine.task_queue
    return TaskQueueOut(
        tasks=[TaskOut(**t.__dict__) for t in q.all_tasks()],
        recommended_duration_minutes=q.recommended_duration(),
    )


@router.post("/tasks", response_model=TaskOut, status_code=201)
def add_task(task: TaskIn, engine: UserEngine = Depends(user_engine)):
    try:
        difficulty = Difficulty(task.difficulty)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Unknown difficulty: {task.difficulty!r}")
    t = Task(
        id=task.id,
        title=task.title,
        difficulty=difficulty,
        estimated_minutes=task.estimated_minutes,
        tags=task.tags,
    )
    engine.task_queue.add_task(t)
    return TaskOut(**t.__dict__)


@router.delete("/tasks/{task_id}")
def remove_task(task_id: str, engine: UserEngine = Depends(user_engine)):
    if not engine.task_queue.remove_task(task_id):
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": "removed"}


# ── Pomodoro ────────────────────────────────────────────────────────────────

@router.get("/pomodoro", response_model=PomodoroStateOut)
def get_pomodoro(engine: UserEngine = Depends(user_engine)):
    load = engine.aggregator.current_state()["load_score"]
    return _pomodoro_out(engine.pomodoro.tick(load))


@router.post("/pomodoro/stop", response_model=PomodoroStateOut)
def stop_pomodoro(engine: UserEngine = Depends(user_engine)):
    return _pomodoro_out(engine.pomodoro.reset())


@router.post("/pomodoro/start", response_model=PomodoroStateOut)
def start_pomodoro(engine: UserEngine = Depends(user_engine)):
    load = engine.aggregator.current_state()["load_score"]
    return _pomodoro_out(engine.pomodoro.start_work(load))


# ── Do Not Disturb ──────────────────────────────────────────────────────────

@router.post("/dnd", response_model=DnDOut, dependencies=[Depends(get_current_user)])
def set_dnd(body: DnDRequest):
    """
    Suppress or restore OS-level Do Not Disturb / Focus Assist.
    Only meaningful when the engine runs on the student's own machine; a
    hosted engine reports ok=false instead of touching the server's OS.
    """
    if config.is_production:
        return DnDOut(enabled=body.enabled, ok=False)
    from ...actions.notifications import NotificationController
    nc = NotificationController()
    ok = nc.suppress() if body.enabled else nc.allow()
    return DnDOut(enabled=body.enabled, ok=ok)
