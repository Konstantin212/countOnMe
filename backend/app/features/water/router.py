from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user_id, get_optional_device_id
from app.features.water.schemas import (
    WaterLogCreateRequest,
    WaterLogResponse,
    WaterLogUpdateRequest,
)
from app.features.water.service import (
    create_water_log,
    get_water_log,
    list_water_logs,
    soft_delete_water_log,
    update_water_log,
)

router = APIRouter(prefix="/water-logs", tags=["water-logs"])


@router.get("", response_model=list[WaterLogResponse])
async def water_logs_list(
    from_day: date | None = Query(default=None, alias="from"),
    to_day: date | None = Query(default=None, alias="to"),
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> list[WaterLogResponse]:
    return await list_water_logs(session, user_id=user_id, from_day=from_day, to_day=to_day)


@router.post("", response_model=WaterLogResponse, status_code=status.HTTP_201_CREATED)
async def water_logs_create(
    body: WaterLogCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    device_id: uuid.UUID | None = Depends(get_optional_device_id),
    session: AsyncSession = Depends(get_session),
) -> WaterLogResponse:
    return await create_water_log(
        session, user_id=user_id, day=body.day, amount_ml=body.amount_ml, device_id=device_id,
    )


@router.get("/{water_log_id}", response_model=WaterLogResponse)
async def water_logs_get(
    water_log_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> WaterLogResponse:
    row = await get_water_log(session, user_id=user_id, water_log_id=water_log_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return row


@router.patch("/{water_log_id}", response_model=WaterLogResponse)
async def water_logs_update(
    water_log_id: uuid.UUID,
    body: WaterLogUpdateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    device_id: uuid.UUID | None = Depends(get_optional_device_id),
    session: AsyncSession = Depends(get_session),
) -> WaterLogResponse:
    row = await update_water_log(
        session, user_id=user_id, water_log_id=water_log_id, amount_ml=body.amount_ml, device_id=device_id,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return row


@router.delete("/{water_log_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def water_logs_delete(
    water_log_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    device_id: uuid.UUID | None = Depends(get_optional_device_id),
    session: AsyncSession = Depends(get_session),
) -> None:
    ok = await soft_delete_water_log(session, user_id=user_id, water_log_id=water_log_id, device_id=device_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
