from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_device_id
from app.db.session import get_session
from app.schemas.weight import BodyWeightCreateRequest, BodyWeightResponse, BodyWeightUpdateRequest
from app.services.weights import (
    WeightConflict,
    create_body_weight,
    get_body_weight,
    list_body_weights,
    soft_delete_body_weight,
    update_body_weight,
)

router = APIRouter(prefix="/body-weights", tags=["body-weights"])


@router.get("", response_model=list[BodyWeightResponse])
async def body_weights_list(
    from_day: date | None = Query(default=None, alias="from"),
    to_day: date | None = Query(default=None, alias="to"),
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> list[BodyWeightResponse]:
    return await list_body_weights(session, device_id=device_id, from_day=from_day, to_day=to_day)


@router.post("", response_model=BodyWeightResponse, status_code=status.HTTP_201_CREATED)
async def body_weights_create(
    body: BodyWeightCreateRequest,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> BodyWeightResponse:
    try:
        return await create_body_weight(session, device_id=device_id, day=body.day, weight_kg=body.weight_kg)
    except WeightConflict as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e


@router.get("/{weight_id}", response_model=BodyWeightResponse)
async def body_weights_get(
    weight_id: uuid.UUID,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> BodyWeightResponse:
    row = await get_body_weight(session, device_id=device_id, weight_id=weight_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return row


@router.patch("/{weight_id}", response_model=BodyWeightResponse)
async def body_weights_update(
    weight_id: uuid.UUID,
    body: BodyWeightUpdateRequest,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> BodyWeightResponse:
    row = await update_body_weight(session, device_id=device_id, weight_id=weight_id, weight_kg=body.weight_kg)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return row


@router.delete("/{weight_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def body_weights_delete(
    weight_id: uuid.UUID,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> None:
    ok = await soft_delete_body_weight(session, device_id=device_id, weight_id=weight_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

