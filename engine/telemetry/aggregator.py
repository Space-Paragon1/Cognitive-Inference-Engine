"""
Telemetry Aggregator — receives one user's events from all sources, pushes
them to the SignalProcessor, and writes enriched entries to the
CognitiveTimeline.
"""

from __future__ import annotations

import asyncio
import json
import threading
import time
from typing import Callable, Optional

from ..config import config
from ..inference.context_classifier import CognitiveContext, ContextClassifier
from ..inference.load_estimator import LoadEstimate
from ..inference.ml_estimator import MLLoadEstimator
from ..inference.signal_processor import SignalFeatures, SignalProcessor, TelemetryEvent
from ..settings import SettingsProvider, defaults_provider
from .timeline import CognitiveTimeline, TimelineEntry

# Confidence also depends on how much was observed: fewer than this many
# events in the window scales confidence down proportionally.
_EVENTS_FOR_FULL_CONFIDENCE = 20

_NO_DATA = LoadEstimate(score=0.0, intrinsic=0.0, extraneous=0.0, germane=0.0, confidence=0.0)


class TelemetryAggregator:
    """
    Central bus for one user's telemetry.

    Usage:
        agg = TelemetryAggregator(timeline, user_id=42)
        agg.push_event(TelemetryEvent(source="browser", event_type="tab_switch"))
        agg.tick()
        state = agg.current_state()
    """

    def __init__(
        self,
        timeline: CognitiveTimeline,
        user_id: Optional[int] = None,
        settings: Optional[SettingsProvider] = None,
    ):
        self._timeline = timeline
        self._user_id = user_id
        self._settings = settings or defaults_provider
        self._processor = SignalProcessor(window_seconds=config.load_history_window_s)
        self._estimator = MLLoadEstimator()   # auto-falls back to v1 if no usable model
        self._classifier = ContextClassifier()
        self._latest_estimate: Optional[LoadEstimate] = None
        self._latest_context: CognitiveContext = CognitiveContext.UNKNOWN
        self._active = False
        self._listeners: list[Callable] = []
        self._lock = threading.Lock()

    @property
    def using_ml_model(self) -> bool:
        return self._estimator.using_ml_model

    # ------------------------------------------------------------------
    # Event ingestion
    # ------------------------------------------------------------------

    def push_event(self, event: TelemetryEvent) -> None:
        with self._lock:
            self._processor.push(event)

    async def push_event_async(self, event: TelemetryEvent) -> None:
        """Non-blocking ingestion from async contexts."""
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self.push_event, event)

    # ------------------------------------------------------------------
    # Inference tick (called by the main loop)
    # ------------------------------------------------------------------

    def tick(self) -> LoadEstimate:
        with self._lock:
            self._processor.session_gap_s = (
                float(self._settings()["session_gap_minutes"]) * 60.0
            )
            active = self._processor.has_recent_activity()
            n_events = len(self._processor._events)
            features: SignalFeatures = self._processor.extract_features()

        if active:
            estimate = self._estimator.estimate(features)
            estimate.confidence = round(
                estimate.confidence * min(n_events / _EVENTS_FOR_FULL_CONFIDENCE, 1.0), 4
            )
            context = self._classifier.classify(features, estimate.score)
        else:
            # Nothing observed for a whole window: report "no data" rather than
            # running the estimator on zeros (which would also skew its smoothing).
            estimate = _NO_DATA
            context = CognitiveContext.UNKNOWN

        self._latest_estimate = estimate
        self._latest_context = context
        self._active = active

        # Only persist ticks while the user is actually being observed, so an
        # idle account does not write a row every couple of seconds forever.
        if active:
            self._timeline.append(
                TimelineEntry(
                    id=None,
                    timestamp=time.time(),
                    source="engine",
                    event_type="inference_tick",
                    load_score=estimate.score,
                    context=context.value,
                    metadata_json=json.dumps(
                        {
                            "intrinsic": estimate.intrinsic,
                            "extraneous": estimate.extraneous,
                            "germane": estimate.germane,
                            "confidence": estimate.confidence,
                        }
                    ),
                    user_id=self._user_id,
                )
            )

        # Notify registered listeners (task queue, focus, Pomodoro)
        for listener in self._listeners:
            try:
                listener(estimate, context)
            except Exception:
                pass

        return estimate

    # ------------------------------------------------------------------
    # State access
    # ------------------------------------------------------------------

    @property
    def latest_estimate(self) -> Optional[LoadEstimate]:
        return self._latest_estimate

    @property
    def latest_context(self) -> CognitiveContext:
        return self._latest_context

    def current_state(self) -> dict:
        est = self._latest_estimate
        with self._lock:
            sources = self._processor.source_last_seen()
        return {
            "load_score": est.score if est else 0.0,
            "context": self._latest_context.value,
            "confidence": est.confidence if est else 0.0,
            "breakdown": {
                "intrinsic": est.intrinsic if est else 0.0,
                "extraneous": est.extraneous if est else 0.0,
                "germane": est.germane if est else 0.0,
            },
            "timestamp": time.time(),
            "estimator": "ml" if self._estimator.using_ml_model else "v1",
            "active": self._active,
            "sources": sources,
        }

    def register_listener(self, fn: Callable) -> None:
        """Register a callback(estimate, context) called on every tick."""
        self._listeners.append(fn)
