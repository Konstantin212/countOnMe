"""Integration tests for authentication dependencies."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt as pyjwt
import pytest
from httpx import AsyncClient

from tests.conftest import _TEST_EC_PRIVATE_KEY


def _make_jwt(sub: str, email: str = "test@test.com", **overrides) -> str:
    payload = {
        "sub": sub,
        "email": email,
        "aud": "authenticated",
        "exp": datetime.now(UTC) + timedelta(hours=1),
        "iat": datetime.now(UTC),
    }
    payload.update(overrides)
    return pyjwt.encode(payload, _TEST_EC_PRIVATE_KEY, algorithm="ES256")


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
async def test_expired_jwt_returns_401(app_client: AsyncClient):
    """Test that expired JWT returns 401."""
    jwt_token = _make_jwt(
        sub=str(uuid.uuid4()),
        exp=datetime.now(UTC) - timedelta(hours=1),
    )
    app_client.headers["Authorization"] = f"Bearer {jwt_token}"

    response = await app_client.get("/v1/products")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_valid_jwt_returns_200(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test that valid JWT allows access."""
    client, _ = authenticated_client

    response = await client.get("/v1/products")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_jwt_without_sub_returns_401(app_client: AsyncClient):
    """Test that JWT without 'sub' claim returns 401."""
    payload = {
        "email": "test@test.com",
        "aud": "authenticated",
        "exp": datetime.now(UTC) + timedelta(hours=1),
        "iat": datetime.now(UTC),
    }
    token = pyjwt.encode(payload, _TEST_EC_PRIVATE_KEY, algorithm="ES256")
    app_client.headers["Authorization"] = f"Bearer {token}"

    response = await app_client.get("/v1/products")
    assert response.status_code == 401
