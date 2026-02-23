"""
Train the v2 ML Load Estimator.

Generates a synthetic labeled dataset by running all simulator scenarios
against the v1 rule-based estimator, then trains a GradientBoostingRegressor
and saves it to data/load_estimator.joblib.

Usage:
    python scripts/train_estimator.py
    python scripts/train_estimator.py --samples 5000 --output data/load_estimator.joblib
"""

from __future__ import annotations

import argparse
import random
import sys
import time
from pathlib import Path

# Make sure the package root is on the path when run as a script
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np

from engine.inference.context_classifier import ContextClassifier
from engine.inference.load_estimator import LoadEstimator
from engine.inference.ml_estimator import FEATURE_COLS, _normalise
from engine.inference.signal_processor import SignalFeatures, SignalProcessor, TelemetryEvent


# ---------------------------------------------------------------------------
# Synthetic data generation
# ---------------------------------------------------------------------------

def _make_features(scenario: str, step: int, total: int) -> SignalFeatures:
    """Generate a plausible SignalFeatures for each scenario."""
    rng = random.Random(step)
    progress = step / max(total - 1, 1)

    if scenario == "deep_focus":
        return SignalFeatures(
            tab_switch_rate=rng.uniform(0.2, 1.5),
            compile_error_rate=rng.uniform(0.0, 0.3),
            window_change_rate=rng.uniform(0.1, 1.0),
            typing_burst_score=rng.uniform(0.1, 0.4),
            idle_fraction=rng.uniform(0.0, 0.1),
            scroll_velocity_norm=rng.uniform(0.0, 0.3),
            session_duration_min=rng.uniform(10, 60) * progress,
            task_switch_entropy=rng.uniform(0.0, 0.2),
        )
    elif scenario == "stuck":
        return SignalFeatures(
            tab_switch_rate=rng.uniform(4.0, 10.0),
            compile_error_rate=rng.uniform(2.0, 5.0),
            window_change_rate=rng.uniform(4.0, 12.0),
            typing_burst_score=rng.uniform(0.5, 1.0),
            idle_fraction=rng.uniform(0.0, 0.2),
            scroll_velocity_norm=rng.uniform(0.3, 0.9),
            session_duration_min=rng.uniform(15, 45),
            task_switch_entropy=rng.uniform(0.6, 1.0),
        )
    elif scenario == "fatigue":
        return SignalFeatures(
            tab_switch_rate=rng.uniform(0.5, 3.0),
            compile_error_rate=rng.uniform(0.0, 1.0),
            window_change_rate=rng.uniform(1.0, 4.0),
            typing_burst_score=rng.uniform(0.1, 0.5),
            idle_fraction=rng.uniform(0.2, 0.6) * (0.5 + 0.5 * progress),
            scroll_velocity_norm=rng.uniform(0.0, 0.3),
            session_duration_min=rng.uniform(80, 120),
            task_switch_entropy=rng.uniform(0.3, 0.7),
        )
    elif scenario == "shallow_work":
        return SignalFeatures(
            tab_switch_rate=rng.uniform(2.0, 7.0),
            compile_error_rate=rng.uniform(0.0, 0.5),
            window_change_rate=rng.uniform(3.0, 8.0),
            typing_burst_score=rng.uniform(0.0, 0.3),
            idle_fraction=rng.uniform(0.1, 0.3),
            scroll_velocity_norm=rng.uniform(0.2, 0.6),
            session_duration_min=rng.uniform(5, 40),
            task_switch_entropy=rng.uniform(0.5, 0.9),
        )
    elif scenario == "recovery":
        return SignalFeatures(
            tab_switch_rate=rng.uniform(0.0, 1.0),
            compile_error_rate=0.0,
            window_change_rate=rng.uniform(0.0, 0.5),
            typing_burst_score=rng.uniform(0.0, 0.2),
            idle_fraction=rng.uniform(0.3, 0.8),
            scroll_velocity_norm=rng.uniform(0.0, 0.2),
            session_duration_min=rng.uniform(5, 20),
            task_switch_entropy=rng.uniform(0.0, 0.3),
        )
    else:  # random baseline
        return SignalFeatures(
            tab_switch_rate=rng.uniform(0.0, 10.0),
            compile_error_rate=rng.uniform(0.0, 5.0),
            window_change_rate=rng.uniform(0.0, 15.0),
            typing_burst_score=rng.uniform(0.0, 1.0),
            idle_fraction=rng.uniform(0.0, 1.0),
            scroll_velocity_norm=rng.uniform(0.0, 1.0),
            session_duration_min=rng.uniform(0.0, 120.0),
            task_switch_entropy=rng.uniform(0.0, 1.0),
        )


SCENARIOS = ["deep_focus", "stuck", "fatigue", "shallow_work", "recovery", "random"]


def generate_dataset(n_samples: int) -> tuple[np.ndarray, np.ndarray]:
    """
    Returns X (n_samples × n_features) and y (n_samples,) using the
    v1 rule-based estimator as the label oracle.
    """
    estimator = LoadEstimator(history_size=1)  # no smoothing across samples
    per_scenario = n_samples // len(SCENARIOS)

    X_rows, y_rows = [], []

    for scenario in SCENARIOS:
        count = per_scenario
        for i in range(count):
            feat = _make_features(scenario, i, count)
            label_est = LoadEstimator(history_size=1)
            label = label_est.estimate(feat).score
            X_rows.append(_normalise(feat).flatten())
            y_rows.append(label)

    X = np.array(X_rows, dtype=np.float32)
    y = np.array(y_rows, dtype=np.float32)
    return X, y


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train(n_samples: int, output_path: Path) -> None:
    try:
        from sklearn.ensemble import GradientBoostingRegressor
        from sklearn.model_selection import cross_val_score, train_test_split
        from sklearn.preprocessing import StandardScaler
        from sklearn.pipeline import Pipeline
        import joblib
    except ImportError:
        print("scikit-learn and joblib are required for training.")
        print("Install: pip install scikit-learn joblib")
        sys.exit(1)

    print(f"Generating {n_samples} synthetic samples across {len(SCENARIOS)} scenarios…")
    X, y = generate_dataset(n_samples)
    print(f"Dataset shape: X={X.shape}, y={y.shape}  |  y range: [{y.min():.3f}, {y.max():.3f}]")

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("gbr", GradientBoostingRegressor(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            random_state=42,
        )),
    ])

    print("Training GradientBoostingRegressor…")
    t0 = time.time()
    model.fit(X_train, y_train)
    elapsed = time.time() - t0

    train_r2 = model.score(X_train, y_train)
    test_r2 = model.score(X_test, y_test)
    y_pred = model.predict(X_test)
    mae = float(np.mean(np.abs(y_pred - y_test)))

    print(f"\nResults ({elapsed:.1f}s):")
    print(f"  Train R²: {train_r2:.4f}")
    print(f"  Test  R²: {test_r2:.4f}")
    print(f"  Test MAE: {mae:.4f}")

    # Feature importances
    gbr = model.named_steps["gbr"]
    importances = sorted(
        zip(FEATURE_COLS, gbr.feature_importances_),
        key=lambda x: -x[1],
    )
    print("\nFeature importances:")
    for name, imp in importances:
        bar = "█" * int(imp * 40)
        print(f"  {name:<25} {bar}  {imp:.3f}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, output_path)
    print(f"\nModel saved → {output_path}")
    print("The MLLoadEstimator will auto-load it on next engine start.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Train CLR v2 load estimator")
    parser.add_argument("--samples", type=int, default=3000, help="Training samples (default 3000)")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/load_estimator.joblib"),
        help="Output path for saved model",
    )
    args = parser.parse_args()
    train(args.samples, args.output)


if __name__ == "__main__":
    main()
