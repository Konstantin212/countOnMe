from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user_id, get_optional_device_id
from app.core.rate_limit import UserBasedRateLimiter
from app.features.fasting.schemas import (
    FastingEndRequest,
    FastingSessionResponse,
    FastingStartRequest,
    FastingUpdateRequest,
)
from app.features.fasting.service import (
    FastingConflict,
    end_fasting_session,
    get_active_session,
    get_fasting_session,
    list_fasting_sessions,
    soft_delete_fasting_session,
    start_fasting_session,
    update_fasting_session,
)

# 20 write requests per minute per user
_fasting_write_limiter = UserBasedRateLimiter(max_requests=20, window_seconds=60)

router = APIRouter(prefix="/fasting-sessions", tags=["fasting"])


@router.get("", response_model=list[FastingSessionResponse])
async def fasting_list(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> list[FastingSessionResponse]:
    return await list_fasting_sessions(session, user_id=user_id, limit=limit, offset=offset)


@router.post("", response_model=FastingSessionResponse, status_code=status.HTTP_201_CREATED)
async def fasting_start(
    body: FastingStartRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    device_id: uuid.UUID | None = Depends(get_optional_device_id),
    session: AsyncSession = Depends(get_session),
) -> FastingSessionResponse:
    _fasting_write_limiter.check(str(user_id))
    try:
        return await start_fasting_session(session, user_id=user_id, data=body, device_id=device_id)
    except FastingConflict as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e


@router.get("/active", response_model=FastingSessionResponse)
async def fasting_active(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> FastingSessionResponse:
    row = await get_active_session(session, user_id=user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active fasting session")
    return row


@router.get("/{session_id}", response_model=FastingSessionResponse)
async def fasting_get(
    session_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> FastingSessionResponse:
    row = await get_fasting_session(session, user_id=user_id, session_id=session_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return row


@router.post("/{session_id}/end", response_model=FastingSessionResponse)
async def fasting_end(
    session_id: uuid.UUID,
    body: FastingEndRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    device_id: uuid.UUID | None = Depends(get_optional_device_id),
    session: AsyncSession = Depends(get_session),
) -> FastingSessionResponse:
    _fasting_write_limiter.check(str(user_id))
    row = await end_fasting_session(
        session, user_id=user_id, session_id=session_id, ended_at=body.ended_at, device_id=device_id,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return row


@router.patch("/{session_id}", response_model=FastingSessionResponse)
async def fasting_update(
    session_id: uuid.UUID,
    body: FastingUpdateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    device_id: uuid.UUID | None = Depends(get_optional_device_id),
    session: AsyncSession = Depends(get_session),
) -> FastingSessionResponse:
    _fasting_write_limiter.check(str(user_id))
    row = await update_fasting_session(
        session, user_id=user_id, session_id=session_id, data=body, device_id=device_id,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return row


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def fasting_delete(
    session_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    device_id: uuid.UUID | None = Depends(get_optional_device_id),
    session: AsyncSession = Depends(get_session),
) -> None:
    _fasting_write_limiter.check(str(user_id))
    ok = await soft_delete_fasting_session(
        session, user_id=user_id, session_id=session_id, device_id=device_id,
    )
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
