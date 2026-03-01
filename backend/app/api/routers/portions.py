from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_device_id
from app.db.session import get_session
from app.schemas.portion import PortionCreateRequest, PortionResponse, PortionUpdateRequest
from app.services.portions import (
    PortionConflict,
    create_portion,
    get_portion,
    list_portions,
    soft_delete_portion,
    update_portion,
)

router = APIRouter(tags=["portions"])


@router.get("/products/{product_id}/portions", response_model=list[PortionResponse])
async def portions_list(
    product_id: uuid.UUID,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> list[PortionResponse]:
    return await list_portions(session, device_id=device_id, product_id=product_id)


@router.post(
    "/products/{product_id}/portions",
    response_model=PortionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def portions_create(
    product_id: uuid.UUID,
    body: PortionCreateRequest,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> PortionResponse:
    portion = await create_portion(
        session,
        device_id=device_id,
        product_id=product_id,
        label=body.label,
        base_amount=body.base_amount,
        base_unit=body.base_unit,
        calories=body.calories,
        protein=body.protein,
        carbs=body.carbs,
        fat=body.fat,
        is_default=body.is_default,
    )
    if portion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return portion


@router.get("/portions/{portion_id}", response_model=PortionResponse)
async def portions_get(
    portion_id: uuid.UUID,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> PortionResponse:
    portion = await get_portion(session, device_id=device_id, portion_id=portion_id)
    if portion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return portion


@router.patch("/portions/{portion_id}", response_model=PortionResponse)
async def portions_update(
    portion_id: uuid.UUID,
    body: PortionUpdateRequest,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> PortionResponse:
    patch: dict = {}
    for key in ["label", "base_amount", "base_unit", "calories", "protein", "carbs", "fat", "is_default"]:
        val = getattr(body, key)
        if val is not None:
            patch[key] = val

    try:
        portion = await update_portion(session, device_id=device_id, portion_id=portion_id, patch=patch)
    except PortionConflict as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e

    if portion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return portion


@router.delete("/portions/{portion_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def portions_delete(
    portion_id: uuid.UUID,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> None:
    try:
        ok = await soft_delete_portion(session, device_id=device_id, portion_id=portion_id)
    except PortionConflict as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e

    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

