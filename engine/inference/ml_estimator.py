"""
ML Load Estimator — v2 estimator using a trained sklearn GradientBoosting regressor.

Training pipeline:
  1. Run the simulator to generate labeled sessions (scripts/train_estimator.py)
  2. Labels are synthesized from the v1 estimator (bootstrap) + context override rules
  3. Model is serialised to data/load_estimator.joblib
  4. At runtime, MLLoadEstimator checks for the saved model and falls back to v1

Drop-in replacement for LoadEstimator:

    from engine.inference.ml_estimator import MLLoadEstimator
    estimator = MLLoadEstimator()          # auto-loads saved model if available
    result = estimator.estimate(features)  # same LoadEstimate return type
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

from .load_estimator import LoadEstimate, LoadEstimator
from .signal_processor import SignalFeatures

_MODEL_PATH = Path(__file__).parent.parent.parent / "data" / "load_estimator.joblib"

# Feature column order — must match training
FEATURE_COLS = [
    "tab_switch_rate",
    "compile_error_rate",
    "window_change_rate",
    "typing_burst_score",
    "idle_fraction",
    "scroll_velocity_norm",
    "session_duration_min",
    "task_switch_entropy",
]

# Normalisation caps (same as v1 weights)
_CAPS = {
    "tab_switch_rate": 10.0,
    "compile_error_rate": 5.0,
    "window_change_rate": 15.0,
    "session_duration_min": 120.0,
}


def _normalise(features: SignalFeatures) -> np.ndarray:
    row = []
    for col in FEATURE_COLS:
        v = getattr(features, col, 0.0)
        if col in _CAPS:
            v = min(v / _CAPS[col], 1.0)
        row.append(float(v))
    return np.array(row, dtype=np.float32).reshape(1, -1)


class MLLoadEstimator:
    """
    Wraps a trained sklearn model when available; transparently falls back to
    the rule-based v1 estimator when no saved model is found.
    """

    def __init__(self, model_path: Optional[Path] = None):
        self._model_path = model_path or _MODEL_PATH
        self._model = None
        self._v1 = LoadEstimator()
        self._history_size = 5
        self._history: list[float] = []
        self._load_model()

    # ------------------------------------------------------------------
    # Public API  (identical to LoadEstimator)
    # ------------------------------------------------------------------

    def estimate(self, features: SignalFeatures) -> LoadEstimate:
        if self._model is not None:
            return self._predict_ml(features)
        return self._v1.estimate(features)

    @property
    def using_ml_model(self) -> bool:
        return self._model is not None

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _load_model(self) -> None:
        if not self._model_path.exists():
            return
        try:
            import joblib
            self._model = joblib.load(self._model_path)
        except Exception as e:
            print(f"[MLLoadEstimator] Could not load model: {e} — using v1 fallback")
            self._model = None

    def _predict_ml(self, features: SignalFeatures) -> LoadEstimate:
        X = _normalise(features)
        raw_score = float(self._model.predict(X)[0])
        raw_score = max(0.0, min(raw_score, 1.0))

        # EMA smoothing (same as v1)
        if self._history:
            alpha = 0.3
            raw_score = alpha * raw_score + (1 - alpha) * self._history[-1]
        self._history.append(raw_score)
        if len(self._history) > self._history_size:
            self._history.pop(0)

        # Run v1 for breakdown components (ML predicts total only)
        v1_est = LoadEstimate(
            score=round(raw_score, 4),
            intrinsic=0.0,
            extraneous=0.0,
            germane=0.0,
            confidence=min(len(self._history) / self._history_size, 1.0),
        )

        # Derive approximate breakdown from feature groups
        tab_norm = min(features.tab_switch_rate / 10.0, 1.0)
        err_norm = min(features.compile_error_rate / 5.0, 1.0)
        v1_est.extraneous = round(0.6 * tab_norm + 0.4 * features.task_switch_entropy, 4)
        v1_est.intrinsic = round(0.6 * err_norm + 0.4 * features.typing_burst_score, 4)
        v1_est.germane = round(
            max(0.0, min(features.session_duration_min / 120.0 - features.idle_fraction, 1.0)), 4
        )
        return v1_est
