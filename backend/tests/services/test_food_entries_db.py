"""Test food_entries service database operations."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import MealType, Unit
from app.features.meals.service import (
    create_food_entry,
    get_food_entry,
    list_food_entries,
    soft_delete_food_entry,
    update_food_entry,
)
from tests.factories import create_food_entry as factory_create_entry
from tests.factories import create_portion, create_product, create_user


@pytest.mark.asyncio
async def test_create_food_entry_success(db_session: AsyncSession):
    """Test creating a food entry."""
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    portion = await create_portion(db_session, user_id=user.id, product_id=product.id)

    entry = await create_food_entry(
        db_session,
        user_id=user.id,
        product_id=product.id,
        portion_id=portion.id,
        day=date.today(),
        meal_type=MealType.breakfast,
        amount=Decimal("100"),
        unit=Unit.g,
    )

    assert entry is not None
    assert entry.product_id == product.id
    assert entry.portion_id == portion.id
    assert entry.meal_type == MealType.breakfast


@pytest.mark.asyncio
async def test_create_food_entry_product_not_found(db_session: AsyncSession):
    """Test creating entry for non-existent product returns None."""
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    portion = await create_portion(db_session, user_id=user.id, product_id=product.id)

    result = await create_food_entry(
        db_session,
        user_id=user.id,
        product_id=uuid.uuid4(),
        portion_id=portion.id,
        day=date.today(),
        meal_type=MealType.breakfast,
        amount=Decimal("100"),
        unit=Unit.g,
    )

    assert result is None


@pytest.mark.asyncio
async def test_create_food_entry_portion_not_found(db_session: AsyncSession):
    """Test creating entry for non-existent portion returns None."""
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)

    result = await create_food_entry(
        db_session,
        user_id=user.id,
        product_id=product.id,
        portion_id=uuid.uuid4(),
        day=date.today(),
        meal_type=MealType.breakfast,
        amount=Decimal("100"),
        unit=Unit.g,
    )

    assert result is None


@pytest.mark.asyncio
async def test_create_food_entry_portion_wrong_product(db_session: AsyncSession):
    """Test creating entry when portion belongs to different product returns None."""
    user = await create_user(db_session)
    product1 = await create_product(db_session, user_id=user.id)
    product2 = await create_product(db_session, user_id=user.id)
    portion = await create_portion(db_session, user_id=user.id, product_id=product1.id)

    result = await create_food_entry(
        db_session,
        user_id=user.id,
        product_id=product2.id,
        portion_id=portion.id,
        day=date.today(),
        meal_type=MealType.breakfast,
        amount=Decimal("100"),
        unit=Unit.g,
    )

    assert result is None


@pytest.mark.asyncio
async def test_create_food_entry_wrong_user(db_session: AsyncSession):
    """Test creating entry for another user's product fails."""
    user1 = await create_user(db_session)
    user2 = await create_user(db_session)
    product = await create_product(db_session, user_id=user1.id)
    portion = await create_portion(db_session, user_id=user1.id, product_id=product.id)

    result = await create_food_entry(
        db_session,
        user_id=user2.id,
        product_id=product.id,
        portion_id=portion.id,
        day=date.today(),
        meal_type=MealType.breakfast,
        amount=Decimal("100"),
        unit=Unit.g,
    )

    assert result is None


@pytest.mark.asyncio
async def test_list_food_entries_empty(db_session: AsyncSession):
    """Test listing entries when there are none."""
    user = await create_user(db_session)

    entries = await list_food_entries(db_session, user_id=user.id)

    assert entries == []


@pytest.mark.asyncio
async def test_list_food_entries_by_day(db_session: AsyncSession):
    """Test filtering entries by day."""
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    portion = await create_portion(db_session, user_id=user.id, product_id=product.id)

    today = date.today()
    yesterday = today - timedelta(days=1)

    await factory_create_entry(db_session, user_id=user.id, product_id=product.id, portion_id=portion.id, day=today)
    await factory_create_entry(db_session, user_id=user.id, product_id=product.id, portion_id=portion.id, day=yesterday)

    entries = await list_food_entries(db_session, user_id=user.id, day=today)

    assert len(entries) == 1
    assert entries[0].day == today


@pytest.mark.asyncio
async def test_list_food_entries_date_range(db_session: AsyncSession):
    """Test filtering entries by date range."""
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    portion = await create_portion(db_session, user_id=user.id, product_id=product.id)

    today = date.today()
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)

    await factory_create_entry(db_session, user_id=user.id, product_id=product.id, portion_id=portion.id, day=today)
    await factory_create_entry(db_session, user_id=user.id, product_id=product.id, portion_id=portion.id, day=yesterday)
    await factory_create_entry(db_session, user_id=user.id, product_id=product.id, portion_id=portion.id, day=two_days_ago)

    entries = await list_food_entries(
        db_session, user_id=user.id,
        from_day=yesterday, to_day=today
    )

    assert len(entries) == 2
    days = [e.day for e in entries]
    assert today in days
    assert yesterday in days
    assert two_days_ago not in days


@pytest.mark.asyncio
async def test_list_food_entries_excludes_deleted(db_session: AsyncSession):
    """Test that soft-deleted entries are not listed."""
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    portion = await create_portion(db_session, user_id=user.id, product_id=product.id)

    entry1 = await factory_create_entry(db_session, user_id=user.id, product_id=product.id, portion_id=portion.id)
    entry2 = await factory_create_entry(db_session, user_id=user.id, product_id=product.id, portion_id=portion.id)

    await soft_delete_food_entry(db_session, user_id=user.id, entry_id=entry2.id)

    entries = await list_food_entries(db_session, user_id=user.id)

    assert len(entries) == 1
    assert entries[0].id == entry1.id


@pytest.mark.asyncio
async def test_list_food_entries_user_scoped(db_session: AsyncSession):
    """Test that entries are scoped by user."""
    user1 = await create_user(db_session)
    user2 = await create_user(db_session)
    product1 = await create_product(db_session, user_id=user1.id)
    product2 = await create_product(db_session, user_id=user2.id)
    portion1 = await create_portion(db_session, user_id=user1.id, product_id=product1.id)
    portion2 = await create_portion(db_session, user_id=user2.id, product_id=product2.id)

    await factory_create_entry(db_session, user_id=user1.id, product_id=product1.id, portion_id=portion1.id)
    await factory_create_entry(db_session, user_id=user2.id, product_id=product2.id, portion_id=portion2.id)

    entries1 = await list_food_entries(db_session, user_id=user1.id)
    entries2 = await list_food_entries(db_session, user_id=user2.id)

    assert len(entries1) == 1
    assert entries1[0].user_id == user1.id
    assert len(entries2) == 1
    assert entries2[0].user_id == user2.id


@pytest.mark.asyncio
async def test_get_food_entry_found(db_session: AsyncSession):
    """Test getting a food entry by ID."""
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    portion = await create_portion(db_session, user_id=user.id, product_id=product.id)
    entry = await factory_create_entry(db_session, user_id=user.id, product_id=product.id, portion_id=portion.id)

    result = await get_food_entry(db_session, user_id=user.id, entry_id=entry.id)

    assert result is not None
    assert result.id == entry.id


@pytest.mark.asyncio
async def test_get_food_entry_not_found(db_session: AsyncSession):
    """Test getting a non-existent entry."""
    user = await create_user(db_session)

    result = await get_food_entry(db_session, user_id=user.id, entry_id=uuid.uuid4())

    assert result is None


@pytest.mark.asyncio
async def test_get_food_entry_wrong_user(db_session: AsyncSession):
    """Test that entries from other users cannot be accessed."""
    user1 = await create_user(db_session)
    user2 = await create_user(db_session)
    product = await create_product(db_session, user_id=user1.id)
    portion = await create_portion(db_session, user_id=user1.id, product_id=product.id)
    entry = await factory_create_entry(db_session, user_id=user1.id, product_id=product.id, portion_id=portion.id)

    result = await get_food_entry(db_session, user_id=user2.id, entry_id=entry.id)

    assert result is None


@pytest.mark.asyncio
async def test_get_food_entry_deleted(db_session: AsyncSession):
    """Test that soft-deleted entries cannot be retrieved."""
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    portion = await create_portion(db_session, user_id=user.id, product_id=product.id)
    entry = await factory_create_entry(db_session, user_id=user.id, product_id=product.id, portion_id=portion.id)

    await soft_delete_food_entry(db_session, user_id=user.id, entry_id=entry.id)

    result = await get_food_entry(db_session, user_id=user.id, entry_id=entry.id)

    assert result is None


@pytest.mark.asyncio
async def test_update_food_entry_success(db_session: AsyncSession):
    """Test updating a food entry."""
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    portion = await create_portion(db_session, user_id=user.id, product_id=product.id)
    entry = await factory_create_entry(
        db_session, user_id=user.id, product_id=product.id, portion_id=portion.id,
        amount=Decimal("100")
    )

    updated = await update_food_entry(
        db_session,
        user_id=user.id,
        entry_id=entry.id,
        patch={"amount": Decimal("200")},
    )

    assert updated is not None
    assert updated.amount == Decimal("200")


@pytest.mark.asyncio
async def test_update_food_entry_portion_validation(db_session: AsyncSession):
    """Test that updating portion_id validates it belongs to same product."""
    user = await create_user(db_session)
    product1 = await create_product(db_session, user_id=user.id)
    product2 = await create_product(db_session, user_id=user.id)
    portion1 = await create_portion(db_session, user_id=user.id, product_id=product1.id)
    portion2 = await create_portion(db_session, user_id=user.id, product_id=product2.id)
    entry = await factory_create_entry(db_session, user_id=user.id, product_id=product1.id, portion_id=portion1.id)

    result = await update_food_entry(
        db_session,
        user_id=user.id,
        entry_id=entry.id,
        patch={"portion_id": portion2.id},  # Wrong product
    )

    assert result is None


@pytest.mark.asyncio
async def test_soft_delete_food_entry_success(db_session: AsyncSession):
    """Test soft deleting a food entry."""
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    portion = await create_portion(db_session, user_id=user.id, product_id=product.id)
    entry = await factory_create_entry(db_session, user_id=user.id, product_id=product.id, portion_id=portion.id)

    result = await soft_delete_food_entry(db_session, user_id=user.id, entry_id=entry.id)

    assert result is True


@pytest.mark.asyncio
async def test_soft_delete_food_entry_not_found(db_session: AsyncSession):
    """Test soft deleting a non-existent entry."""
    user = await create_user(db_session)

    result = await soft_delete_food_entry(db_session, user_id=user.id, entry_id=uuid.uuid4())

    assert result is False
