"""
Telemetry Aggregator — receives events from all sources, pushes them to
the SignalProcessor, and writes enriched entries to the CognitiveTimeline.
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Callable, Optional

from ..config import config
from ..inference.context_classifier import CognitiveContext, ContextClassifier
from ..inference.load_estimator import LoadEstimate
from ..inference.ml_estimator import MLLoadEstimator
from ..inference.signal_processor import SignalFeatures, SignalProcessor, TelemetryEvent
from .timeline import CognitiveTimeline, TimelineEntry


class TelemetryAggregator:
    """
    Central bus for all incoming telemetry.

    Usage:
        agg = TelemetryAggregator(timeline)
        agg.push_event(TelemetryEvent(source="browser", event_type="tab_switch"))
        state = agg.current_state()
    """

    def __init__(self, timeline: CognitiveTimeline):
        self._timeline = timeline
        self._processor = SignalProcessor(window_seconds=config.load_history_window_s)
        self._estimator = MLLoadEstimator()   # auto-falls back to v1 if no model file
        self._classifier = ContextClassifier()
        self._latest_estimate: Optional[LoadEstimate] = None
        self._latest_context: CognitiveContext = CognitiveContext.UNKNOWN
        self._listeners: list[Callable] = []

    # ------------------------------------------------------------------
    # Event ingestion
    # ------------------------------------------------------------------

    def push_event(self, event: TelemetryEvent) -> None:
        self._processor.push(event)

    async def push_event_async(self, event: TelemetryEvent) -> None:
        """Non-blocking ingestion from async contexts (WebSocket handlers)."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self.push_event, event)

    # ------------------------------------------------------------------
    # Inference tick (called by the main loop)
    # ------------------------------------------------------------------

    def tick(self) -> LoadEstimate:
        features: SignalFeatures = self._processor.extract_features()
        estimate: LoadEstimate = self._estimator.estimate(features)
        context: CognitiveContext = self._classifier.classify(features, estimate.score)

        self._latest_estimate = estimate
        self._latest_context = context

        # Persist to timeline
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
            )
        )

        # Notify registered listeners (e.g. the routing engine)
        for listener in self._listeners:
            try:
                listener(estimate, context)
            except Exception:
                pass

        return estimate

    # ------------------------------------------------------------------
    # State access
    # ------------------------------------------------------------------

    def current_state(self) -> dict:
        return {
            "load_score": self._latest_estimate.score if self._latest_estimate else 0.0,
            "context": self._latest_context.value,
            "confidence": self._latest_estimate.confidence if self._latest_estimate else 0.0,
            "timestamp": time.time(),
            "estimator": "ml" if self._estimator.using_ml_model else "v1",
        }

    def register_listener(self, fn: Callable) -> None:
        """Register a callback(estimate, context) called on every tick."""
        self._listeners.append(fn)
