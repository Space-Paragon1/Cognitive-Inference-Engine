"""Tests for the routing policy engine and task scheduler."""

import pytest

from engine.inference.context_classifier import CognitiveContext
from engine.inference.load_estimator import LoadEstimate
from engine.router.policy_engine import PolicyEngine
from engine.router.scheduler import Difficulty, Task, TaskScheduler


def _estimate(score: float) -> LoadEstimate:
    return LoadEstimate(
        score=score,
        intrinsic=score * 0.4,
        extraneous=score * 0.4,
        germane=score * 0.2,
        confidence=1.0,
    )


class TestPolicyEngine:
    engine = PolicyEngine()

    def test_stuck_high_load_returns_suppress_notifications(self):
        directives = self.engine.evaluate(
            _estimate(0.8), CognitiveContext.STUCK
        )
        types = [d.action_type for d in directives]
        assert "suppress_notifications" in types

    def test_stuck_returns_suggest_task(self):
        directives = self.engine.evaluate(
            _estimate(0.75), CognitiveContext.STUCK
        )
        types = [d.action_type for d in directives]
        assert "suggest_task" in types

    def test_fatigue_returns_recommend_break(self):
        directives = self.engine.evaluate(
            _estimate(0.9), CognitiveContext.FATIGUE
        )
        types = [d.action_type for d in directives]
        assert "recommend_break" in types

    def test_deep_focus_returns_suppress_notifications(self):
        directives = self.engine.evaluate(
            _estimate(0.5), CognitiveContext.DEEP_FOCUS
        )
        types = [d.action_type for d in directives]
        assert "suppress_notifications" in types

    def test_recovering_returns_allow_notifications(self):
        directives = self.engine.evaluate(
            _estimate(0.2), CognitiveContext.RECOVERING
        )
        types = [d.action_type for d in directives]
        assert "allow_notifications" in types

    def test_directives_sorted_by_priority(self):
        directives = self.engine.evaluate(
            _estimate(0.8), CognitiveContext.STUCK
        )
        priorities = [d.priority for d in directives]
        assert priorities == sorted(priorities)

    def test_no_match_returns_empty(self):
        directives = self.engine.evaluate(
            _estimate(0.5), CognitiveContext.UNKNOWN
        )
        assert directives == []


class TestTaskScheduler:
    sched = TaskScheduler()

    def _tasks(self) -> list[Task]:
        return [
            Task("1", "Hard topic", Difficulty.HARD),
            Task("2", "Easy review", Difficulty.EASY),
            Task("3", "Medium exercise", Difficulty.MEDIUM),
            Task("4", "Review flashcards", Difficulty.REVIEW),
        ]

    def test_high_load_puts_easy_first(self):
        ordered = self.sched.reorder(self._tasks(), load_score=0.85)
        assert ordered[0].difficulty == Difficulty.EASY

    def test_low_load_puts_hard_first(self):
        ordered = self.sched.reorder(self._tasks(), load_score=0.2)
        assert ordered[0].difficulty == Difficulty.HARD

    def test_medium_load_puts_medium_first(self):
        ordered = self.sched.reorder(self._tasks(), load_score=0.55)
        assert ordered[0].difficulty in (Difficulty.MEDIUM, Difficulty.HARD)

    def test_pomodoro_duration_high_load(self):
        assert self.sched.suggest_pomodoro_duration(0.9) == 10

    def test_pomodoro_duration_low_load(self):
        assert self.sched.suggest_pomodoro_duration(0.2) == 35

    def test_pomodoro_duration_standard(self):
        assert self.sched.suggest_pomodoro_duration(0.5) == 25

    def test_empty_task_list(self):
        assert self.sched.reorder([], 0.8) == []
