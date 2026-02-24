"""
Task Queue Manager — in-memory task queue with load-aware reordering.
"""

from __future__ import annotations

from typing import List, Optional

from ..router.scheduler import Task, TaskScheduler


class TaskQueueManager:

    def __init__(self):
        self._tasks: List[Task] = []
        self._scheduler = TaskScheduler()
        self._current_load: float = 0.5

    # ------------------------------------------------------------------
    # Queue management
    # ------------------------------------------------------------------

    def add_task(self, task: Task) -> None:
        self._tasks.append(task)

    def remove_task(self, task_id: str) -> bool:
        before = len(self._tasks)
        self._tasks = [t for t in self._tasks if t.id != task_id]
        return len(self._tasks) < before

    def complete_current(self) -> Optional[Task]:
        if not self._tasks:
            return None
        completed = self._tasks.pop(0)
        return completed

    # ------------------------------------------------------------------
    # Load-aware ordering
    # ------------------------------------------------------------------

    def update_load(self, load_score: float) -> None:
        self._current_load = load_score
        self._tasks = self._scheduler.reorder(self._tasks, load_score)

    def peek(self) -> Optional[Task]:
        return self._tasks[0] if self._tasks else None

    def all_tasks(self) -> List[Task]:
        return list(self._tasks)

    def recommended_duration(self) -> int:
        return self._scheduler.suggest_pomodoro_duration(self._current_load)
