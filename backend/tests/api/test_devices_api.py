"""Integration tests for devices router."""

from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture(autouse=True)
def _enable_device_auth():
    """Enable legacy device auth for all tests in this module."""
    with patch("app.features.auth.router.settings") as mock_settings:
        mock_settings.allow_device_auth = True
        yield


@pytest.mark.asyncio
async def test_register_new_device(app_client: AsyncClient, db_session: AsyncSession):
    """Test registering a new device returns 200 with device_id and device_token."""
    device_id = uuid.uuid4()
    response = await app_client.post("/v1/devices/register", json={"device_id": str(device_id)})

    assert response.status_code == 200
    data = response.json()
    assert "device_id" in data
    assert "device_token" in data
    assert uuid.UUID(data["device_id"]) == device_id
    assert len(data["device_token"]) > 0


@pytest.mark.asyncio
async def test_register_existing_device_returns_new_token(app_client: AsyncClient):
    """Test re-registering an existing device returns 200 with a new token."""
    device_id = uuid.uuid4()

    # First registration
    response1 = await app_client.post("/v1/devices/register", json={"device_id": str(device_id)})
    assert response1.status_code == 200
    token1 = response1.json()["device_token"]

    # Second registration - should get a new token
    response2 = await app_client.post("/v1/devices/register", json={"device_id": str(device_id)})
    assert response2.status_code == 200
    token2 = response2.json()["device_token"]

    # Tokens should be different
    assert token1 != token2


@pytest.mark.asyncio
async def test_register_device_with_invalid_uuid(app_client: AsyncClient):
    """Test registering with invalid UUID returns 422."""
    response = await app_client.post("/v1/devices/register", json={"device_id": "not-a-uuid"})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_device_returns_410_when_disabled(app_client: AsyncClient):
    """Test that /devices/register returns 410 when allow_device_auth is False."""
    with patch("app.features.auth.router.settings") as mock_settings:
        mock_settings.allow_device_auth = False
        device_id = uuid.uuid4()
        response = await app_client.post(
            "/v1/devices/register", json={"device_id": str(device_id)},
        )
    assert response.status_code == 410
    assert response.json()["detail"] == "Legacy device auth is disabled"
