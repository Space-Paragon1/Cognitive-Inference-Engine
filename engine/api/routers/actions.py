"""
/actions — query active directives, control focus mode, manage task queue, Pomodoro.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from ...api.schemas import (
    ActionDirectiveOut,
    ActiveActionsOut,
    FocusModeRequest,
    FocusModeStateOut,
    PomodoroStateOut,
    TaskIn,
    TaskOut,
    TaskQueueOut,
)

router = APIRouter(prefix="/actions", tags=["actions"])


def _get_aggregator(request: Request):
    return request.app.state.aggregator


def _get_services(request: Request):
    return request.app.state.services


# ── Directives ──────────────────────────────────────────────────────────────

@router.get("/directives", response_model=ActiveActionsOut)
def get_directives(
    aggregator=Depends(_get_aggregator),
    services=Depends(_get_services),
):
    """Return the routing engine's current action directives."""
    state = aggregator.current_state()
    directives = services["policy"].evaluate(
        aggregator._latest_estimate,
        aggregator._latest_context,
    ) if aggregator._latest_estimate else []

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
def start_focus(req: FocusModeRequest, services=Depends(_get_services)):
    """Activate focus mode."""
    state = services["focus"].activate(
        duration_minutes=req.duration_minutes,
        reason=req.reason,
        block_tabs=req.block_tabs,
    )
    return FocusModeStateOut(
        active=state.active,
        elapsed_minutes=state.elapsed_minutes(),
        duration_minutes=state.duration_minutes,
        block_tabs=state.block_tabs,
        reason=state.reason,
    )


@router.post("/focus/stop", response_model=FocusModeStateOut)
def stop_focus(services=Depends(_get_services)):
    """Deactivate focus mode."""
    state = services["focus"].deactivate()
    return FocusModeStateOut(
        active=state.active,
        elapsed_minutes=state.elapsed_minutes(),
        duration_minutes=state.duration_minutes,
        block_tabs=state.block_tabs,
        reason=state.reason,
    )


@router.get("/focus", response_model=FocusModeStateOut)
def get_focus(services=Depends(_get_services)):
    state = services["focus"].tick()
    return FocusModeStateOut(
        active=state.active,
        elapsed_minutes=state.elapsed_minutes(),
        duration_minutes=state.duration_minutes,
        block_tabs=state.block_tabs,
        reason=state.reason,
    )


# ── Task Queue ──────────────────────────────────────────────────────────────

@router.get("/tasks", response_model=TaskQueueOut)
def get_tasks(services=Depends(_get_services)):
    q = services["task_queue"]
    return TaskQueueOut(
        tasks=[TaskOut(**t.__dict__) for t in q.all_tasks()],
        recommended_duration_minutes=q.recommended_duration(),
    )


@router.post("/tasks", response_model=TaskOut, status_code=201)
def add_task(task: TaskIn, services=Depends(_get_services)):
    from ...router.scheduler import Difficulty, Task
    t = Task(
        id=task.id,
        title=task.title,
        difficulty=Difficulty(task.difficulty),
        estimated_minutes=task.estimated_minutes,
        tags=task.tags,
    )
    services["task_queue"].add_task(t)
    return TaskOut(**t.__dict__)


@router.delete("/tasks/{task_id}")
def remove_task(task_id: str, services=Depends(_get_services)):
    removed = services["task_queue"].remove_task(task_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": "removed"}


# ── Pomodoro ────────────────────────────────────────────────────────────────

@router.get("/pomodoro", response_model=PomodoroStateOut)
def get_pomodoro(
    aggregator=Depends(_get_aggregator),
    services=Depends(_get_services),
):
    load = aggregator.current_state()["load_score"]
    state = services["pomodoro"].tick(load)
    return PomodoroStateOut(
        phase=state.phase.value,
        elapsed_seconds=state.elapsed_seconds(),
        remaining_seconds=state.remaining_seconds(),
        sessions_completed=state.sessions_completed,
        duration_seconds=state.duration_seconds,
    )


@router.post("/pomodoro/start", response_model=PomodoroStateOut)
def start_pomodoro(
    aggregator=Depends(_get_aggregator),
    services=Depends(_get_services),
):
    load = aggregator.current_state()["load_score"]
    state = services["pomodoro"].start_work(load)
    return PomodoroStateOut(
        phase=state.phase.value,
        elapsed_seconds=state.elapsed_seconds(),
        remaining_seconds=state.remaining_seconds(),
        sessions_completed=state.sessions_completed,
        duration_seconds=state.duration_seconds,
    )
