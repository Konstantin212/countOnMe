from __future__ import annotations

import logging
import uuid

import jwt as pyjwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.features.auth.models import User
from app.features.auth.service import (
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
):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    parsed = parse_device_token(credentials.credentials)
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


async def get_current_device_id(device=Depends(get_current_device)):
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
