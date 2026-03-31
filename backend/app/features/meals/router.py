from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user_id, get_optional_device_id
from app.features.meals.schemas import (
    FoodEntryCreateRequest,
    FoodEntryResponse,
    FoodEntryUpdateRequest,
)
from app.features.meals.service import (
    create_food_entry,
    enrich_food_entry_response,
    get_food_entry,
    list_food_entries,
    soft_delete_food_entry,
    update_food_entry,
)

router = APIRouter(prefix="/food-entries", tags=["food-entries"])


def _to_response(entry, enrichment: dict) -> FoodEntryResponse:
    """Convert a FoodEntry ORM object to response with enrichment."""
    return FoodEntryResponse.model_validate(
        {
            "id": entry.id,
            "product_id": entry.product_id,
            "portion_id": entry.portion_id,
            "catalog_portion_id": entry.catalog_portion_id,
            "day": entry.day,
            "meal_type": entry.meal_type,
            "amount": entry.amount,
            "unit": entry.unit,
            "resolved_product_name": enrichment.get("resolved_product_name"),
            "resolved_calories": enrichment.get("resolved_calories"),
            "created_at": entry.created_at,
            "updated_at": entry.updated_at,
        }
    )


@router.get("", response_model=list[FoodEntryResponse])
async def food_entries_list(
    day: date | None = Query(default=None),
    from_day: date | None = Query(default=None, alias="from"),
    to_day: date | None = Query(default=None, alias="to"),
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> list[FoodEntryResponse]:
    entries = await list_food_entries(session, user_id=user_id, day=day, from_day=from_day, to_day=to_day)
    results: list[FoodEntryResponse] = []
    for entry in entries:
        enrichment = await enrich_food_entry_response(session, entry)
        results.append(_to_response(entry, enrichment))
    return results


@router.post("", response_model=FoodEntryResponse, status_code=status.HTTP_201_CREATED)
async def food_entries_create(
    body: FoodEntryCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    device_id: uuid.UUID | None = Depends(get_optional_device_id),
    session: AsyncSession = Depends(get_session),
) -> FoodEntryResponse:
    entry = await create_food_entry(
        session,
        user_id=user_id,
        product_id=body.product_id,
        portion_id=body.portion_id,
        catalog_portion_id=body.catalog_portion_id,
        day=body.day,
        meal_type=body.meal_type,
        amount=body.amount,
        unit=body.unit,
        device_id=device_id,
    )
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    enrichment = await enrich_food_entry_response(session, entry)
    return _to_response(entry, enrichment)


@router.get("/{entry_id}", response_model=FoodEntryResponse)
async def food_entries_get(
    entry_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> FoodEntryResponse:
    entry = await get_food_entry(session, user_id=user_id, entry_id=entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    enrichment = await enrich_food_entry_response(session, entry)
    return _to_response(entry, enrichment)


@router.patch("/{entry_id}", response_model=FoodEntryResponse)
async def food_entries_update(
    entry_id: uuid.UUID,
    body: FoodEntryUpdateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    device_id: uuid.UUID | None = Depends(get_optional_device_id),
    session: AsyncSession = Depends(get_session),
) -> FoodEntryResponse:
    patch: dict = {}
    for key in ["portion_id", "meal_type", "amount", "unit"]:
        val = getattr(body, key)
        if val is not None:
            patch[key] = val

    entry = await update_food_entry(session, user_id=user_id, entry_id=entry_id, patch=patch, device_id=device_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    enrichment = await enrich_food_entry_response(session, entry)
    return _to_response(entry, enrichment)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def food_entries_delete(
    entry_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    device_id: uuid.UUID | None = Depends(get_optional_device_id),
    session: AsyncSession = Depends(get_session),
) -> None:
    ok = await soft_delete_food_entry(session, user_id=user_id, entry_id=entry_id, device_id=device_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
