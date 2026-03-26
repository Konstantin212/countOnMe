"""Unit tests for app.api.rate_limit — in-memory rate limiter."""
from __future__ import annotations

import time
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.core.rate_limit import RateLimiter, UserBasedRateLimiter


def _make_request(ip: str = "127.0.0.1") -> MagicMock:
    """Create a mock Request object with a given client IP."""
    request = MagicMock()
    request.client = MagicMock()
    request.client.host = ip
    request.headers = {}
    return request


class TestRateLimiter:
    """Tests for the RateLimiter class."""

    @pytest.mark.asyncio
    async def test_allows_requests_under_limit(self) -> None:
        limiter = RateLimiter(max_requests=3, window_seconds=60)
        request = _make_request()

        # Should allow 3 requests
        for _ in range(3):
            await limiter(request)

    @pytest.mark.asyncio
    async def test_blocks_requests_over_limit(self) -> None:
        limiter = RateLimiter(max_requests=2, window_seconds=60)
        request = _make_request()

        await limiter(request)
        await limiter(request)

        with pytest.raises(HTTPException) as exc_info:
            await limiter(request)

        assert exc_info.value.status_code == 429

    @pytest.mark.asyncio
    async def test_different_ips_tracked_independently(self) -> None:
        limiter = RateLimiter(max_requests=1, window_seconds=60)

        req_a = _make_request("10.0.0.1")
        req_b = _make_request("10.0.0.2")

        await limiter(req_a)
        await limiter(req_b)  # Should pass — different IP

        with pytest.raises(HTTPException):
            await limiter(req_a)  # Should block — same IP

    @pytest.mark.asyncio
    async def test_uses_x_forwarded_for_header(self) -> None:
        limiter = RateLimiter(max_requests=1, window_seconds=60)

        request = _make_request("10.0.0.1")
        request.headers = {"x-forwarded-for": "203.0.113.5, 10.0.0.1"}

        await limiter(request)

        with pytest.raises(HTTPException):
            await limiter(request)

    @pytest.mark.asyncio
    async def test_window_expiry_allows_new_requests(self) -> None:
        limiter = RateLimiter(max_requests=1, window_seconds=1)
        request = _make_request()

        await limiter(request)

        # Wait for window to expire
        time.sleep(1.1)

        # Should be allowed again
        await limiter(request)

    @pytest.mark.asyncio
    async def test_handles_missing_client(self) -> None:
        limiter = RateLimiter(max_requests=5, window_seconds=60)
        request = MagicMock()
        request.client = None
        request.headers = {}

        await limiter(request)  # Should not raise


class TestUserBasedRateLimiter:
    """Tests for the UserBasedRateLimiter class."""

    def test_allows_requests_under_limit(self) -> None:
        limiter = UserBasedRateLimiter(max_requests=3, window_seconds=60)

        for _ in range(3):
            limiter.check("user-1")

    def test_blocks_requests_over_limit(self) -> None:
        limiter = UserBasedRateLimiter(max_requests=2, window_seconds=60)

        limiter.check("user-1")
        limiter.check("user-1")

        with pytest.raises(HTTPException) as exc_info:
            limiter.check("user-1")

        assert exc_info.value.status_code == 429

    def test_different_users_tracked_independently(self) -> None:
        limiter = UserBasedRateLimiter(max_requests=1, window_seconds=60)

        limiter.check("user-a")
        limiter.check("user-b")  # Should pass -- different user

        with pytest.raises(HTTPException):
            limiter.check("user-a")  # Should block -- same user

    def test_window_expiry_allows_new_requests(self) -> None:
        limiter = UserBasedRateLimiter(max_requests=1, window_seconds=1)

        limiter.check("user-1")

        time.sleep(1.1)

        limiter.check("user-1")  # Should pass -- window expired
