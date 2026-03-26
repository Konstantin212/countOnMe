"""Test stats service database operations."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import MealType
from app.features.stats.service import get_day_stats
from tests.factories import create_food_entry, create_portion, create_product, create_user


@pytest.mark.asyncio
async def test_get_day_stats_empty(db_session: AsyncSession):
    """Test getting stats for a day with no entries."""
    user = await create_user(db_session)
    today = date.today()

    totals, by_meal = await get_day_stats(db_session, user_id=user.id, day=today)

    assert totals.calories == Decimal("0")
    assert totals.protein == Decimal("0")
    assert totals.carbs == Decimal("0")
    assert totals.fat == Decimal("0")
    assert by_meal == {}


@pytest.mark.asyncio
async def test_get_day_stats_single_entry(db_session: AsyncSession):
    """Test getting stats for a day with one entry."""
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    portion = await create_portion(
        db_session,
        user_id=user.id,
        product_id=product.id,
        calories=Decimal("200"),
        protein=Decimal("10"),
        carbs=Decimal("20"),
        fat=Decimal("5"),
        base_amount=Decimal("100"),
    )
    today = date.today()

    await create_food_entry(
        db_session,
        user_id=user.id,
        product_id=product.id,
        portion_id=portion.id,
        day=today,
        meal_type=MealType.breakfast,
        amount=Decimal("100"),
    )

    totals, by_meal = await get_day_stats(db_session, user_id=user.id, day=today)

    assert totals.calories == Decimal("200")
    assert totals.protein == Decimal("10")
    assert MealType.breakfast in by_meal
    assert by_meal[MealType.breakfast].calories == Decimal("200")


@pytest.mark.asyncio
async def test_get_day_stats_multiple_entries(db_session: AsyncSession):
    """Test getting stats for a day with multiple entries."""
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    portion = await create_portion(
        db_session,
        user_id=user.id,
        product_id=product.id,
        calories=Decimal("100"),
        protein=Decimal("5"),
        carbs=Decimal("10"),
        fat=Decimal("2.5"),
        base_amount=Decimal("100"),
    )
    today = date.today()

    await create_food_entry(
        db_session,
        user_id=user.id,
        product_id=product.id,
        portion_id=portion.id,
        day=today,
        meal_type=MealType.breakfast,
        amount=Decimal("100"),
    )
    await create_food_entry(
        db_session,
        user_id=user.id,
        product_id=product.id,
        portion_id=portion.id,
        day=today,
        meal_type=MealType.lunch,
        amount=Decimal("200"),
    )

    totals, by_meal = await get_day_stats(db_session, user_id=user.id, day=today)

    # 100 + 200 = 300 calories
    assert totals.calories == Decimal("300")
    assert MealType.breakfast in by_meal
    assert MealType.lunch in by_meal
    assert by_meal[MealType.breakfast].calories == Decimal("100")
    assert by_meal[MealType.lunch].calories == Decimal("200")


@pytest.mark.asyncio
async def test_get_day_stats_by_meal_type(db_session: AsyncSession):
    """Test stats grouped by meal type."""
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    portion = await create_portion(
        db_session,
        user_id=user.id,
        product_id=product.id,
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
        user_id=user.id,
        product_id=product.id,
        portion_id=portion.id,
        day=today,
        meal_type=MealType.breakfast,
        amount=Decimal("100"),
    )
    await create_food_entry(
        db_session,
        user_id=user.id,
        product_id=product.id,
        portion_id=portion.id,
        day=today,
        meal_type=MealType.breakfast,
        amount=Decimal("50"),
    )

    totals, by_meal = await get_day_stats(db_session, user_id=user.id, day=today)

    assert totals.calories == Decimal("150")
    assert by_meal[MealType.breakfast].calories == Decimal("150")


@pytest.mark.asyncio
async def test_get_day_stats_excludes_deleted(db_session: AsyncSession):
    """Test that soft-deleted entries are excluded from stats."""
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    portion = await create_portion(
        db_session,
        user_id=user.id,
        product_id=product.id,
        calories=Decimal("100"),
        protein=Decimal("5"),
        carbs=Decimal("10"),
        fat=Decimal("2.5"),
        base_amount=Decimal("100"),
    )
    today = date.today()

    _entry1 = await create_food_entry(
        db_session,
        user_id=user.id,
        product_id=product.id,
        portion_id=portion.id,
        day=today,
        amount=Decimal("100"),
    )
    entry2 = await create_food_entry(
        db_session,
        user_id=user.id,
        product_id=product.id,
        portion_id=portion.id,
        day=today,
        amount=Decimal("100"),
    )

    # Soft delete entry2
    from app.features.meals.service import soft_delete_food_entry
    await soft_delete_food_entry(db_session, user_id=user.id, entry_id=entry2.id)

    totals, _by_meal = await get_day_stats(db_session, user_id=user.id, day=today)

    # Only entry1 should be counted
    assert totals.calories == Decimal("100")


@pytest.mark.asyncio
async def test_get_day_stats_user_scoped(db_session: AsyncSession):
    """Test that stats are scoped by user."""
    user1 = await create_user(db_session)
    user2 = await create_user(db_session)
    product1 = await create_product(db_session, user_id=user1.id)
    product2 = await create_product(db_session, user_id=user2.id)
    portion1 = await create_portion(db_session, user_id=user1.id, product_id=product1.id, calories=Decimal("100"))
    portion2 = await create_portion(db_session, user_id=user2.id, product_id=product2.id, calories=Decimal("200"))
    today = date.today()

    await create_food_entry(
        db_session, user_id=user1.id, product_id=product1.id, portion_id=portion1.id,
        day=today, amount=Decimal("100")
    )
    await create_food_entry(
        db_session, user_id=user2.id, product_id=product2.id, portion_id=portion2.id,
        day=today, amount=Decimal("100")
    )

    totals1, _ = await get_day_stats(db_session, user_id=user1.id, day=today)
    totals2, _ = await get_day_stats(db_session, user_id=user2.id, day=today)

    assert totals1.calories == Decimal("100")
    assert totals2.calories == Decimal("200")
