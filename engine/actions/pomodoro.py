"""
Adaptive Pomodoro Timer — adjusts interval length based on cognitive load.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from enum import Enum
from typing import Optional

from ..router.scheduler import TaskScheduler


class PomodoroPhase(str, Enum):
    WORK = "work"
    SHORT_BREAK = "short_break"
    LONG_BREAK = "long_break"
    IDLE = "idle"


@dataclass
class PomodoroState:
    phase: PomodoroPhase = PomodoroPhase.IDLE
    started_at: Optional[float] = None
    duration_seconds: int = 1500      # 25 min default
    sessions_completed: int = 0

    def elapsed_seconds(self) -> float:
        if not self.started_at:
            return 0.0
        return time.time() - self.started_at

    def remaining_seconds(self) -> float:
        return max(0.0, self.duration_seconds - self.elapsed_seconds())

    def is_complete(self) -> bool:
        return self.started_at is not None and self.elapsed_seconds() >= self.duration_seconds


class AdaptivePomodoro:

    def __init__(self):
        self._scheduler = TaskScheduler()
        self.state = PomodoroState()

    def start_work(self, load_score: float) -> PomodoroState:
        duration_min = self._scheduler.suggest_pomodoro_duration(load_score)
        self.state = PomodoroState(
            phase=PomodoroPhase.WORK,
            started_at=time.time(),
            duration_seconds=duration_min * 60,
            sessions_completed=self.state.sessions_completed,
        )
        return self.state

    def start_break(self, long: bool = False) -> PomodoroState:
        from ..settings import get_settings
        s = get_settings()
        duration_s = s["long_break_seconds"] if long else s["short_break_seconds"]
        self.state = PomodoroState(
            phase=PomodoroPhase.LONG_BREAK if long else PomodoroPhase.SHORT_BREAK,
            started_at=time.time(),
            duration_seconds=duration_s,
            sessions_completed=self.state.sessions_completed,
        )
        return self.state

    def tick(self, load_score: float) -> PomodoroState:
        if self.state.is_complete():
            if self.state.phase == PomodoroPhase.WORK:
                self.state.sessions_completed += 1
                long_break = self.state.sessions_completed % 4 == 0
                self.start_break(long=long_break)
            else:
                self.start_work(load_score)
        return self.state
