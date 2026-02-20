"""
Signal Processor — normalizes and aggregates raw telemetry events
into feature vectors suitable for the load estimator.
"""

from __future__ import annotations

import math
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List


@dataclass
class TelemetryEvent:
    source: str          # "browser" | "ide" | "desktop"
    event_type: str      # e.g. "tab_switch", "compile_error", "window_change"
    timestamp: float = field(default_factory=time.time)
    metadata: Dict = field(default_factory=dict)


@dataclass
class SignalFeatures:
    """Normalized feature vector for the inference window."""
    tab_switch_rate: float = 0.0          # switches / min
    compile_error_rate: float = 0.0       # errors / min
    window_change_rate: float = 0.0       # changes / min
    typing_burst_score: float = 0.0       # 0-1, variance in typing cadence
    idle_fraction: float = 0.0            # fraction of window spent idle
    scroll_velocity_norm: float = 0.0     # normalized scroll speed
    session_duration_min: float = 0.0
    task_switch_entropy: float = 0.0      # Shannon entropy of app usage distribution
    timestamp: float = field(default_factory=time.time)


class SignalProcessor:
    """
    Maintains a sliding window of telemetry events and derives
    normalized feature vectors on demand.
    """

    def __init__(self, window_seconds: int = 300):
        self.window_seconds = window_seconds
        self._events: Deque[TelemetryEvent] = deque()
        self._session_start: float = time.time()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def push(self, event: TelemetryEvent) -> None:
        self._events.append(event)
        self._evict_stale()

    def extract_features(self) -> SignalFeatures:
        self._evict_stale()
        events = list(self._events)
        window_min = self.window_seconds / 60.0
        elapsed_min = max((time.time() - self._session_start) / 60.0, 0.0)
        # Use observed session span up to the configured window; floor to 1 minute.
        rate_window_min = max(min(window_min, elapsed_min), 1.0)

        return SignalFeatures(
            tab_switch_rate=self._rate(events, "tab_switch") / rate_window_min,
            compile_error_rate=self._rate(events, "compile_error") / rate_window_min,
            window_change_rate=self._rate(events, "window_change") / rate_window_min,
            typing_burst_score=self._typing_burst(events),
            idle_fraction=self._idle_fraction(events),
            scroll_velocity_norm=self._scroll_velocity(events),
            session_duration_min=(time.time() - self._session_start) / 60.0,
            task_switch_entropy=self._app_entropy(events),
        )

    def reset_session(self) -> None:
        self._session_start = time.time()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _evict_stale(self) -> None:
        cutoff = time.time() - self.window_seconds
        while self._events and self._events[0].timestamp < cutoff:
            self._events.popleft()

    @staticmethod
    def _rate(events: List[TelemetryEvent], event_type: str) -> float:
        return sum(1 for e in events if e.event_type == event_type)

    @staticmethod
    def _typing_burst(events: List[TelemetryEvent]) -> float:
        intervals = [
            e.metadata.get("interval_ms", 0)
            for e in events
            if e.event_type == "keystroke" and "interval_ms" in e.metadata
        ]
        if len(intervals) < 2:
            return 0.0
        mean = sum(intervals) / len(intervals)
        if mean == 0:
            return 0.0
        variance = sum((x - mean) ** 2 for x in intervals) / len(intervals)
        # coefficient of variation, capped at 1
        return min(math.sqrt(variance) / mean, 1.0)

    @staticmethod
    def _idle_fraction(events: List[TelemetryEvent]) -> float:
        idle_events = [e for e in events if e.event_type == "idle_start"]
        active_events = [e for e in events if e.event_type == "idle_end"]
        if not idle_events:
            return 0.0
        # simple approximation: count idle periods over total window
        return min(len(idle_events) / max(len(events), 1), 1.0)

    @staticmethod
    def _scroll_velocity(events: List[TelemetryEvent]) -> float:
        velocities = [
            abs(e.metadata.get("delta_y", 0))
            for e in events
            if e.event_type == "scroll" and "delta_y" in e.metadata
        ]
        if not velocities:
            return 0.0
        avg = sum(velocities) / len(velocities)
        # normalize: assume 3000 px/s is max observed
        return min(avg / 3000.0, 1.0)

    @staticmethod
    def _app_entropy(events: List[TelemetryEvent]) -> float:
        apps: Dict[str, int] = {}
        for e in events:
            if e.event_type == "window_change":
                app = e.metadata.get("app", "unknown")
                apps[app] = apps.get(app, 0) + 1
        total = sum(apps.values())
        if total == 0:
            return 0.0
        entropy = -sum((c / total) * math.log2(c / total) for c in apps.values())
        # normalize by log2(n_apps) to get 0-1
        max_entropy = math.log2(max(len(apps), 2))
        return entropy / max_entropy
