"""Unit tests for JWT verification and user service functions."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.service import AccountDeleted, decode_supabase_jwt, get_or_create_user

# Generate a test EC key pair for ES256
_TEST_EC_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
_TEST_EC_PUBLIC_KEY = _TEST_EC_PRIVATE_KEY.public_key()


def _make_jwt(
    sub: str | None = None,
    email: str | None = "test@example.com",
    aud: str = "authenticated",
    exp_delta: timedelta | None = None,
    private_key=_TEST_EC_PRIVATE_KEY,
    algorithm: str = "ES256",
    extra_claims: dict | None = None,
) -> str:
    """Helper to create a signed JWT for testing (ES256 by default)."""
    payload: dict = {}
    if sub is not None:
        payload["sub"] = sub
    if email is not None:
        payload["email"] = email
    payload["aud"] = aud
    if exp_delta is not None:
        payload["exp"] = datetime.now(UTC) + exp_delta
    else:
        payload["exp"] = datetime.now(UTC) + timedelta(hours=1)
    payload["iat"] = datetime.now(UTC)
    if extra_claims:
        payload.update(extra_claims)
    return pyjwt.encode(payload, private_key, algorithm=algorithm)


def _mock_jwks_client():
    """Create a mock JWKS client that returns our test public key."""
    mock_client = MagicMock()

    def get_signing_key_from_jwt(token):
        mock_key = MagicMock()
        mock_key.key = _TEST_EC_PUBLIC_KEY
        return mock_key

    mock_client.get_signing_key_from_jwt = get_signing_key_from_jwt
    return mock_client


@pytest.fixture(autouse=True)
def _patch_jwks_client():
    """Patch the JWKS client for all tests in this module."""
    mock_client = _mock_jwks_client()
    with patch("app.features.auth.service._get_jwks_client", return_value=mock_client):
        yield


class TestDecodeSupabaseJwt:
    """Tests for decode_supabase_jwt()."""

    def test_valid_token(self) -> None:
        sub = str(uuid.uuid4())
        token = _make_jwt(sub=sub, email="user@test.com")
        payload = decode_supabase_jwt(token)
        assert payload["sub"] == sub
        assert payload["email"] == "user@test.com"
        assert payload["aud"] == "authenticated"

    def test_expired_token(self) -> None:
        token = _make_jwt(sub=str(uuid.uuid4()), exp_delta=timedelta(hours=-1))
        with pytest.raises(pyjwt.ExpiredSignatureError):
            decode_supabase_jwt(token)

    def test_wrong_key(self) -> None:
        """Token signed with a different key should fail."""
        other_key = ec.generate_private_key(ec.SECP256R1())
        token = _make_jwt(sub=str(uuid.uuid4()), private_key=other_key)
        with pytest.raises(pyjwt.InvalidSignatureError):
            decode_supabase_jwt(token)

    def test_wrong_audience(self) -> None:
        token = _make_jwt(sub=str(uuid.uuid4()), aud="wrong-audience")
        with pytest.raises(pyjwt.InvalidAudienceError):
            decode_supabase_jwt(token)

    def test_missing_sub_raises(self) -> None:
        token = _make_jwt(sub=None)
        with pytest.raises(pyjwt.MissingRequiredClaimError):
            decode_supabase_jwt(token)

    def test_malformed_token(self) -> None:
        with pytest.raises(pyjwt.DecodeError):
            decode_supabase_jwt("not-a-jwt")

    def test_empty_token(self) -> None:
        with pytest.raises(pyjwt.DecodeError):
            decode_supabase_jwt("")


class TestGetOrCreateUser:
    """Tests for get_or_create_user()."""

    @pytest.mark.asyncio
    async def test_creates_user(self, db_session: AsyncSession) -> None:
        supabase_id = uuid.uuid4()
        user = await get_or_create_user(db_session, supabase_id=supabase_id, email="new@test.com")
        assert user.supabase_id == supabase_id
        assert user.email == "new@test.com"

    @pytest.mark.asyncio
    async def test_returns_existing_user(self, db_session: AsyncSession) -> None:
        supabase_id = uuid.uuid4()
        user1 = await get_or_create_user(db_session, supabase_id=supabase_id, email="u@test.com")
        user2 = await get_or_create_user(db_session, supabase_id=supabase_id, email="u@test.com")
        assert user1.id == user2.id

    @pytest.mark.asyncio
    async def test_updates_email(self, db_session: AsyncSession) -> None:
        supabase_id = uuid.uuid4()
        await get_or_create_user(db_session, supabase_id=supabase_id, email="old@test.com")
        user = await get_or_create_user(db_session, supabase_id=supabase_id, email="new@test.com")
        assert user.email == "new@test.com"

    @pytest.mark.asyncio
    async def test_soft_deleted_user_raises(self, db_session: AsyncSession) -> None:
        supabase_id = uuid.uuid4()
        user = await get_or_create_user(db_session, supabase_id=supabase_id, email="del@test.com")
        user.deleted_at = datetime.now(UTC)
        await db_session.flush()
        with pytest.raises(AccountDeleted):
            await get_or_create_user(db_session, supabase_id=supabase_id, email="del@test.com")

    @pytest.mark.asyncio
    async def test_null_email(self, db_session: AsyncSession) -> None:
        supabase_id = uuid.uuid4()
        user = await get_or_create_user(db_session, supabase_id=supabase_id, email=None)
        assert user.email is None
