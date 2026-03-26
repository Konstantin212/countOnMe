from __future__ import annotations

import logging
import uuid

import jwt as pyjwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.features.auth.models import Device, User, UserDevice
from app.features.auth.service import (
    SUPABASE_MANAGED_HASH,
    AccountDeleted,
    decode_supabase_jwt,
    get_device_by_id,
    get_or_create_user,
    parse_device_token,
    touch_device_last_seen,
    verify_device_token,
)

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Legacy device-token auth (existing endpoints)
# ---------------------------------------------------------------------------


async def get_current_device(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: AsyncSession = Depends(get_session),
) -> Device:
    """Authenticate via Supabase JWT (preferred) or legacy device token (fallback).

    For JWT: decodes token, resolves user, finds the first linked device.
    For device token: parses {device_id}.{secret} format, verifies hash.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = credentials.credentials

    # Try Supabase JWT first
    try:
        payload = decode_supabase_jwt(token)
        sub = payload.get("sub")
        logger.debug("JWT decoded OK — sub=%s", sub)
        if sub:
            supabase_id = uuid.UUID(sub)
            email: str | None = payload.get("email")
            user = await get_or_create_user(session, supabase_id=supabase_id, email=email)
            await session.flush()
            logger.debug("User resolved — id=%s", user.id)

            # Find the user's first linked device
            result = await session.execute(
                select(UserDevice).where(UserDevice.user_id == user.id).limit(1)
            )
            user_device = result.scalar_one_or_none()
            logger.debug("User device lookup — found=%s", user_device is not None)
            if user_device is not None:
                device = await get_device_by_id(session, user_device.device_id)
                if device is not None:
                    await touch_device_last_seen(session, device)
                    await session.commit()
                    return device

            # User exists but no device linked yet — create and link a device
            logger.debug("No linked device — creating and linking one")
            async with session.begin_nested():
                device = Device(id=uuid.uuid4(), token_hash=SUPABASE_MANAGED_HASH)
                session.add(device)
                await session.flush()

                user_device_link = UserDevice(user_id=user.id, device_id=device.id)
                session.add(user_device_link)

            await session.commit()
            logger.debug("Created and linked device %s for user %s", device.id, user.id)
            return device
    except AccountDeleted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account has been deleted",
        ) from None
    except (pyjwt.InvalidTokenError, ValueError) as exc:
        logger.debug("JWT verification failed: %s: %s", type(exc).__name__, exc)
        # Not a valid JWT — try legacy device token

    # Fallback: legacy device token
    parsed = parse_device_token(token)
    if parsed is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    device = await get_device_by_id(session, parsed.device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if not verify_device_token(parsed.secret, device.token_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    await touch_device_last_seen(session, device)
    await session.commit()

    return device


async def get_current_device_id(device: Device = Depends(get_current_device)) -> uuid.UUID:
    return device.id


# ---------------------------------------------------------------------------
# Supabase JWT auth (new auth endpoints)
# ---------------------------------------------------------------------------


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Validate Supabase JWT and auto-create user from claims on first call.

    Extracts ``sub`` (supabase user id) and ``email`` from the JWT payload,
    then calls ``get_or_create_user`` to ensure the user exists locally.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    try:
        payload = decode_supabase_jwt(credentials.credentials)
    except pyjwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token",
        ) from None

    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        supabase_id = uuid.UUID(sub)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token",
        ) from None

    email: str | None = payload.get("email")

    try:
        user = await get_or_create_user(session, supabase_id=supabase_id, email=email)
    except AccountDeleted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account has been deleted",
        ) from None
    await session.flush()
    return user


async def get_current_user_id(user: User = Depends(get_current_user)) -> uuid.UUID:
    return user.id
