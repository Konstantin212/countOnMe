from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ownership import get_owner_filter
from app.features.meals.models import FoodEntry
from app.features.portions.models import ProductPortion
from app.features.products.service import get_product


def _not_deleted(stmt: Select):
    return stmt.where(FoodEntry.deleted_at.is_(None))


async def _get_portion(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    portion_id: uuid.UUID,
    device_id: uuid.UUID | None = None,
) -> ProductPortion | None:
    stmt = (
        select(ProductPortion)
        .where(
            ProductPortion.deleted_at.is_(None),
            get_owner_filter(ProductPortion, user_id=user_id),
            ProductPortion.id == portion_id,
        )
        .limit(1)
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def create_food_entry(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    portion_id: uuid.UUID,
    day: date,
    meal_type,
    amount,
    unit,
    device_id: uuid.UUID | None = None,
) -> FoodEntry | None:
    product = await get_product(session, user_id=user_id, product_id=product_id)
    if product is None:
        return None

    portion = await _get_portion(session, user_id=user_id, portion_id=portion_id)
    if portion is None or portion.product_id != product_id:
        return None

    entry = FoodEntry(
        device_id=device_id,
        user_id=user_id,
        created_on_device_id=device_id,
        product_id=product_id,
        portion_id=portion_id,
        day=day,
        meal_type=meal_type,
        amount=amount,
        unit=unit,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry


async def list_food_entries(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    day: date | None = None,
    from_day: date | None = None,
    to_day: date | None = None,
    device_id: uuid.UUID | None = None,
) -> list[FoodEntry]:
    stmt = _not_deleted(select(FoodEntry)).where(
        get_owner_filter(FoodEntry, user_id=user_id),
    )
    if day is not None:
        stmt = stmt.where(FoodEntry.day == day)
    if from_day is not None:
        stmt = stmt.where(FoodEntry.day >= from_day)
    if to_day is not None:
        stmt = stmt.where(FoodEntry.day <= to_day)
    stmt = stmt.order_by(FoodEntry.day.desc(), FoodEntry.created_at.desc())
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def get_food_entry(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    entry_id: uuid.UUID,
    device_id: uuid.UUID | None = None,
) -> FoodEntry | None:
    stmt = _not_deleted(select(FoodEntry)).where(
        get_owner_filter(FoodEntry, user_id=user_id),
        FoodEntry.id == entry_id,
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def update_food_entry(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    entry_id: uuid.UUID,
    patch: dict,
    device_id: uuid.UUID | None = None,
) -> FoodEntry | None:
    entry = await get_food_entry(session, user_id=user_id, entry_id=entry_id)
    if entry is None:
        return None

    if "portion_id" in patch:
        portion = await _get_portion(session, user_id=user_id, portion_id=patch["portion_id"])
        if portion is None or portion.product_id != entry.product_id:
            return None

    for k, v in patch.items():
        setattr(entry, k, v)
    entry.updated_at = datetime.now(UTC)
    if device_id is not None:
        entry.updated_on_device_id = device_id
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry


async def soft_delete_food_entry(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    entry_id: uuid.UUID,
    device_id: uuid.UUID | None = None,
) -> bool:
    entry = await get_food_entry(session, user_id=user_id, entry_id=entry_id)
    if entry is None:
        return False

    entry.deleted_at = datetime.now(UTC)
    entry.updated_at = datetime.now(UTC)
    session.add(entry)
    await session.commit()
    return True
