"""
Signal Processor — normalizes and aggregates raw telemetry events
into feature vectors suitable for the load estimator.
"""

from __future__ import annotations

import bisect
import math
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class TelemetryEvent:
    source: str          # "browser" | "ide" | "desktop" | "lms"
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
    idle_fraction: float = 0.0            # fraction of window time spent idle
    scroll_velocity_norm: float = 0.0     # normalized scroll speed
    session_duration_min: float = 0.0
    task_switch_entropy: float = 0.0      # Shannon entropy of app usage distribution
    timestamp: float = field(default_factory=time.time)


# Scroll speeds at or above this many px/s count as "maximum" scroll velocity.
_MAX_SCROLL_PX_S = 3000.0


class SignalProcessor:
    """
    Maintains a sliding window of telemetry events and derives
    normalized feature vectors on demand.

    ``idle_gap_s``     — a silence longer than this (no events from any
                         source) counts as idle time.
    ``session_gap_s``  — a silence longer than this starts a new session, so
                         ``session_duration_min`` measures the current sitting
                         rather than the time since the engine started.
    """

    def __init__(
        self,
        window_seconds: int = 300,
        idle_gap_s: float = 60.0,
        session_gap_s: float = 600.0,
    ):
        self.window_seconds = window_seconds
        self.idle_gap_s = idle_gap_s
        self.session_gap_s = session_gap_s
        # Kept sorted by timestamp: plugins flush batches independently, so
        # events from different sources can arrive out of order.
        self._events: List[TelemetryEvent] = []
        self._session_start: float = time.time()
        self._last_event_ts: Optional[float] = None
        self._source_last_seen: Dict[str, float] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def push(self, event: TelemetryEvent) -> None:
        now = time.time()
        # Never trust client clocks to be in the future; a future timestamp
        # would otherwise sit in the window forever.
        if event.timestamp > now:
            event.timestamp = now

        if self._last_event_ts is None or event.timestamp - self._last_event_ts > self.session_gap_s:
            self._session_start = event.timestamp
        elif event.timestamp < self._session_start:
            # A late-arriving event from earlier in the same sitting.
            self._session_start = event.timestamp
        if self._last_event_ts is None or event.timestamp > self._last_event_ts:
            self._last_event_ts = event.timestamp
        prev = self._source_last_seen.get(event.source, 0.0)
        self._source_last_seen[event.source] = max(prev, event.timestamp)

        bisect.insort(self._events, event, key=lambda e: e.timestamp)
        self._evict_stale()

    def has_recent_activity(self) -> bool:
        """True if any event is inside the current window."""
        self._evict_stale()
        return bool(self._events)

    def source_last_seen(self) -> Dict[str, float]:
        return dict(self._source_last_seen)

    def extract_features(self) -> SignalFeatures:
        self._evict_stale()
        events = list(self._events)
        if not events:
            # Nothing observed in the window: report "no data", not "idle".
            return SignalFeatures()

        now = time.time()
        window_min = self.window_seconds / 60.0
        elapsed_min = max((now - self._session_start) / 60.0, 0.0)
        # Use observed session span up to the configured window; floor to 1 minute.
        rate_window_min = max(min(window_min, elapsed_min), 1.0)

        return SignalFeatures(
            tab_switch_rate=self._count(events, "tab_switch") / rate_window_min,
            compile_error_rate=self._count(events, "compile_error") / rate_window_min,
            window_change_rate=self._count(events, "window_change") / rate_window_min,
            typing_burst_score=self._typing_burst(events),
            idle_fraction=self._idle_fraction(events, now),
            scroll_velocity_norm=self._scroll_velocity(events),
            session_duration_min=elapsed_min,
            task_switch_entropy=self._app_entropy(events),
        )

    def reset_session(self) -> None:
        self._session_start = time.time()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _evict_stale(self) -> None:
        cutoff = time.time() - self.window_seconds
        idx = bisect.bisect_left(self._events, cutoff, key=lambda e: e.timestamp)
        if idx:
            del self._events[:idx]

    @staticmethod
    def _count(events: List[TelemetryEvent], event_type: str) -> float:
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

    def _idle_fraction(self, events: List[TelemetryEvent], now: float) -> float:
        """
        Fraction of the observed window (since the window start or the session
        start, whichever is later) spent idle. Time counts as idle when either
        a source reported ``idle_start`` and nothing has happened since, or
        when no source sent anything for longer than ``idle_gap_s``.
        """
        window_start = max(now - self.window_seconds, self._session_start)
        span = now - window_start
        if span <= 0:
            return 0.0

        idle = 0.0
        cursor = window_start
        flagged_idle = False
        for e in events:
            ts = max(e.timestamp, cursor)
            gap = ts - cursor
            if flagged_idle or gap > self.idle_gap_s:
                idle += gap
            flagged_idle = e.event_type == "idle_start"
            cursor = ts
        tail = now - cursor
        if flagged_idle or tail > self.idle_gap_s:
            idle += tail
        return min(idle / span, 1.0)

    @staticmethod
    def _scroll_velocity(events: List[TelemetryEvent]) -> float:
        """
        Average scroll speed, normalised to 0-1. Plugins send ``velocity``
        (px/s); older payloads only carry ``delta_y`` (px moved in a burst),
        which is treated as roughly one second of scrolling.
        """
        speeds = []
        for e in events:
            if e.event_type != "scroll":
                continue
            if "velocity" in e.metadata:
                speeds.append(abs(float(e.metadata["velocity"] or 0)))
            elif "delta_y" in e.metadata:
                speeds.append(abs(float(e.metadata["delta_y"] or 0)))
        if not speeds:
            return 0.0
        avg = sum(speeds) / len(speeds)
        return min(avg / _MAX_SCROLL_PX_S, 1.0)

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
