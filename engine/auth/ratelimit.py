"""
Tiny in-memory sliding-window rate limiter for the auth endpoints.

In-memory is enough for a single engine process (local or one Railway
instance). If the API is ever scaled horizontally, move this to Redis.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from typing import Deque, Dict, Optional

from fastapi import HTTPException, Request, status

from ..config import config

_MAX_KEYS = 10_000


class RateLimiter:
    def __init__(self, limit: int, window_s: float):
        self.limit = limit
        self.window_s = window_s
        self._hits: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str) -> Optional[float]:
        """
        Record an attempt. Returns None if allowed, or the number of seconds
        until the next attempt would be allowed.
        """
        now = time.time()
        cutoff = now - self.window_s
        with self._lock:
            if len(self._hits) > _MAX_KEYS:
                self._prune(cutoff)
            q = self._hits.setdefault(key, deque())
            while q and q[0] < cutoff:
                q.popleft()
            if len(q) >= self.limit:
                return max(q[0] + self.window_s - now, 1.0)
            q.append(now)
            return None

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def _prune(self, cutoff: float) -> None:
        for k in [k for k, q in self._hits.items() if not q or q[-1] < cutoff]:
            del self._hits[k]


def default_limiters() -> Dict[str, RateLimiter]:
    return {
        "login_email": RateLimiter(10, 15 * 60),
        "login_ip": RateLimiter(50, 15 * 60),
        "register_ip": RateLimiter(20, 60 * 60),
        "forgot_email": RateLimiter(5, 60 * 60),
        "forgot_ip": RateLimiter(20, 60 * 60),
        "claim_ip": RateLimiter(20, 15 * 60),
    }


def client_ip(request: Request) -> str:
    """
    Client address. Behind Railway's proxy the real client is the right-most
    X-Forwarded-For entry (the one the proxy appended; earlier entries are
    client-supplied and spoofable). Locally, use the socket address.
    """
    if config.is_production:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def enforce(request: Request, bucket: str, key: str) -> None:
    """Raise 429 if ``key`` has exceeded the limit for ``bucket``."""
    limiter: RateLimiter = request.app.state.rate_limiters[bucket]
    retry_after = limiter.hit(key)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please wait and try again.",
            headers={"Retry-After": str(int(retry_after))},
        )
