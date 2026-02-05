from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_device_id
from app.db.session import get_session
from app.schemas.food_entry import FoodEntryCreateRequest, FoodEntryResponse, FoodEntryUpdateRequest
from app.services.food_entries import (
    create_food_entry,
    get_food_entry,
    list_food_entries,
    soft_delete_food_entry,
    update_food_entry,
)


router = APIRouter(prefix="/food-entries", tags=["food-entries"])


@router.get("", response_model=list[FoodEntryResponse])
async def food_entries_list(
    day: date | None = Query(default=None),
    from_day: date | None = Query(default=None, alias="from"),
    to_day: date | None = Query(default=None, alias="to"),
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> list[FoodEntryResponse]:
    return await list_food_entries(session, device_id=device_id, day=day, from_day=from_day, to_day=to_day)


@router.post("", response_model=FoodEntryResponse, status_code=status.HTTP_201_CREATED)
async def food_entries_create(
    body: FoodEntryCreateRequest,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> FoodEntryResponse:
    entry = await create_food_entry(
        session,
        device_id=device_id,
        product_id=body.product_id,
        portion_id=body.portion_id,
        day=body.day,
        meal_type=body.meal_type,
        amount=body.amount,
        unit=body.unit,
    )
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return entry


@router.get("/{entry_id}", response_model=FoodEntryResponse)
async def food_entries_get(
    entry_id: uuid.UUID,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> FoodEntryResponse:
    entry = await get_food_entry(session, device_id=device_id, entry_id=entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return entry


@router.patch("/{entry_id}", response_model=FoodEntryResponse)
async def food_entries_update(
    entry_id: uuid.UUID,
    body: FoodEntryUpdateRequest,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> FoodEntryResponse:
    patch: dict = {}
    for key in ["portion_id", "meal_type", "amount", "unit"]:
        val = getattr(body, key)
        if val is not None:
            patch[key] = val

    entry = await update_food_entry(session, device_id=device_id, entry_id=entry_id, patch=patch)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def food_entries_delete(
    entry_id: uuid.UUID,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> None:
    ok = await soft_delete_food_entry(session, device_id=device_id, entry_id=entry_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

