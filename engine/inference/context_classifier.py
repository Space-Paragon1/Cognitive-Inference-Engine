"""
Context Classifier — maps a SignalFeatures vector to a discrete cognitive context.

Contexts:
  DEEP_FOCUS    — low switching, sustained output, moderate load
  SHALLOW_WORK  — moderate activity, low output quality indicators
  STUCK         — high error rate, repetitive switching, low progress
  FATIGUE       — high load sustained over long session, increasing idle fraction
  RECOVERING    — transitioning from high load back toward baseline
"""

from __future__ import annotations

from enum import Enum

from .signal_processor import SignalFeatures


class CognitiveContext(str, Enum):
    DEEP_FOCUS = "deep_focus"
    SHALLOW_WORK = "shallow_work"
    STUCK = "stuck"
    FATIGUE = "fatigue"
    RECOVERING = "recovering"
    UNKNOWN = "unknown"


class ContextClassifier:
    """
    Rule-based classifier (v1).
    Replace `classify` with a trained model call when labeled data is available.
    """

    def classify(self, features: SignalFeatures, load_score: float) -> CognitiveContext:
        # --- STUCK ---
        if features.compile_error_rate > 2.0 and features.tab_switch_rate > 5.0:
            return CognitiveContext.STUCK
        if features.task_switch_entropy > 0.8 and load_score > 0.7:
            return CognitiveContext.STUCK

        # --- FATIGUE ---
        if load_score > 0.85 and features.session_duration_min > 90:
            return CognitiveContext.FATIGUE
        if features.idle_fraction > 0.4 and features.session_duration_min > 60:
            return CognitiveContext.FATIGUE

        # --- DEEP FOCUS ---
        if (
            features.tab_switch_rate < 1.5
            and features.window_change_rate < 2.0
            and features.task_switch_entropy < 0.3
            and 0.3 < load_score < 0.75
        ):
            return CognitiveContext.DEEP_FOCUS

        # --- RECOVERING ---
        if features.idle_fraction > 0.2 and load_score < 0.4:
            return CognitiveContext.RECOVERING

        # --- SHALLOW WORK ---
        if features.tab_switch_rate > 3.0 or features.task_switch_entropy > 0.5:
            return CognitiveContext.SHALLOW_WORK

        return CognitiveContext.UNKNOWN
