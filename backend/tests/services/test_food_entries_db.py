"""Test food_entries service database operations."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.enums import MealType, Unit
from app.services.food_entries import (
    create_food_entry,
    get_food_entry,
    list_food_entries,
    soft_delete_food_entry,
    update_food_entry,
)
from tests.factories import create_device, create_portion, create_product
from tests.factories import create_food_entry as factory_create_entry


@pytest.mark.asyncio
async def test_create_food_entry_success(db_session: AsyncSession):
    """Test creating a food entry."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)
    portion = await create_portion(db_session, device.id, product.id)

    entry = await create_food_entry(
        db_session,
        device_id=device.id,
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
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)
    portion = await create_portion(db_session, device.id, product.id)

    result = await create_food_entry(
        db_session,
        device_id=device.id,
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
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)

    result = await create_food_entry(
        db_session,
        device_id=device.id,
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
    device = await create_device(db_session)
    product1 = await create_product(db_session, device.id)
    product2 = await create_product(db_session, device.id)
    portion = await create_portion(db_session, device.id, product1.id)

    result = await create_food_entry(
        db_session,
        device_id=device.id,
        product_id=product2.id,
        portion_id=portion.id,
        day=date.today(),
        meal_type=MealType.breakfast,
        amount=Decimal("100"),
        unit=Unit.g,
    )

    assert result is None


@pytest.mark.asyncio
async def test_create_food_entry_wrong_device(db_session: AsyncSession):
    """Test creating entry for another device's product fails."""
    device1 = await create_device(db_session)
    device2 = await create_device(db_session)
    product = await create_product(db_session, device1.id)
    portion = await create_portion(db_session, device1.id, product.id)

    result = await create_food_entry(
        db_session,
        device_id=device2.id,
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
    device = await create_device(db_session)

    entries = await list_food_entries(db_session, device_id=device.id)

    assert entries == []


@pytest.mark.asyncio
async def test_list_food_entries_by_day(db_session: AsyncSession):
    """Test filtering entries by day."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)
    portion = await create_portion(db_session, device.id, product.id)

    today = date.today()
    yesterday = today - timedelta(days=1)

    await factory_create_entry(db_session, device.id, product.id, portion.id, day=today)
    await factory_create_entry(db_session, device.id, product.id, portion.id, day=yesterday)

    entries = await list_food_entries(db_session, device_id=device.id, day=today)

    assert len(entries) == 1
    assert entries[0].day == today


@pytest.mark.asyncio
async def test_list_food_entries_date_range(db_session: AsyncSession):
    """Test filtering entries by date range."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)
    portion = await create_portion(db_session, device.id, product.id)

    today = date.today()
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)

    await factory_create_entry(db_session, device.id, product.id, portion.id, day=today)
    await factory_create_entry(db_session, device.id, product.id, portion.id, day=yesterday)
    await factory_create_entry(db_session, device.id, product.id, portion.id, day=two_days_ago)

    entries = await list_food_entries(
        db_session, device_id=device.id,
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
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)
    portion = await create_portion(db_session, device.id, product.id)

    entry1 = await factory_create_entry(db_session, device.id, product.id, portion.id)
    entry2 = await factory_create_entry(db_session, device.id, product.id, portion.id)

    await soft_delete_food_entry(db_session, device_id=device.id, entry_id=entry2.id)

    entries = await list_food_entries(db_session, device_id=device.id)

    assert len(entries) == 1
    assert entries[0].id == entry1.id


@pytest.mark.asyncio
async def test_list_food_entries_device_scoped(db_session: AsyncSession):
    """Test that entries are scoped by device."""
    device1 = await create_device(db_session)
    device2 = await create_device(db_session)
    product1 = await create_product(db_session, device1.id)
    product2 = await create_product(db_session, device2.id)
    portion1 = await create_portion(db_session, device1.id, product1.id)
    portion2 = await create_portion(db_session, device2.id, product2.id)

    await factory_create_entry(db_session, device1.id, product1.id, portion1.id)
    await factory_create_entry(db_session, device2.id, product2.id, portion2.id)

    entries1 = await list_food_entries(db_session, device_id=device1.id)
    entries2 = await list_food_entries(db_session, device_id=device2.id)

    assert len(entries1) == 1
    assert entries1[0].device_id == device1.id
    assert len(entries2) == 1
    assert entries2[0].device_id == device2.id


@pytest.mark.asyncio
async def test_get_food_entry_found(db_session: AsyncSession):
    """Test getting a food entry by ID."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)
    portion = await create_portion(db_session, device.id, product.id)
    entry = await factory_create_entry(db_session, device.id, product.id, portion.id)

    result = await get_food_entry(db_session, device_id=device.id, entry_id=entry.id)

    assert result is not None
    assert result.id == entry.id


@pytest.mark.asyncio
async def test_get_food_entry_not_found(db_session: AsyncSession):
    """Test getting a non-existent entry."""
    device = await create_device(db_session)

    result = await get_food_entry(db_session, device_id=device.id, entry_id=uuid.uuid4())

    assert result is None


@pytest.mark.asyncio
async def test_get_food_entry_wrong_device(db_session: AsyncSession):
    """Test that entries from other devices cannot be accessed."""
    device1 = await create_device(db_session)
    device2 = await create_device(db_session)
    product = await create_product(db_session, device1.id)
    portion = await create_portion(db_session, device1.id, product.id)
    entry = await factory_create_entry(db_session, device1.id, product.id, portion.id)

    result = await get_food_entry(db_session, device_id=device2.id, entry_id=entry.id)

    assert result is None


@pytest.mark.asyncio
async def test_get_food_entry_deleted(db_session: AsyncSession):
    """Test that soft-deleted entries cannot be retrieved."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)
    portion = await create_portion(db_session, device.id, product.id)
    entry = await factory_create_entry(db_session, device.id, product.id, portion.id)

    await soft_delete_food_entry(db_session, device_id=device.id, entry_id=entry.id)

    result = await get_food_entry(db_session, device_id=device.id, entry_id=entry.id)

    assert result is None


@pytest.mark.asyncio
async def test_update_food_entry_success(db_session: AsyncSession):
    """Test updating a food entry."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)
    portion = await create_portion(db_session, device.id, product.id)
    entry = await factory_create_entry(
        db_session, device.id, product.id, portion.id,
        amount=Decimal("100")
    )

    updated = await update_food_entry(
        db_session,
        device_id=device.id,
        entry_id=entry.id,
        patch={"amount": Decimal("200")},
    )

    assert updated is not None
    assert updated.amount == Decimal("200")


@pytest.mark.asyncio
async def test_update_food_entry_portion_validation(db_session: AsyncSession):
    """Test that updating portion_id validates it belongs to same product."""
    device = await create_device(db_session)
    product1 = await create_product(db_session, device.id)
    product2 = await create_product(db_session, device.id)
    portion1 = await create_portion(db_session, device.id, product1.id)
    portion2 = await create_portion(db_session, device.id, product2.id)
    entry = await factory_create_entry(db_session, device.id, product1.id, portion1.id)

    result = await update_food_entry(
        db_session,
        device_id=device.id,
        entry_id=entry.id,
        patch={"portion_id": portion2.id},  # Wrong product
    )

    assert result is None


@pytest.mark.asyncio
async def test_soft_delete_food_entry_success(db_session: AsyncSession):
    """Test soft deleting a food entry."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)
    portion = await create_portion(db_session, device.id, product.id)
    entry = await factory_create_entry(db_session, device.id, product.id, portion.id)

    result = await soft_delete_food_entry(db_session, device_id=device.id, entry_id=entry.id)

    assert result is True


@pytest.mark.asyncio
async def test_soft_delete_food_entry_not_found(db_session: AsyncSession):
    """Test soft deleting a non-existent entry."""
    device = await create_device(db_session)

    result = await soft_delete_food_entry(db_session, device_id=device.id, entry_id=uuid.uuid4())

    assert result is False
