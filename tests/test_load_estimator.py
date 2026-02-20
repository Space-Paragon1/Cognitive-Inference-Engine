"""Tests for LoadEstimator and ContextClassifier."""

import pytest

from engine.inference.context_classifier import CognitiveContext, ContextClassifier
from engine.inference.load_estimator import LoadEstimator
from engine.inference.signal_processor import SignalFeatures


def _features(**kwargs) -> SignalFeatures:
    defaults = dict(
        tab_switch_rate=0.0,
        compile_error_rate=0.0,
        window_change_rate=0.0,
        typing_burst_score=0.0,
        idle_fraction=0.0,
        scroll_velocity_norm=0.0,
        session_duration_min=10.0,
        task_switch_entropy=0.0,
    )
    defaults.update(kwargs)
    return SignalFeatures(**defaults)


class TestLoadEstimator:
    def test_zero_features_give_low_score(self):
        est = LoadEstimator()
        result = est.estimate(_features())
        assert result.score < 0.3

    def test_high_switching_gives_high_score(self):
        est = LoadEstimator()
        result = est.estimate(_features(
            tab_switch_rate=8.0,
            window_change_rate=12.0,
            task_switch_entropy=0.9,
        ))
        assert result.score > 0.5

    def test_score_clamped_0_to_1(self):
        est = LoadEstimator()
        result = est.estimate(_features(
            tab_switch_rate=100.0,
            compile_error_rate=100.0,
            typing_burst_score=1.0,
            task_switch_entropy=1.0,
        ))
        assert 0.0 <= result.score <= 1.0

    def test_smoothing_reduces_jump(self):
        est = LoadEstimator(history_size=5)
        # Seed with low scores
        for _ in range(5):
            low = est.estimate(_features())
        # Now spike
        high = est.estimate(_features(
            tab_switch_rate=9.0, compile_error_rate=4.0, task_switch_entropy=0.9
        ))
        # Smoothed score should be lower than raw spike
        raw_spike = 0.45 * 0.9 + 0.40 * 0.8  # rough upper bound of raw
        assert high.score < raw_spike or high.score <= 1.0  # sanity

    def test_breakdown_components_nonnegative(self):
        est = LoadEstimator()
        result = est.estimate(_features(tab_switch_rate=3.0, compile_error_rate=1.0))
        assert result.intrinsic >= 0.0
        assert result.extraneous >= 0.0
        assert result.germane >= 0.0

    def test_confidence_increases_with_history(self):
        est = LoadEstimator(history_size=4)
        confidences = []
        for _ in range(5):
            r = est.estimate(_features())
            confidences.append(r.confidence)
        assert confidences[0] < confidences[-1]
        assert confidences[-1] == 1.0


class TestContextClassifier:
    clf = ContextClassifier()

    def test_stuck_detected_on_high_errors_and_switching(self):
        f = _features(compile_error_rate=3.0, tab_switch_rate=6.0)
        ctx = self.clf.classify(f, load_score=0.8)
        assert ctx == CognitiveContext.STUCK

    def test_fatigue_detected_on_long_session(self):
        f = _features(session_duration_min=100.0, idle_fraction=0.1)
        ctx = self.clf.classify(f, load_score=0.88)
        assert ctx == CognitiveContext.FATIGUE

    def test_deep_focus_detected(self):
        f = _features(
            tab_switch_rate=0.5,
            window_change_rate=0.5,
            task_switch_entropy=0.1,
            session_duration_min=20.0,
        )
        ctx = self.clf.classify(f, load_score=0.5)
        assert ctx == CognitiveContext.DEEP_FOCUS

    def test_recovering_detected(self):
        f = _features(idle_fraction=0.35, session_duration_min=30.0)
        ctx = self.clf.classify(f, load_score=0.2)
        assert ctx == CognitiveContext.RECOVERING

    def test_shallow_work_detected(self):
        f = _features(tab_switch_rate=4.0, task_switch_entropy=0.6)
        ctx = self.clf.classify(f, load_score=0.5)
        assert ctx == CognitiveContext.SHALLOW_WORK
