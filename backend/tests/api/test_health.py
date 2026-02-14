"""Smoke test for test infrastructure."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(app_client: AsyncClient):
    """Test that the health endpoint works with test infrastructure."""
    response = await app_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}
