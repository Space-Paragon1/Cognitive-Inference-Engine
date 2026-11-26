"""
Per-user engine registry.

Each signed-in user gets their own UserEngine (aggregator, focus mode,
Pomodoro, task queue, policy engine). Engines are created on first use and
dropped from memory after ``idle_ttl_s`` with no telemetry or API calls,
unless a focus session or Pomodoro is still running. Nothing is lost on
eviction: the timeline, tasks and settings live in the database.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .actions.focus_mode import FocusModeController
from .actions.pomodoro import AdaptivePomodoro
from .actions.task_queue import TaskQueueManager
from .db.tasks import TaskStore
from .router.policy_engine import PolicyEngine
from .settings import SettingsStore
from .telemetry.aggregator import TelemetryAggregator
from .telemetry.timeline import CognitiveTimeline


@dataclass
class UserEngine:
    user_id: int
    aggregator: TelemetryAggregator
    focus: FocusModeController
    pomodoro: AdaptivePomodoro
    task_queue: TaskQueueManager
    policy: PolicyEngine
    last_used: float = field(default_factory=time.time)

    def touch(self) -> None:
        self.last_used = time.time()

    @property
    def is_busy(self) -> bool:
        return self.focus.is_busy or self.pomodoro.is_busy


class EngineRegistry:
    def __init__(
        self,
        timeline: CognitiveTimeline,
        settings_store: SettingsStore,
        task_store: TaskStore,
        idle_ttl_s: float = 1800,
        control_os_notifications: bool = False,
    ):
        self._timeline = timeline
        self._settings = settings_store
        self._tasks = task_store
        self._idle_ttl_s = idle_ttl_s
        self._control_os = control_os_notifications
        self._engines: Dict[int, UserEngine] = {}
        self._lock = threading.Lock()

    def get(self, user_id: int) -> UserEngine:
        """Return the user's engine, creating it on first use."""
        with self._lock:
            engine = self._engines.get(user_id)
            if engine is None:
                engine = self._create(user_id)
                self._engines[user_id] = engine
        engine.touch()
        return engine

    def peek(self, user_id: int) -> Optional[UserEngine]:
        with self._lock:
            return self._engines.get(user_id)

    def _create(self, user_id: int) -> UserEngine:
        settings = self._settings.provider_for(user_id)
        aggregator = TelemetryAggregator(self._timeline, user_id=user_id, settings=settings)
        focus = FocusModeController(control_os_notifications=self._control_os)
        pomodoro = AdaptivePomodoro(settings)
        task_queue = TaskQueueManager(settings, store=self._tasks, user_id=user_id)

        def _on_tick(estimate, context):
            task_queue.update_load(estimate.score)
            focus.tick()
            pomodoro.tick(estimate.score)

        aggregator.register_listener(_on_tick)
        return UserEngine(
            user_id=user_id,
            aggregator=aggregator,
            focus=focus,
            pomodoro=pomodoro,
            task_queue=task_queue,
            policy=PolicyEngine(),
        )

    def engines(self) -> List[UserEngine]:
        with self._lock:
            return list(self._engines.values())

    def tick_all(self) -> None:
        for engine in self.engines():
            try:
                engine.aggregator.tick()
            except Exception:
                import traceback
                traceback.print_exc()

    def evict_idle(self, now: Optional[float] = None) -> int:
        now = now or time.time()
        with self._lock:
            stale = [
                uid for uid, e in self._engines.items()
                if now - e.last_used > self._idle_ttl_s and not e.is_busy
            ]
            for uid in stale:
                del self._engines[uid]
        return len(stale)

    def __len__(self) -> int:
        with self._lock:
            return len(self._engines)
