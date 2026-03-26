from __future__ import annotations

import logging
import uuid

import jwt as pyjwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.features.auth.models import User
from app.features.auth.service import (
    AccountDeleted,
    decode_supabase_jwt,
    get_or_create_user,
)

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Optional device-id header (metadata for writes)
# ---------------------------------------------------------------------------


async def get_optional_device_id(
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
) -> uuid.UUID | None:
    """Read the optional ``X-Device-Id`` header and parse to UUID.

    Returns ``None`` when the header is absent or not a valid UUID.
    """
    if x_device_id is None:
        return None
    try:
        return uuid.UUID(x_device_id)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Supabase JWT auth
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


async def require_admin(user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures the authenticated user is an admin."""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
