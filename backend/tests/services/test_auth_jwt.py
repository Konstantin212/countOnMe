"""Unit tests for JWT verification and user service functions."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt as pyjwt
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import User
from app.features.auth.service import AccountDeleted, decode_supabase_jwt, get_or_create_user
from app.settings import settings

# Use the actual secret loaded by settings (may come from .env)
_JWT_SECRET = settings.supabase_jwt_secret


def _make_jwt(
    sub: str | None = None,
    email: str | None = "test@example.com",
    aud: str = "authenticated",
    exp_delta: timedelta | None = None,
    secret: str = _JWT_SECRET,
    extra_claims: dict | None = None,
) -> str:
    """Helper to create a signed JWT for testing."""
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
    return pyjwt.encode(payload, secret, algorithm="HS256")


class TestDecodeSupabaseJwt:
    """Tests for decode_supabase_jwt()."""

    def test_valid_token(self) -> None:
        sub = str(uuid.uuid4())
        token = _make_jwt(sub=sub, email="user@test.com")
        payload = decode_supabase_jwt(token)
        assert payload["sub"] == sub
        assert payload["email"] == "user@test.com"
        assert payload["aud"] == "authenticated"

    def test_expired_token_raises(self) -> None:
        token = _make_jwt(sub=str(uuid.uuid4()), exp_delta=timedelta(hours=-1))
        with pytest.raises(pyjwt.ExpiredSignatureError):
            decode_supabase_jwt(token)

    def test_wrong_secret_raises(self) -> None:
        token = _make_jwt(sub=str(uuid.uuid4()), secret="wrong-secret")
        with pytest.raises(pyjwt.InvalidSignatureError):
            decode_supabase_jwt(token)

    def test_wrong_audience_raises(self) -> None:
        token = _make_jwt(sub=str(uuid.uuid4()), aud="wrong-audience")
        with pytest.raises(pyjwt.InvalidAudienceError):
            decode_supabase_jwt(token)

    def test_missing_sub_raises(self) -> None:
        """Token without 'sub' claim should raise — sub is required."""
        token = _make_jwt(sub=None)
        with pytest.raises(pyjwt.MissingRequiredClaimError):
            decode_supabase_jwt(token)

    def test_malformed_token_raises(self) -> None:
        with pytest.raises(pyjwt.DecodeError):
            decode_supabase_jwt("not.a.valid.jwt")

    def test_empty_token_raises(self) -> None:
        with pytest.raises(pyjwt.DecodeError):
            decode_supabase_jwt("")


class TestGetOrCreateUser:
    """Tests for get_or_create_user()."""

    @pytest.mark.asyncio
    async def test_creates_new_user(self, db_session: AsyncSession) -> None:
        supabase_id = uuid.uuid4()
        email = f"new-{uuid.uuid4().hex[:8]}@example.com"

        user = await get_or_create_user(db_session, supabase_id=supabase_id, email=email)

        assert isinstance(user, User)
        assert user.supabase_id == supabase_id
        assert user.email == email
        assert user.id is not None

    @pytest.mark.asyncio
    async def test_returns_existing_user(self, db_session: AsyncSession) -> None:
        supabase_id = uuid.uuid4()
        email = f"existing-{uuid.uuid4().hex[:8]}@example.com"

        user1 = await get_or_create_user(db_session, supabase_id=supabase_id, email=email)
        user2 = await get_or_create_user(db_session, supabase_id=supabase_id, email=email)

        assert user1.id == user2.id

    @pytest.mark.asyncio
    async def test_updates_email_on_existing_user(self, db_session: AsyncSession) -> None:
        supabase_id = uuid.uuid4()
        old_email = f"old-{uuid.uuid4().hex[:8]}@example.com"
        new_email = f"new-{uuid.uuid4().hex[:8]}@example.com"

        user1 = await get_or_create_user(db_session, supabase_id=supabase_id, email=old_email)
        user2 = await get_or_create_user(db_session, supabase_id=supabase_id, email=new_email)

        assert user1.id == user2.id
        assert user2.email == new_email

    @pytest.mark.asyncio
    async def test_soft_deleted_user_raises_account_deleted(self, db_session: AsyncSession) -> None:
        """A soft-deleted user should raise AccountDeleted, not be reactivated."""
        supabase_id = uuid.uuid4()
        email = f"deleted-{uuid.uuid4().hex[:8]}@example.com"

        user1 = await get_or_create_user(db_session, supabase_id=supabase_id, email=email)
        # Soft-delete the user
        user1.deleted_at = datetime.now(UTC)
        db_session.add(user1)
        await db_session.commit()

        with pytest.raises(AccountDeleted):
            await get_or_create_user(db_session, supabase_id=supabase_id, email=email)

    @pytest.mark.asyncio
    async def test_handles_none_email(self, db_session: AsyncSession) -> None:
        supabase_id = uuid.uuid4()

        user = await get_or_create_user(db_session, supabase_id=supabase_id, email=None)

        assert user.supabase_id == supabase_id
        assert user.email is None
