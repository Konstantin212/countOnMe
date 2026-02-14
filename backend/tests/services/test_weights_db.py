"""Test body_weights service database operations."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.weights import (
    WeightConflict,
    create_body_weight,
    get_body_weight,
    get_body_weight_by_day,
    list_body_weights,
    soft_delete_body_weight,
    update_body_weight,
)
from tests.factories import create_body_weight as factory_create_weight
from tests.factories import create_device


@pytest.mark.asyncio
async def test_create_body_weight_success(db_session: AsyncSession):
    """Test creating a body weight entry."""
    device = await create_device(db_session)
    today = date.today()

    weight = await create_body_weight(
        db_session,
        device_id=device.id,
        day=today,
        weight_kg=Decimal("75.5"),
    )

    assert weight is not None
    assert weight.day == today
    assert weight.weight_kg == Decimal("75.5")


@pytest.mark.asyncio
async def test_create_body_weight_duplicate_day_raises(db_session: AsyncSession):
    """Test that creating duplicate weight for same day raises WeightConflict."""
    device = await create_device(db_session)
    # Use a unique day to avoid conflicts with other tests
    test_day = date(2025, 5, 15)

    # First weight
    await create_body_weight(
        db_session,
        device_id=device.id,
        day=test_day,
        weight_kg=Decimal("75"),
    )

    # Second weight on same day should raise
    with pytest.raises(WeightConflict):
        await create_body_weight(
            db_session,
            device_id=device.id,
            day=test_day,
            weight_kg=Decimal("76"),
        )


@pytest.mark.asyncio
async def test_list_body_weights_empty(db_session: AsyncSession):
    """Test listing weights when there are none."""
    device = await create_device(db_session)

    weights = await list_body_weights(db_session, device_id=device.id)

    assert weights == []


@pytest.mark.asyncio
async def test_list_body_weights_date_range(db_session: AsyncSession):
    """Test filtering weights by date range."""
    device = await create_device(db_session)
    today = date.today()
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)

    await factory_create_weight(db_session, device.id, day=today, weight_kg=Decimal("75"))
    await factory_create_weight(db_session, device.id, day=yesterday, weight_kg=Decimal("76"))
    await factory_create_weight(db_session, device.id, day=two_days_ago, weight_kg=Decimal("77"))

    weights = await list_body_weights(
        db_session, device_id=device.id,
        from_day=yesterday, to_day=today
    )

    assert len(weights) == 2
    days = [w.day for w in weights]
    assert yesterday in days
    assert today in days
    assert two_days_ago not in days


@pytest.mark.asyncio
async def test_list_body_weights_ordered(db_session: AsyncSession):
    """Test that weights are ordered by day ascending."""
    device = await create_device(db_session)
    today = date.today()
    yesterday = today - timedelta(days=1)

    await factory_create_weight(db_session, device.id, day=today, weight_kg=Decimal("75"))
    await factory_create_weight(db_session, device.id, day=yesterday, weight_kg=Decimal("76"))

    weights = await list_body_weights(db_session, device_id=device.id)

    assert len(weights) == 2
    assert weights[0].day == yesterday
    assert weights[1].day == today


@pytest.mark.asyncio
async def test_list_body_weights_device_scoped(db_session: AsyncSession):
    """Test that weights are scoped by device."""
    device1 = await create_device(db_session)
    device2 = await create_device(db_session)

    await factory_create_weight(db_session, device1.id)
    await factory_create_weight(db_session, device2.id)

    weights1 = await list_body_weights(db_session, device_id=device1.id)
    weights2 = await list_body_weights(db_session, device_id=device2.id)

    assert len(weights1) == 1
    assert weights1[0].device_id == device1.id
    assert len(weights2) == 1
    assert weights2[0].device_id == device2.id


@pytest.mark.asyncio
async def test_get_body_weight_found(db_session: AsyncSession):
    """Test getting a weight by ID."""
    device = await create_device(db_session)
    weight = await factory_create_weight(db_session, device.id)

    result = await get_body_weight(db_session, device_id=device.id, weight_id=weight.id)

    assert result is not None
    assert result.id == weight.id


@pytest.mark.asyncio
async def test_get_body_weight_not_found(db_session: AsyncSession):
    """Test getting a non-existent weight."""
    device = await create_device(db_session)

    result = await get_body_weight(db_session, device_id=device.id, weight_id=uuid.uuid4())

    assert result is None


@pytest.mark.asyncio
async def test_get_body_weight_by_day_found(db_session: AsyncSession):
    """Test getting a weight by day."""
    device = await create_device(db_session)
    today = date.today()
    weight = await factory_create_weight(db_session, device.id, day=today)

    result = await get_body_weight_by_day(db_session, device_id=device.id, day=today)

    assert result is not None
    assert result.id == weight.id


@pytest.mark.asyncio
async def test_get_body_weight_by_day_not_found(db_session: AsyncSession):
    """Test getting a weight for a day with no entry."""
    device = await create_device(db_session)
    today = date.today()

    result = await get_body_weight_by_day(db_session, device_id=device.id, day=today)

    assert result is None


@pytest.mark.asyncio
async def test_update_body_weight_success(db_session: AsyncSession):
    """Test updating a body weight."""
    device = await create_device(db_session)
    weight = await factory_create_weight(db_session, device.id, weight_kg=Decimal("75"))

    updated = await update_body_weight(
        db_session,
        device_id=device.id,
        weight_id=weight.id,
        weight_kg=Decimal("76"),
    )

    assert updated is not None
    assert updated.weight_kg == Decimal("76")


@pytest.mark.asyncio
async def test_update_body_weight_not_found(db_session: AsyncSession):
    """Test updating a non-existent weight."""
    device = await create_device(db_session)

    result = await update_body_weight(
        db_session,
        device_id=device.id,
        weight_id=uuid.uuid4(),
        weight_kg=Decimal("75"),
    )

    assert result is None


@pytest.mark.asyncio
async def test_soft_delete_body_weight_success(db_session: AsyncSession):
    """Test soft deleting a body weight."""
    device = await create_device(db_session)
    weight = await factory_create_weight(db_session, device.id)

    result = await soft_delete_body_weight(db_session, device_id=device.id, weight_id=weight.id)

    assert result is True


@pytest.mark.asyncio
async def test_soft_delete_body_weight_not_found(db_session: AsyncSession):
    """Test soft deleting a non-existent weight."""
    device = await create_device(db_session)

    result = await soft_delete_body_weight(db_session, device_id=device.id, weight_id=uuid.uuid4())

    assert result is False
