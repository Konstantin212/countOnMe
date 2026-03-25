from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import httpx
import jwt as pyjwt
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.features.auth.models import Device, User, UserDevice
from app.settings import settings

logger = logging.getLogger(__name__)


class OwnershipProofRequired(Exception):
    """Raised when a legacy device token is required but not provided."""


class AccountDeleted(Exception):
    """Raised when a soft-deleted user attempts to log in."""


@dataclass(frozen=True)
class ParsedDeviceToken:
    device_id: uuid.UUID
    secret: str


def _hash_secret(secret: str) -> str:
    """Hash secret with pepper using SHA-256 (tokens are already cryptographically random)."""
    peppered = f"{secret}.{settings.device_token_pepper}"
    return hashlib.sha256(peppered.encode()).hexdigest()


def issue_device_token(device_id: uuid.UUID) -> tuple[str, str]:
    """Return (device_token, token_hash_to_store)."""
    secret = secrets.token_urlsafe(32)
    token_hash = _hash_secret(secret)
    token = f"{device_id}.{secret}"
    return token, token_hash


def parse_device_token(token: str) -> ParsedDeviceToken | None:
    try:
        device_id_raw, secret = token.split(".", 1)
        return ParsedDeviceToken(device_id=uuid.UUID(device_id_raw), secret=secret)
    except Exception:
        return None


def verify_device_token(secret: str, token_hash: str) -> bool:
    computed = _hash_secret(secret)
    return hmac.compare_digest(computed, token_hash)


async def get_device_by_id(session: AsyncSession, device_id: uuid.UUID) -> Device | None:
    res = await session.execute(select(Device).where(Device.id == device_id))
    return res.scalar_one_or_none()


async def touch_device_last_seen(session: AsyncSession, device: Device) -> None:
    device.last_seen_at = datetime.now(UTC)
    session.add(device)


# ---------------------------------------------------------------------------
# Supabase JWT verification
# ---------------------------------------------------------------------------


def decode_supabase_jwt(token: str) -> dict[str, Any]:
    """Decode and verify a Supabase access token using HS256.

    Returns the decoded payload dict.
    Raises jwt.InvalidTokenError (or subclass) on any verification failure.
    """
    return pyjwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        audience="authenticated",
        options={"require": ["exp", "sub"]},
    )


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------


async def get_or_create_user(
    session: AsyncSession,
    *,
    supabase_id: uuid.UUID,
    email: str | None,
) -> User:
    """Find user by supabase_id; create if not exists. Updates email if changed.

    Raises AccountDeleted if the user was previously soft-deleted.
    """
    stmt = select(User).where(User.supabase_id == supabase_id)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if user is not None:
        # Refuse to reactivate soft-deleted users
        if user.deleted_at is not None:
            raise AccountDeleted
        # Update email if changed
        if email is not None and user.email != email:
            user.email = email
        session.add(user)
        await session.flush()
        return user

    # Create new user
    user = User(supabase_id=supabase_id, email=email)
    session.add(user)
    await session.flush()
    await session.refresh(user)
    logger.info("Created new user id=%s supabase_id=%s", user.id, supabase_id)
    return user


# ---------------------------------------------------------------------------
# Device linking
# ---------------------------------------------------------------------------


async def link_device_to_user(
    session: AsyncSession,
    *,
    user: User,
    device_id: uuid.UUID,
    device_name: str | None = None,
    legacy_device_token: str | None = None,
) -> UserDevice:
    """Link a device to a user. Idempotent — returns existing link if present.

    If ``legacy_device_token`` is provided, verify it against the device's
    ``token_hash`` for backward compatibility during migration.
    """
    # Check for existing link
    stmt = select(UserDevice).where(
        UserDevice.user_id == user.id,
        UserDevice.device_id == device_id,
    )
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing is not None:
        # Update device_name if provided
        if device_name is not None:
            existing.device_name = device_name
        existing.last_seen_at = datetime.now(UTC)
        session.add(existing)
        await session.flush()
        return existing

    # Verify the device exists (or create it)
    device = await get_device_by_id(session, device_id)
    if device is None:
        # Auto-create the device row
        device = Device(id=device_id, token_hash="supabase-managed")  # noqa: S106
        session.add(device)
        await session.flush()
    elif device.token_hash != "supabase-managed":  # noqa: S105
        # Device exists with a real token — require legacy token as ownership proof
        if legacy_device_token is None:
            raise OwnershipProofRequired("Legacy device token required to claim this device")
        parsed = parse_device_token(legacy_device_token)
        if parsed is None or parsed.device_id != device_id:
            raise ValueError("Invalid legacy device token")
        if not verify_device_token(parsed.secret, device.token_hash):
            raise ValueError("Invalid legacy device token")

    # If legacy token provided for a supabase-managed device, still validate format
    if legacy_device_token is not None and device.token_hash == "supabase-managed":  # noqa: S105
        parsed = parse_device_token(legacy_device_token)
        if parsed is None or parsed.device_id != device_id:
            raise ValueError("Invalid legacy device token")

    user_device = UserDevice(
        user_id=user.id,
        device_id=device_id,
        device_name=device_name,
    )
    session.add(user_device)
    await session.flush()
    await session.refresh(user_device)
    logger.info("Linked device %s to user %s", device_id, user.id)
    return user_device


# ---------------------------------------------------------------------------
# User profile
# ---------------------------------------------------------------------------


async def get_user_profile(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    """Fetch user with eagerly-loaded user_devices."""
    stmt = (
        select(User)
        .where(User.id == user_id, User.deleted_at.is_(None))
        .options(selectinload(User.user_devices))
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Account deletion
# ---------------------------------------------------------------------------


async def delete_user_account(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> uuid.UUID | None:
    """Soft-delete the user and remove all device links.

    Returns the user's supabase_id so the caller can delete the Supabase auth
    record after the transaction is committed. Returns None if user was not found.
    """
    stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        return None

    # Remove all device links (bulk delete)
    await session.execute(
        delete(UserDevice).where(UserDevice.user_id == user_id)
    )

    # Soft-delete the user
    user.deleted_at = datetime.now(UTC)
    session.add(user)
    await session.flush()

    logger.info("Soft-deleted user id=%s", user_id)
    return user.supabase_id


async def _delete_supabase_auth_user(supabase_id: uuid.UUID) -> None:
    """Call Supabase Admin API to delete auth.users row.

    Best-effort: logs on failure, never raises.
    Requires ``supabase_service_role_key`` and ``supabase_url`` in settings.
    """
    service_role_key = settings.supabase_service_role_key
    if not service_role_key:
        logger.warning("SUPABASE_SERVICE_ROLE_KEY not set; skipping Supabase auth user deletion")
        return

    supabase_url = settings.supabase_url
    if not supabase_url:
        logger.warning("SUPABASE_URL not set; skipping Supabase auth user deletion")
        return

    url = f"{supabase_url}/auth/v1/admin/users/{supabase_id}"
    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(url, headers=headers, timeout=10.0)
            if response.status_code < 300:
                logger.info("Deleted Supabase auth user %s", supabase_id)
            else:
                logger.error(
                    "Failed to delete Supabase auth user %s: status=%s",
                    supabase_id,
                    response.status_code,
                )
    except httpx.HTTPError:
        logger.exception("Error calling Supabase Admin API for user %s", supabase_id)
