"""Test body_weights service database operations."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.weights.service import (
    WeightConflict,
    create_body_weight,
    get_body_weight,
    get_body_weight_by_day,
    list_body_weights,
    soft_delete_body_weight,
    update_body_weight,
)
from tests.factories import create_body_weight as factory_create_weight
from tests.factories import create_user


@pytest.mark.asyncio
async def test_create_body_weight_success(db_session: AsyncSession):
    """Test creating a body weight entry."""
    user = await create_user(db_session)
    today = date.today()

    weight = await create_body_weight(
        db_session,
        user_id=user.id,
        day=today,
        weight_kg=Decimal("75.5"),
    )

    assert weight is not None
    assert weight.day == today
    assert weight.weight_kg == Decimal("75.5")


@pytest.mark.asyncio
async def test_create_body_weight_duplicate_day_raises(db_session: AsyncSession):
    """Test that creating duplicate weight for same day raises WeightConflict."""
    user = await create_user(db_session)
    # Use a unique day to avoid conflicts with other tests
    test_day = date(2025, 5, 15)

    # First weight
    await create_body_weight(
        db_session,
        user_id=user.id,
        day=test_day,
        weight_kg=Decimal("75"),
    )

    # Second weight on same day should raise
    with pytest.raises(WeightConflict):
        await create_body_weight(
            db_session,
            user_id=user.id,
            day=test_day,
            weight_kg=Decimal("76"),
        )


@pytest.mark.asyncio
async def test_list_body_weights_empty(db_session: AsyncSession):
    """Test listing weights when there are none."""
    user = await create_user(db_session)

    weights = await list_body_weights(db_session, user_id=user.id)

    assert weights == []


@pytest.mark.asyncio
async def test_list_body_weights_date_range(db_session: AsyncSession):
    """Test filtering weights by date range."""
    user = await create_user(db_session)
    today = date.today()
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)

    await factory_create_weight(db_session, user_id=user.id, day=today, weight_kg=Decimal("75"))
    await factory_create_weight(db_session, user_id=user.id, day=yesterday, weight_kg=Decimal("76"))
    await factory_create_weight(db_session, user_id=user.id, day=two_days_ago, weight_kg=Decimal("77"))

    weights = await list_body_weights(
        db_session, user_id=user.id,
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
    user = await create_user(db_session)
    today = date.today()
    yesterday = today - timedelta(days=1)

    await factory_create_weight(db_session, user_id=user.id, day=today, weight_kg=Decimal("75"))
    await factory_create_weight(db_session, user_id=user.id, day=yesterday, weight_kg=Decimal("76"))

    weights = await list_body_weights(db_session, user_id=user.id)

    assert len(weights) == 2
    assert weights[0].day == yesterday
    assert weights[1].day == today


@pytest.mark.asyncio
async def test_list_body_weights_user_scoped(db_session: AsyncSession):
    """Test that weights are scoped by user."""
    user1 = await create_user(db_session)
    user2 = await create_user(db_session)

    await factory_create_weight(db_session, user_id=user1.id)
    await factory_create_weight(db_session, user_id=user2.id)

    weights1 = await list_body_weights(db_session, user_id=user1.id)
    weights2 = await list_body_weights(db_session, user_id=user2.id)

    assert len(weights1) == 1
    assert weights1[0].user_id == user1.id
    assert len(weights2) == 1
    assert weights2[0].user_id == user2.id


@pytest.mark.asyncio
async def test_get_body_weight_found(db_session: AsyncSession):
    """Test getting a weight by ID."""
    user = await create_user(db_session)
    weight = await factory_create_weight(db_session, user_id=user.id)

    result = await get_body_weight(db_session, user_id=user.id, weight_id=weight.id)

    assert result is not None
    assert result.id == weight.id


@pytest.mark.asyncio
async def test_get_body_weight_not_found(db_session: AsyncSession):
    """Test getting a non-existent weight."""
    user = await create_user(db_session)

    result = await get_body_weight(db_session, user_id=user.id, weight_id=uuid.uuid4())

    assert result is None


@pytest.mark.asyncio
async def test_get_body_weight_by_day_found(db_session: AsyncSession):
    """Test getting a weight by day."""
    user = await create_user(db_session)
    today = date.today()
    weight = await factory_create_weight(db_session, user_id=user.id, day=today)

    result = await get_body_weight_by_day(db_session, user_id=user.id, day=today)

    assert result is not None
    assert result.id == weight.id


@pytest.mark.asyncio
async def test_get_body_weight_by_day_not_found(db_session: AsyncSession):
    """Test getting a weight for a day with no entry."""
    user = await create_user(db_session)
    today = date.today()

    result = await get_body_weight_by_day(db_session, user_id=user.id, day=today)

    assert result is None


@pytest.mark.asyncio
async def test_update_body_weight_success(db_session: AsyncSession):
    """Test updating a body weight."""
    user = await create_user(db_session)
    weight = await factory_create_weight(db_session, user_id=user.id, weight_kg=Decimal("75"))

    updated = await update_body_weight(
        db_session,
        user_id=user.id,
        weight_id=weight.id,
        weight_kg=Decimal("76"),
    )

    assert updated is not None
    assert updated.weight_kg == Decimal("76")


@pytest.mark.asyncio
async def test_update_body_weight_not_found(db_session: AsyncSession):
    """Test updating a non-existent weight."""
    user = await create_user(db_session)

    result = await update_body_weight(
        db_session,
        user_id=user.id,
        weight_id=uuid.uuid4(),
        weight_kg=Decimal("75"),
    )

    assert result is None


@pytest.mark.asyncio
async def test_soft_delete_body_weight_success(db_session: AsyncSession):
    """Test soft deleting a body weight."""
    user = await create_user(db_session)
    weight = await factory_create_weight(db_session, user_id=user.id)

    result = await soft_delete_body_weight(db_session, user_id=user.id, weight_id=weight.id)

    assert result is True


@pytest.mark.asyncio
async def test_soft_delete_body_weight_not_found(db_session: AsyncSession):
    """Test soft deleting a non-existent weight."""
    user = await create_user(db_session)

    result = await soft_delete_body_weight(db_session, user_id=user.id, weight_id=uuid.uuid4())

    assert result is False
