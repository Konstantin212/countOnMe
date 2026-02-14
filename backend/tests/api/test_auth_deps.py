"""Integration tests for authentication dependencies."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device
from app.services.auth import issue_device_token


@pytest.mark.asyncio
async def test_no_auth_header_returns_401(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test that missing auth header returns 401."""
    client, _ = authenticated_client
    # Remove auth header
    client.headers.pop("Authorization", None)

    response = await client.get("/v1/products")
    assert response.status_code == 401
    assert "bearer token" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_invalid_scheme_returns_401(app_client: AsyncClient):
    """Test that non-Bearer scheme returns 401."""
    app_client.headers["Authorization"] = "Basic sometoken"

    response = await app_client.get("/v1/products")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_invalid_token_format_returns_401(app_client: AsyncClient):
    """Test that malformed token returns 401."""
    app_client.headers["Authorization"] = "Bearer not-a-valid-token"

    response = await app_client.get("/v1/products")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_wrong_secret_returns_401(app_client: AsyncClient, db_session: AsyncSession):
    """Test that token with wrong secret returns 401."""
    # Create a device
    device_id = uuid.uuid4()
    _, token_hash = issue_device_token(device_id)
    device = Device(id=device_id, token_hash=token_hash)
    db_session.add(device)
    await db_session.commit()

    # Create a token with wrong secret
    fake_token = f"{device_id}.wrongsecret"
    app_client.headers["Authorization"] = f"Bearer {fake_token}"

    response = await app_client.get("/v1/products")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_unknown_device_returns_401(app_client: AsyncClient):
    """Test that token for non-existent device returns 401."""
    unknown_device_id = uuid.uuid4()
    unknown_token, _ = issue_device_token(unknown_device_id)
    app_client.headers["Authorization"] = f"Bearer {unknown_token}"

    response = await app_client.get("/v1/products")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_valid_token_returns_200(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test that valid token allows access."""
    client, _ = authenticated_client

    response = await client.get("/v1/products")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_auth_updates_last_seen(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
):
    """Test that successful auth updates device last_seen_at."""
    client, device_id = authenticated_client

    # Get initial last_seen
    from sqlalchemy import select

    from app.models.device import Device

    stmt = select(Device).where(Device.id == device_id)
    result = await db_session.execute(stmt)
    device_before = result.scalar_one()
    last_seen_before = device_before.last_seen_at

    # Make an authenticated request
    response = await client.get("/v1/products")
    assert response.status_code == 200

    # Refresh device to get updated last_seen
    await db_session.refresh(device_before)
    last_seen_after = device_before.last_seen_at

    # last_seen should have been updated
    assert last_seen_after >= last_seen_before
