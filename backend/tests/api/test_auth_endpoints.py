"""Integration tests for Supabase auth endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import User, UserDevice

# Generate a test EC key pair for ES256
_TEST_EC_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
_TEST_EC_PUBLIC_KEY = _TEST_EC_PRIVATE_KEY.public_key()


def _make_jwt(
    sub: str | None = None,
    email: str | None = "test@example.com",
    aud: str = "authenticated",
    exp_delta: timedelta = timedelta(hours=1),
    private_key=_TEST_EC_PRIVATE_KEY,
) -> str:
    """Create a signed Supabase-style JWT for testing (ES256)."""
    payload: dict = {}
    if sub is not None:
        payload["sub"] = sub
    if email is not None:
        payload["email"] = email
    payload["aud"] = aud
    payload["exp"] = datetime.now(UTC) + exp_delta
    payload["iat"] = datetime.now(UTC)
    return pyjwt.encode(payload, private_key, algorithm="ES256")


@pytest.fixture(autouse=True)
def _patch_jwks_client():
    """Patch the JWKS client for all tests in this module."""
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


# ---------------------------------------------------------------------------
# POST /v1/auth/link-device
# ---------------------------------------------------------------------------


class TestLinkDevice:
    @pytest.mark.asyncio
    async def test_link_device_creates_user_and_device(
        self, app_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        sub = str(uuid.uuid4())
        device_id = uuid.uuid4()
        token = _make_jwt(sub=sub, email="link@test.com")

        response = await app_client.post(
            "/v1/auth/link-device",
            json={"device_id": str(device_id), "device_name": "My Phone"},
            headers=_auth_headers(token),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["device_id"] == str(device_id)
        assert data["device_name"] == "My Phone"
        assert "id" in data
        assert "linked_at" in data

    @pytest.mark.asyncio
    async def test_link_device_idempotent(
        self, app_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        sub = str(uuid.uuid4())
        device_id = uuid.uuid4()
        token = _make_jwt(sub=sub, email="idempotent@test.com")

        body = {"device_id": str(device_id)}

        resp1 = await app_client.post(
            "/v1/auth/link-device", json=body, headers=_auth_headers(token),
        )
        resp2 = await app_client.post(
            "/v1/auth/link-device", json=body, headers=_auth_headers(token),
        )

        assert resp1.status_code == 200
        assert resp2.status_code == 200
        # Same user_device id
        assert resp1.json()["id"] == resp2.json()["id"]

    @pytest.mark.asyncio
    async def test_link_device_with_legacy_token(
        self, app_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Link with a valid legacy device token for migration."""
        sub = str(uuid.uuid4())
        jwt_token = _make_jwt(sub=sub, email="legacy@test.com")

        # Register a device via the legacy endpoint (requires allow_device_auth)
        device_id = uuid.uuid4()
        with patch("app.features.auth.router.settings") as mock_settings:
            mock_settings.allow_device_auth = True
            reg_resp = await app_client.post(
                "/v1/devices/register",
                json={"device_id": str(device_id)},
            )
        assert reg_resp.status_code == 200
        legacy_token = reg_resp.json()["device_token"]

        # Link with legacy token
        response = await app_client.post(
            "/v1/auth/link-device",
            json={
                "device_id": str(device_id),
                "device_name": "Legacy Device",
                "legacy_device_token": legacy_token,
            },
            headers=_auth_headers(jwt_token),
        )

        assert response.status_code == 200
        assert response.json()["device_id"] == str(device_id)

    @pytest.mark.asyncio
    async def test_link_device_with_invalid_legacy_token(
        self, app_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        sub = str(uuid.uuid4())
        jwt_token = _make_jwt(sub=sub, email="bad-legacy@test.com")

        # Register a device first (requires allow_device_auth)
        device_id = uuid.uuid4()
        with patch("app.features.auth.router.settings") as mock_settings:
            mock_settings.allow_device_auth = True
            await app_client.post(
                "/v1/devices/register",
                json={"device_id": str(device_id)},
            )

        response = await app_client.post(
            "/v1/auth/link-device",
            json={
                "device_id": str(device_id),
                "legacy_device_token": f"{device_id}.wrong-secret",
            },
            headers=_auth_headers(jwt_token),
        )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_link_device_requires_legacy_token_for_registered_device(
        self, app_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Linking a device that has a real token_hash requires legacy_device_token."""
        sub = str(uuid.uuid4())
        jwt_token = _make_jwt(sub=sub, email="ownership@test.com")

        # Register a device (gives it a real token_hash; requires allow_device_auth)
        device_id = uuid.uuid4()
        with patch("app.features.auth.router.settings") as mock_settings:
            mock_settings.allow_device_auth = True
            reg_resp = await app_client.post(
                "/v1/devices/register",
                json={"device_id": str(device_id)},
            )
        assert reg_resp.status_code == 200

        # Try to link without legacy token — should get 403
        response = await app_client.post(
            "/v1/auth/link-device",
            json={"device_id": str(device_id)},
            headers=_auth_headers(jwt_token),
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_link_device_no_auth_returns_401(
        self, app_client: AsyncClient,
    ) -> None:
        response = await app_client.post(
            "/v1/auth/link-device",
            json={"device_id": str(uuid.uuid4())},
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# GET /v1/auth/me
# ---------------------------------------------------------------------------


class TestGetMe:
    @pytest.mark.asyncio
    async def test_me_returns_profile(
        self, app_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        sub = str(uuid.uuid4())
        email = f"me-{uuid.uuid4().hex[:8]}@test.com"
        token = _make_jwt(sub=sub, email=email)
        device_id = uuid.uuid4()

        # Link a device first
        await app_client.post(
            "/v1/auth/link-device",
            json={"device_id": str(device_id), "device_name": "Test Phone"},
            headers=_auth_headers(token),
        )

        response = await app_client.get(
            "/v1/auth/me",
            headers=_auth_headers(token),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == email
        assert "id" in data
        assert "created_at" in data
        assert len(data["devices"]) == 1
        assert data["devices"][0]["device_id"] == str(device_id)
        assert data["devices"][0]["device_name"] == "Test Phone"

    @pytest.mark.asyncio
    async def test_me_without_auth_returns_401(
        self, app_client: AsyncClient,
    ) -> None:
        response = await app_client.get("/v1/auth/me")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_me_with_expired_token_returns_401(
        self, app_client: AsyncClient,
    ) -> None:
        token = _make_jwt(sub=str(uuid.uuid4()), exp_delta=timedelta(hours=-1))
        response = await app_client.get(
            "/v1/auth/me",
            headers=_auth_headers(token),
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_me_auto_creates_user(
        self, app_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """GET /me should auto-create user from JWT claims (via get_current_user dep)."""
        sub = str(uuid.uuid4())
        email = f"auto-{uuid.uuid4().hex[:8]}@test.com"
        token = _make_jwt(sub=sub, email=email)

        response = await app_client.get(
            "/v1/auth/me",
            headers=_auth_headers(token),
        )

        assert response.status_code == 200
        assert response.json()["email"] == email


# ---------------------------------------------------------------------------
# DELETE /v1/auth/account
# ---------------------------------------------------------------------------


class TestDeleteAccount:
    @pytest.mark.asyncio
    async def test_delete_account(
        self, app_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        sub = str(uuid.uuid4())
        token = _make_jwt(sub=sub, email="delete@test.com")
        device_id = uuid.uuid4()

        # Create user + link device
        await app_client.post(
            "/v1/auth/link-device",
            json={"device_id": str(device_id)},
            headers=_auth_headers(token),
        )

        # Delete account
        response = await app_client.delete(
            "/v1/auth/account",
            headers=_auth_headers(token),
        )
        assert response.status_code == 204

        # Verify user is soft-deleted
        stmt = select(User).where(User.supabase_id == uuid.UUID(sub))
        result = await db_session.execute(stmt)
        user = result.scalar_one_or_none()
        assert user is not None
        assert user.deleted_at is not None

        # Verify device links are removed
        ud_stmt = select(UserDevice).where(UserDevice.user_id == user.id)
        ud_result = await db_session.execute(ud_stmt)
        assert ud_result.scalar_one_or_none() is None

    @pytest.mark.asyncio
    async def test_deleted_user_cannot_reauthenticate(
        self, app_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """After account deletion, the same JWT should return 403."""
        sub = str(uuid.uuid4())
        token = _make_jwt(sub=sub, email="reauth@test.com")

        # Create user via link-device
        device_id = uuid.uuid4()
        await app_client.post(
            "/v1/auth/link-device",
            json={"device_id": str(device_id)},
            headers=_auth_headers(token),
        )

        # Delete account
        resp = await app_client.delete("/v1/auth/account", headers=_auth_headers(token))
        assert resp.status_code == 204

        # Try to access /me with same token — should be 403
        resp2 = await app_client.get("/v1/auth/me", headers=_auth_headers(token))
        assert resp2.status_code == 403
        assert resp2.json()["detail"] == "Account has been deleted"

    @pytest.mark.asyncio
    async def test_delete_account_no_auth_returns_401(
        self, app_client: AsyncClient,
    ) -> None:
        response = await app_client.delete("/v1/auth/account")
        assert response.status_code == 401
