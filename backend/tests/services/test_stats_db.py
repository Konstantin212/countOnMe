"""Test stats service database operations."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.enums import MealType
from app.services.stats import get_day_stats
from tests.factories import create_device, create_food_entry, create_portion, create_product


@pytest.mark.asyncio
async def test_get_day_stats_empty(db_session: AsyncSession):
    """Test getting stats for a day with no entries."""
    device = await create_device(db_session)
    today = date.today()

    totals, by_meal = await get_day_stats(db_session, device_id=device.id, day=today)

    assert totals.calories == Decimal("0")
    assert totals.protein == Decimal("0")
    assert totals.carbs == Decimal("0")
    assert totals.fat == Decimal("0")
    assert by_meal == {}


@pytest.mark.asyncio
async def test_get_day_stats_single_entry(db_session: AsyncSession):
    """Test getting stats for a day with one entry."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)
    portion = await create_portion(
        db_session,
        device.id,
        product.id,
        calories=Decimal("200"),
        protein=Decimal("10"),
        carbs=Decimal("20"),
        fat=Decimal("5"),
        base_amount=Decimal("100"),
    )
    today = date.today()

    await create_food_entry(
        db_session,
        device.id,
        product.id,
        portion.id,
        day=today,
        meal_type=MealType.breakfast,
        amount=Decimal("100"),
    )

    totals, by_meal = await get_day_stats(db_session, device_id=device.id, day=today)

    assert totals.calories == Decimal("200")
    assert totals.protein == Decimal("10")
    assert MealType.breakfast in by_meal
    assert by_meal[MealType.breakfast].calories == Decimal("200")


@pytest.mark.asyncio
async def test_get_day_stats_multiple_entries(db_session: AsyncSession):
    """Test getting stats for a day with multiple entries."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)
    portion = await create_portion(
        db_session,
        device.id,
        product.id,
        calories=Decimal("100"),
        protein=Decimal("5"),
        carbs=Decimal("10"),
        fat=Decimal("2.5"),
        base_amount=Decimal("100"),
    )
    today = date.today()

    await create_food_entry(
        db_session,
        device.id,
        product.id,
        portion.id,
        day=today,
        meal_type=MealType.breakfast,
        amount=Decimal("100"),
    )
    await create_food_entry(
        db_session,
        device.id,
        product.id,
        portion.id,
        day=today,
        meal_type=MealType.lunch,
        amount=Decimal("200"),
    )

    totals, by_meal = await get_day_stats(db_session, device_id=device.id, day=today)

    # 100 + 200 = 300 calories
    assert totals.calories == Decimal("300")
    assert MealType.breakfast in by_meal
    assert MealType.lunch in by_meal
    assert by_meal[MealType.breakfast].calories == Decimal("100")
    assert by_meal[MealType.lunch].calories == Decimal("200")


@pytest.mark.asyncio
async def test_get_day_stats_by_meal_type(db_session: AsyncSession):
    """Test stats grouped by meal type."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)
    portion = await create_portion(
        db_session,
        device.id,
        product.id,
        calories=Decimal("100"),
        protein=Decimal("5"),
        carbs=Decimal("10"),
        fat=Decimal("2.5"),
        base_amount=Decimal("100"),
    )
    today = date.today()

    # Two breakfast entries
    await create_food_entry(
        db_session,
        device.id,
        product.id,
        portion.id,
        day=today,
        meal_type=MealType.breakfast,
        amount=Decimal("100"),
    )
    await create_food_entry(
        db_session,
        device.id,
        product.id,
        portion.id,
        day=today,
        meal_type=MealType.breakfast,
        amount=Decimal("50"),
    )

    totals, by_meal = await get_day_stats(db_session, device_id=device.id, day=today)

    assert totals.calories == Decimal("150")
    assert by_meal[MealType.breakfast].calories == Decimal("150")


@pytest.mark.asyncio
async def test_get_day_stats_excludes_deleted(db_session: AsyncSession):
    """Test that soft-deleted entries are excluded from stats."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)
    portion = await create_portion(
        db_session,
        device.id,
        product.id,
        calories=Decimal("100"),
        protein=Decimal("5"),
        carbs=Decimal("10"),
        fat=Decimal("2.5"),
        base_amount=Decimal("100"),
    )
    today = date.today()

    _entry1 = await create_food_entry(
        db_session,
        device.id,
        product.id,
        portion.id,
        day=today,
        amount=Decimal("100"),
    )
    entry2 = await create_food_entry(
        db_session,
        device.id,
        product.id,
        portion.id,
        day=today,
        amount=Decimal("100"),
    )

    # Soft delete entry2
    from app.services.food_entries import soft_delete_food_entry
    await soft_delete_food_entry(db_session, device_id=device.id, entry_id=entry2.id)

    totals, _by_meal = await get_day_stats(db_session, device_id=device.id, day=today)

    # Only entry1 should be counted
    assert totals.calories == Decimal("100")


@pytest.mark.asyncio
async def test_get_day_stats_device_scoped(db_session: AsyncSession):
    """Test that stats are scoped by device."""
    device1 = await create_device(db_session)
    device2 = await create_device(db_session)
    product1 = await create_product(db_session, device1.id)
    product2 = await create_product(db_session, device2.id)
    portion1 = await create_portion(db_session, device1.id, product1.id, calories=Decimal("100"))
    portion2 = await create_portion(db_session, device2.id, product2.id, calories=Decimal("200"))
    today = date.today()

    await create_food_entry(
        db_session, device1.id, product1.id, portion1.id,
        day=today, amount=Decimal("100")
    )
    await create_food_entry(
        db_session, device2.id, product2.id, portion2.id,
        day=today, amount=Decimal("100")
    )

    totals1, _ = await get_day_stats(db_session, device_id=device1.id, day=today)
    totals2, _ = await get_day_stats(db_session, device_id=device2.id, day=today)

    assert totals1.calories == Decimal("100")
    assert totals2.calories == Decimal("200")
