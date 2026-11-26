"""
Task store — persists each user's task queue so it survives restarts and
engine eviction. Ordering is not stored: the queue is reordered by load at
read time.
"""

from __future__ import annotations

import json
import time
from typing import List

from sqlalchemy import and_, select
from sqlalchemy.engine import Engine

from ..router.scheduler import Difficulty, Task
from .connection import tasks_table


class TaskStore:
    def __init__(self, engine: Engine):
        self._engine = engine

    def list(self, user_id: int) -> List[Task]:
        with self._engine.connect() as conn:
            rows = conn.execute(
                select(tasks_table)
                .where(tasks_table.c.user_id == user_id)
                .order_by(tasks_table.c.created_at, tasks_table.c.id)
            ).fetchall()
        return [
            Task(
                id=r.task_id,
                title=r.title,
                difficulty=Difficulty(r.difficulty),
                estimated_minutes=r.estimated_minutes,
                tags=json.loads(r.tags_json or "[]"),
            )
            for r in rows
        ]

    def upsert(self, user_id: int, task: Task) -> None:
        """Insert, or replace the task with the same id (so client retries are safe)."""
        values = dict(
            title=task.title,
            difficulty=task.difficulty.value,
            estimated_minutes=task.estimated_minutes,
            tags_json=json.dumps(task.tags),
        )
        where = and_(tasks_table.c.user_id == user_id, tasks_table.c.task_id == task.id)
        with self._engine.begin() as conn:
            updated = conn.execute(tasks_table.update().where(where).values(**values))
            if updated.rowcount == 0:
                conn.execute(
                    tasks_table.insert().values(
                        user_id=user_id, task_id=task.id, created_at=time.time(), **values
                    )
                )

    def delete(self, user_id: int, task_id: str) -> bool:
        with self._engine.begin() as conn:
            result = conn.execute(
                tasks_table.delete().where(
                    and_(tasks_table.c.user_id == user_id, tasks_table.c.task_id == task_id)
                )
            )
        return result.rowcount > 0
