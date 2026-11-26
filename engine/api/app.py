"""
FastAPI application — cognitive load router API.
Runs on http://127.0.0.1:8765 by default.

All state lives on app.state, so each call to create_app() produces a fully
independent instance with no shared module-level globals. Cognitive state is
per user: app.state.engines holds one UserEngine per active account.
"""

from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from ..auth.ratelimit import default_limiters
from ..config import config
from ..db.connection import get_engine, init_db, reset_engine
from ..db.devices import DevicesDB
from ..db.tasks import TaskStore
from ..db.users import UsersDB
from ..inference.ml_estimator import _MODEL_PATH, load_bundled_model
from ..runtime import EngineRegistry
from ..settings import SettingsStore
from ..telemetry.timeline import CognitiveTimeline

log = logging.getLogger(__name__)

VERSION = "0.3.0"

_EVICT_EVERY_S = 60.0
_RETENTION_EVERY_S = 3600.0


# ---------------------------------------------------------------------------
# Background loop: inference ticks, idle-engine eviction, timeline retention
# ---------------------------------------------------------------------------

async def _background_loop(app: FastAPI, interval_ms: int) -> None:
    registry: EngineRegistry = app.state.engines
    timeline: CognitiveTimeline = app.state.timeline
    loop = asyncio.get_running_loop()
    last_evict = last_retention = time.time()
    while True:
        await asyncio.sleep(interval_ms / 1000.0)
        try:
            await loop.run_in_executor(None, registry.tick_all)

            now = time.time()
            if now - last_evict >= _EVICT_EVERY_S:
                last_evict = now
                registry.evict_idle(now)

            days = config.timeline_downsample_after_days
            if days > 0 and now - last_retention >= _RETENTION_EVERY_S:
                last_retention = now
                cutoff = now - days * 86400
                deleted = await loop.run_in_executor(None, timeline.downsample_before, cutoff)
                if deleted:
                    log.info("Timeline retention: thinned %d old inference ticks", deleted)
        except Exception:
            import traceback
            traceback.print_exc()


# ---------------------------------------------------------------------------
# Lifespan — initialises and tears down all per-app state
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    config.check_secrets()

    db_path = config.data_dir / config.timeline_db
    engine = get_engine(db_path)
    init_db(engine)                              # create tables if not exist
    app.state.db_engine = engine
    app.state.timeline = CognitiveTimeline(engine)
    app.state.users_db = UsersDB(engine)
    app.state.devices_db = DevicesDB(engine)
    app.state.settings_store = SettingsStore(engine)
    app.state.task_store = TaskStore(engine)
    app.state.rate_limiters = default_limiters()
    app.state.engines = EngineRegistry(
        timeline=app.state.timeline,
        settings_store=app.state.settings_store,
        task_store=app.state.task_store,
        idle_ttl_s=config.engine_idle_ttl_s,
        # Toggling OS Do Not Disturb only makes sense on the student's own machine.
        control_os_notifications=not config.is_production,
    )

    task = asyncio.create_task(_background_loop(app, config.inference_interval_ms))

    yield

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    reset_engine()


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    app = FastAPI(
        title="Cognitive Load Router",
        description="Cognitive state API for student productivity",
        version=VERSION,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in config.allowed_origins.split(",") if o.strip()],
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
    )

    from ..auth.router import router as auth_router
    from .routers import actions, devices, settings, state, telemetry, timeline

    app.include_router(auth_router)
    app.include_router(devices.router)
    app.include_router(state.router)
    app.include_router(telemetry.router)
    app.include_router(actions.router)
    app.include_router(timeline.router)
    app.include_router(settings.router)

    @app.get("/health")
    def health(request: Request):
        estimator = "ml" if load_bundled_model(_MODEL_PATH) is not None else "v1"
        registry = getattr(request.app.state, "engines", None)
        return {
            "status": "ok",
            "version": VERSION,
            "estimator": estimator,
            "active_engines": len(registry) if registry is not None else 0,
        }

    return app


app = create_app()
