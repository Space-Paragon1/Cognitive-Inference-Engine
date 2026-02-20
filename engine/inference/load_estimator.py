"""
Cognitive Load Estimator — produces a continuous load score in [0, 1].

Architecture (v1): weighted linear combination of normalized signal features.
The weights encode domain knowledge from cognitive load theory (Sweller, 1988):
  - Intrinsic load   ← task complexity signals (compile errors, error rate)
  - Extraneous load  ← switching / interruption signals
  - Germane load     ← productive engagement signals (typing bursts at moderate rate)

A future v2 can swap the `_score_linear` method for a small trained regressor
without changing any downstream code.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from .signal_processor import SignalFeatures


@dataclass
class LoadEstimate:
    score: float           # 0 (no load) → 1 (max load)
    intrinsic: float       # component breakdown
    extraneous: float
    germane: float
    confidence: float      # 0-1, based on how much data was available


# Feature weights — tuned from first principles, refine with real data
_INTRINSIC_WEIGHTS = {
    "compile_error_rate": 0.40,
    "typing_burst_score": 0.35,
    "scroll_velocity_norm": 0.25,
}

_EXTRANEOUS_WEIGHTS = {
    "tab_switch_rate": 0.45,
    "window_change_rate": 0.30,
    "task_switch_entropy": 0.25,
}

_GERMANE_WEIGHTS = {
    "idle_fraction": -0.60,   # idle reduces germane load (negative = drag on score)
    "session_duration_min": 0.40,  # longer engagement = more processing
}


def _weighted(features: SignalFeatures, weights: dict) -> float:
    total_weight = sum(abs(w) for w in weights.values())
    score = 0.0
    for feature_name, weight in weights.items():
        value = getattr(features, feature_name, 0.0)
        # normalize session_duration to 0-1 (cap at 120 min)
        if feature_name == "session_duration_min":
            value = min(value / 120.0, 1.0)
        # normalize tab_switch_rate (cap at 10/min)
        if feature_name == "tab_switch_rate":
            value = min(value / 10.0, 1.0)
        # normalize window_change_rate (cap at 15/min)
        if feature_name == "window_change_rate":
            value = min(value / 15.0, 1.0)
        # normalize compile_error_rate (cap at 5/min)
        if feature_name == "compile_error_rate":
            value = min(value / 5.0, 1.0)
        score += weight * value
    return max(0.0, min(score / total_weight, 1.0))


class LoadEstimator:
    """Stateless estimator — call `estimate` with a fresh SignalFeatures snapshot."""

    def __init__(self, history_size: int = 5):
        self._history: List[float] = []
        self._history_size = history_size

    def estimate(self, features: SignalFeatures) -> LoadEstimate:
        intrinsic = _weighted(features, _INTRINSIC_WEIGHTS)
        extraneous = _weighted(features, _EXTRANEOUS_WEIGHTS)
        germane_component = _weighted(features, _GERMANE_WEIGHTS)

        # Combine: extraneous + intrinsic drive load up; germane moderates it
        raw = 0.62 * extraneous + 0.28 * intrinsic + 0.10 * germane_component
        score = max(0.0, min(raw, 1.0))

        # Exponential moving average smoothing
        if self._history:
            alpha = 0.3
            score = alpha * score + (1 - alpha) * self._history[-1]
        self._history.append(score)
        if len(self._history) > self._history_size:
            self._history.pop(0)

        confidence = min(len(self._history) / self._history_size, 1.0)

        return LoadEstimate(
            score=round(score, 4),
            intrinsic=round(intrinsic, 4),
            extraneous=round(extraneous, 4),
            germane=round(germane_component, 4),
            confidence=round(confidence, 4),
        )
