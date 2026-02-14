"""Simple in-memory rate limiter for FastAPI endpoints.

Uses a sliding-window counter per client IP. No external dependencies.
"""

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status


class RateLimiter:
    """Sliding-window rate limiter keyed by client IP."""

    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    def _client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _prune(self, key: str, now: float) -> None:
        cutoff = now - self.window_seconds
        timestamps = self._hits[key]
        # Remove expired entries from the front
        while timestamps and timestamps[0] < cutoff:
            timestamps.pop(0)
        if not timestamps:
            del self._hits[key]

    async def __call__(self, request: Request) -> None:
        now = time.monotonic()
        key = self._client_ip(request)
        self._prune(key, now)

        if len(self._hits[key]) >= self.max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Try again later.",
            )

        self._hits[key].append(now)


# Pre-configured limiter: 10 requests per minute for device registration
device_register_limiter = RateLimiter(max_requests=10, window_seconds=60)
