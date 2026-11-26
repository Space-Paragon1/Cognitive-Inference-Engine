"""
Focus Mode — coordinates notification suppression and tab-blocking signals.
The actual tab blocking is enforced by the browser extension;
this module sends the signal via the shared state the extension polls.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Optional

from .notifications import NotificationController


@dataclass
class FocusState:
    active: bool = False
    started_at: Optional[float] = None
    duration_minutes: int = 25
    block_tabs: bool = True
    reason: str = ""

    def elapsed_minutes(self) -> float:
        if not self.started_at:
            return 0.0
        return (time.time() - self.started_at) / 60.0

    def is_expired(self) -> bool:
        return self.active and self.elapsed_minutes() >= self.duration_minutes


class FocusModeController:
    """
    One user's focus mode. ``control_os_notifications`` toggles Do Not Disturb
    on the machine the engine runs on, which only makes sense when the engine
    runs locally on the student's own computer (never on a hosted server).
    """

    def __init__(self, control_os_notifications: bool = True):
        self._notif = NotificationController() if control_os_notifications else None
        self.state = FocusState()

    @property
    def is_busy(self) -> bool:
        return self.state.active

    def activate(
        self, duration_minutes: int = 25, reason: str = "", block_tabs: bool = True
    ) -> FocusState:
        self.state = FocusState(
            active=True,
            started_at=time.time(),
            duration_minutes=duration_minutes,
            block_tabs=block_tabs,
            reason=reason,
        )
        if self._notif:
            self._notif.suppress()
        return self.state

    def deactivate(self) -> FocusState:
        self.state.active = False
        if self._notif:
            self._notif.allow()
        return self.state

    def tick(self) -> FocusState:
        """Call periodically; auto-deactivates expired sessions."""
        if self.state.is_expired():
            self.deactivate()
        return self.state
