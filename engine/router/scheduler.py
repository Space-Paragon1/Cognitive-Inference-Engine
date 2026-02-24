"""
Task Difficulty Scheduler — reorders the student's task queue based on
current cognitive load, applying the principle of optimal difficulty matching.

High load  → easy/review tasks first
Medium load → medium tasks
Low load   → hard/new-concept tasks
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List

from ..settings import get_settings


class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    REVIEW = "review"


@dataclass
class Task:
    id: str
    title: str
    difficulty: Difficulty
    estimated_minutes: int = 25
    tags: List[str] = field(default_factory=list)


class TaskScheduler:
    """
    Given the current load score and a list of pending tasks, returns
    a reordered queue optimized for cognitive state.
    """

    def reorder(self, tasks: List[Task], load_score: float) -> List[Task]:
        if not tasks:
            return []

        s = get_settings()
        high_threshold = s["high_load_threshold"]

        priority_order: List[Difficulty]

        if load_score >= high_threshold:
            # High load: easy → review → medium → hard
            priority_order = [Difficulty.EASY, Difficulty.REVIEW,
                              Difficulty.MEDIUM, Difficulty.HARD]
        elif load_score >= 0.4:
            # Medium load: medium → hard → review → easy
            priority_order = [Difficulty.MEDIUM, Difficulty.HARD,
                              Difficulty.REVIEW, Difficulty.EASY]
        else:
            # Low load: hard → medium → review → easy
            priority_order = [Difficulty.HARD, Difficulty.MEDIUM,
                              Difficulty.REVIEW, Difficulty.EASY]

        rank = {d: i for i, d in enumerate(priority_order)}
        return sorted(tasks, key=lambda t: rank.get(t.difficulty, 99))

    def suggest_pomodoro_duration(self, load_score: float) -> int:
        """Return recommended focus interval in minutes based on load."""
        s = get_settings()
        fatigue = s["fatigue_threshold"]
        high    = s["high_load_threshold"]
        if load_score >= fatigue:
            return 10   # fatigue: very short interval
        if load_score >= high:
            return 15   # high load
        if load_score >= 0.45:
            return 25   # standard Pomodoro
        return 35       # low load: extend deep work window
