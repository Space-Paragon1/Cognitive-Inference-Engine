"""
FastAPI application — local cognitive load router API.
Runs on http://127.0.0.1:8765 by default.

Singletons (timeline, aggregator, services) live on app.state so that each
call to create_app() produces a fully independent instance with no shared
module-level globals. This makes test isolation straightforward.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from ..actions.focus_mode import FocusModeController
from ..actions.pomodoro import AdaptivePomodoro
from ..actions.task_queue import TaskQueueManager
from ..config import config
from ..router.policy_engine import PolicyEngine
from ..telemetry.aggregator import TelemetryAggregator
from ..telemetry.timeline import CognitiveTimeline


# ---------------------------------------------------------------------------
# Background inference loop
# ---------------------------------------------------------------------------

async def _inference_loop(aggregator: TelemetryAggregator, interval_ms: int) -> None:
    while True:
        await asyncio.sleep(interval_ms / 1000.0)
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, aggregator.tick)
        except Exception:
            import traceback
            traceback.print_exc()


# ---------------------------------------------------------------------------
# Lifespan — initialises and tears down all per-app state
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    db_path = config.data_dir / config.timeline_db
    app.state.timeline = CognitiveTimeline(db_path)
    app.state.aggregator = TelemetryAggregator(app.state.timeline)

    focus = FocusModeController()
    pomodoro = AdaptivePomodoro()
    task_queue = TaskQueueManager()
    policy = PolicyEngine()

    app.state.services = {
        "focus": focus,
        "pomodoro": pomodoro,
        "task_queue": task_queue,
        "policy": policy,
    }

    def _on_tick(estimate, context):
        task_queue.update_load(estimate.score)
        focus.tick()
        pomodoro.tick(estimate.score)

    app.state.aggregator.register_listener(_on_tick)

    inference_task = asyncio.create_task(
        _inference_loop(app.state.aggregator, config.inference_interval_ms)
    )

    yield

    inference_task.cancel()
    try:
        await inference_task
    except asyncio.CancelledError:
        pass


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    app = FastAPI(
        title="Cognitive Load Router",
        description="Local-first cognitive state API for student productivity",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:3000", "null"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from .routers import actions, state, telemetry, timeline

    app.include_router(state.router)
    app.include_router(telemetry.router)
    app.include_router(actions.router)
    app.include_router(timeline.router)

    @app.get("/health")
    def health(request: Request):
        agg = getattr(request.app.state, "aggregator", None)
        if agg is None:
            estimator_mode = "unknown"
        else:
            estimator_mode = "ml" if agg._estimator.using_ml_model else "v1"
        return {"status": "ok", "version": "0.2.0", "estimator": estimator_mode}

    return app


app = create_app()
