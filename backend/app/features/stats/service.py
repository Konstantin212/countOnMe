from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import MealType
from app.core.ownership import get_owner_filter
from app.features.catalog.models import CatalogPortion
from app.features.meals.models import FoodEntry
from app.features.portions.models import ProductPortion
from app.features.stats.calculation import MacroTotals, calc_totals_for_entry


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


def _accumulate(
    results: list,
    totals: MacroTotals,
    by_meal: dict[MealType, MacroTotals],
) -> tuple[MacroTotals, dict[MealType, MacroTotals]]:
    """Accumulate nutrition totals from (entry, portion) result pairs."""
    for entry, portion in results:
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
    return totals, by_meal


async def get_day_stats(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    day: date,
    device_id: uuid.UUID | None = None,
) -> tuple[MacroTotals, dict[MealType, MacroTotals]]:
    # Query 1: entries with private portions
    private_stmt = (
        select(FoodEntry, ProductPortion)
        .join(ProductPortion, ProductPortion.id == FoodEntry.portion_id)
        .where(
            get_owner_filter(FoodEntry, user_id=user_id),
            FoodEntry.deleted_at.is_(None),
            FoodEntry.day == day,
            FoodEntry.portion_id.is_not(None),
            ProductPortion.deleted_at.is_(None),
        )
    )

    # Query 2: entries with catalog portions
    catalog_stmt = (
        select(FoodEntry, CatalogPortion)
        .join(CatalogPortion, CatalogPortion.id == FoodEntry.catalog_portion_id)
        .where(
            get_owner_filter(FoodEntry, user_id=user_id),
            FoodEntry.deleted_at.is_(None),
            FoodEntry.day == day,
            FoodEntry.catalog_portion_id.is_not(None),
        )
    )

    private_res = await session.execute(private_stmt)
    catalog_res = await session.execute(catalog_stmt)

    totals = _zero()
    by_meal: dict[MealType, MacroTotals] = defaultdict(_zero)

    totals, by_meal = _accumulate(private_res.all(), totals, by_meal)
    totals, by_meal = _accumulate(catalog_res.all(), totals, by_meal)

    return totals, dict(by_meal)


async def get_daily_stats(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    from_day: date,
    to_day: date,
    device_id: uuid.UUID | None = None,
) -> list[tuple[date, MacroTotals]]:
    if to_day < from_day:
        return []

    out: list[tuple[date, MacroTotals]] = []
    cur = from_day
    while cur <= to_day:
        totals, _ = await get_day_stats(session, user_id=user_id, day=cur)
        out.append((cur, totals))
        cur += timedelta(days=1)
    return out
