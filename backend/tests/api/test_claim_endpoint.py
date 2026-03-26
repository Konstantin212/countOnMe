"""Integration tests for POST /v1/auth/claim-device-data."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import create_product

# Generate a test EC key pair for ES256
_TEST_EC_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
_TEST_EC_PUBLIC_KEY = _TEST_EC_PRIVATE_KEY.public_key()


def _make_jwt(
    sub: str | None = None,
    email: str | None = "test@example.com",
    aud: str = "authenticated",
    exp_delta: timedelta = timedelta(hours=1),
) -> str:
    payload: dict = {}
    if sub is not None:
        payload["sub"] = sub
    if email is not None:
        payload["email"] = email
    payload["aud"] = aud
    payload["exp"] = datetime.now(UTC) + exp_delta
    payload["iat"] = datetime.now(UTC)
    return pyjwt.encode(payload, _TEST_EC_PRIVATE_KEY, algorithm="ES256")


@pytest.fixture(autouse=True)
def _patch_jwks_client():
    mock_client = MagicMock()

    def get_signing_key_from_jwt(token):
        mock_key = MagicMock()
        mock_key.key = _TEST_EC_PUBLIC_KEY
        return mock_key

    mock_client.get_signing_key_from_jwt = get_signing_key_from_jwt
    with patch("app.features.auth.service._get_jwks_client", return_value=mock_client):
        yield


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


class TestClaimDeviceData:
    @pytest.mark.asyncio
    async def test_claim_device_data_success(
        self, app_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Claiming a linked device with data returns counts."""
        sub = str(uuid.uuid4())
        token = _make_jwt(sub=sub, email="claim@test.com")
        device_id = uuid.uuid4()

        # Link device first (auto-creates user + device)
        link_resp = await app_client.post(
            "/v1/auth/link-device",
            json={"device_id": str(device_id)},
            headers=_auth_headers(token),
        )
        assert link_resp.status_code == 200

        # Create a product directly in DB for this device
        # The device was already created by link-device, so use device_id directly.
        await create_product(db_session, device_id)
        await db_session.commit()

        # Call claim endpoint
        resp = await app_client.post(
            "/v1/auth/claim-device-data",
            json={"device_id": str(device_id)},
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert "claimed_counts" in data
        counts = data["claimed_counts"]
        assert counts["products"] >= 0
        assert counts["portions"] >= 0
        assert counts["food_entries"] >= 0
        assert counts["goals"] >= 0
        assert counts["body_weights"] >= 0

    @pytest.mark.asyncio
    async def test_claim_device_not_linked_returns_404(
        self, app_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Claiming a device that is not linked returns 404."""
        sub = str(uuid.uuid4())
        token = _make_jwt(sub=sub, email="notlinked@test.com")

        # Create user (via /me or any auth endpoint)
        await app_client.get("/v1/auth/me", headers=_auth_headers(token))

        resp = await app_client.post(
            "/v1/auth/claim-device-data",
            json={"device_id": str(uuid.uuid4())},
            headers=_auth_headers(token),
        )

        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_claim_device_no_auth_returns_401(
        self, app_client: AsyncClient,
    ) -> None:
        resp = await app_client.post(
            "/v1/auth/claim-device-data",
            json={"device_id": str(uuid.uuid4())},
        )
        assert resp.status_code == 401


class TestLinkDeviceAutoClaimCounts:
    @pytest.mark.asyncio
    async def test_link_device_returns_claimed_counts(
        self, app_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Link-device response now includes claimed_counts."""
        sub = str(uuid.uuid4())
        device_id = uuid.uuid4()
        token = _make_jwt(sub=sub, email="autoclaim@test.com")

        resp = await app_client.post(
            "/v1/auth/link-device",
            json={"device_id": str(device_id), "device_name": "Auto Claim Phone"},
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert "claimed_counts" in data
        counts = data["claimed_counts"]
        assert isinstance(counts["products"], int)
        assert isinstance(counts["portions"], int)
        assert isinstance(counts["food_entries"], int)
        assert isinstance(counts["goals"], int)
        assert isinstance(counts["body_weights"], int)
        # Still has the link fields
        assert data["device_id"] == str(device_id)
        assert data["device_name"] == "Auto Claim Phone"
