from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food_entry import FoodEntry
from app.models.product_portion import ProductPortion
from app.schemas.enums import MealType
from app.services.calculation import MacroTotals, calc_totals_for_entry


def _zero() -> MacroTotals:
    return MacroTotals(
        calories=Decimal("0"),
        protein=Decimal("0"),
        carbs=Decimal("0"),
        fat=Decimal("0"),
    )


def _add(a: MacroTotals, b: MacroTotals) -> MacroTotals:
    return MacroTotals(
        calories=a.calories + b.calories,
        protein=a.protein + b.protein,
        carbs=a.carbs + b.carbs,
        fat=a.fat + b.fat,
    )


async def get_day_stats(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    day: date,
) -> tuple[MacroTotals, dict[MealType, MacroTotals]]:
    stmt = (
        select(FoodEntry, ProductPortion)
        .join(ProductPortion, ProductPortion.id == FoodEntry.portion_id)
        .where(
            FoodEntry.device_id == device_id,
            FoodEntry.deleted_at.is_(None),
            FoodEntry.day == day,
            ProductPortion.deleted_at.is_(None),
        )
    )
    res = await session.execute(stmt)

    totals = _zero()
    by_meal: dict[MealType, MacroTotals] = defaultdict(_zero)

    for entry, portion in res.all():
        entry_totals = calc_totals_for_entry(
            entry_amount=entry.amount,
            entry_unit=entry.unit,
            portion_base_amount=portion.base_amount,
            portion_base_unit=portion.base_unit,
            portion_calories=portion.calories,
            portion_protein=portion.protein,
            portion_carbs=portion.carbs,
            portion_fat=portion.fat,
        )
        totals = _add(totals, entry_totals)
        by_meal[entry.meal_type] = _add(by_meal[entry.meal_type], entry_totals)

    return totals, dict(by_meal)


async def get_daily_stats(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    from_day: date,
    to_day: date,
) -> list[tuple[date, MacroTotals]]:
    if to_day < from_day:
        return []

    out: list[tuple[date, MacroTotals]] = []
    cur = from_day
    while cur <= to_day:
        totals, _ = await get_day_stats(session, device_id=device_id, day=cur)
        out.append((cur, totals))
        cur += timedelta(days=1)
    return out

