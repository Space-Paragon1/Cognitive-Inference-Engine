"""
Task Queue Manager — one user's task queue with load-aware reordering.

Tasks are persisted through an optional TaskStore; without one (unit tests)
the queue lives in memory only.
"""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING, List, Optional

from ..router.scheduler import Task, TaskScheduler
from ..settings import SettingsProvider

if TYPE_CHECKING:
    from ..db.tasks import TaskStore


class TaskQueueManager:

    def __init__(
        self,
        settings: Optional[SettingsProvider] = None,
        store: Optional["TaskStore"] = None,
        user_id: Optional[int] = None,
    ):
        self._scheduler = TaskScheduler(settings)
        self._store = store
        self._user_id = user_id
        self._lock = threading.Lock()
        self._current_load: float = 0.5
        self._tasks: List[Task] = (
            store.list(user_id) if store is not None and user_id is not None else []
        )
        self._tasks = self._scheduler.reorder(self._tasks, self._current_load)

    @property
    def _persistent(self) -> bool:
        return self._store is not None and self._user_id is not None

    # ------------------------------------------------------------------
    # Queue management
    # ------------------------------------------------------------------

    def add_task(self, task: Task) -> None:
        if self._persistent:
            self._store.upsert(self._user_id, task)
        with self._lock:
            self._tasks = [t for t in self._tasks if t.id != task.id] + [task]
            self._tasks = self._scheduler.reorder(self._tasks, self._current_load)

    def remove_task(self, task_id: str) -> bool:
        if self._persistent:
            self._store.delete(self._user_id, task_id)
        with self._lock:
            before = len(self._tasks)
            self._tasks = [t for t in self._tasks if t.id != task_id]
            return len(self._tasks) < before

    def complete_current(self) -> Optional[Task]:
        with self._lock:
            if not self._tasks:
                return None
            completed = self._tasks.pop(0)
        if self._persistent:
            self._store.delete(self._user_id, completed.id)
        return completed

    # ------------------------------------------------------------------
    # Load-aware ordering
    # ------------------------------------------------------------------

    def update_load(self, load_score: float) -> None:
        with self._lock:
            self._current_load = load_score
            self._tasks = self._scheduler.reorder(self._tasks, load_score)

    def peek(self) -> Optional[Task]:
        with self._lock:
            return self._tasks[0] if self._tasks else None

    def all_tasks(self) -> List[Task]:
        with self._lock:
            return list(self._tasks)

    def recommended_duration(self) -> int:
        return self._scheduler.suggest_pomodoro_duration(self._current_load)
