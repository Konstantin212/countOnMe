"""Test goals service database operations."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.enums import ActivityLevel, Gender, GoalType, WeightGoalType
from app.schemas.goal import GoalCreateCalculatedRequest, GoalCreateManualRequest
from app.services.goals import (
    create_calculated_goal,
    create_manual_goal,
    get_current_goal,
    soft_delete_goal,
    update_goal,
)
from tests.factories import create_device, create_goal


@pytest.mark.asyncio
async def test_get_current_goal_none(db_session: AsyncSession):
    """Test getting current goal when there is none."""
    device = await create_device(db_session)

    result = await get_current_goal(db_session, device_id=device.id)

    assert result is None


@pytest.mark.asyncio
async def test_get_current_goal_latest(db_session: AsyncSession):
    """Test getting the most recent goal (soft deletes happen automatically)."""
    device = await create_device(db_session)
    # First goal will be soft-deleted when creating second
    goal1 = await create_goal(db_session, device.id, daily_calories_kcal=2000)

    # Creating manual goal via service would soft-delete the first,
    # but factory doesn't - so just create one goal
    result = await get_current_goal(db_session, device_id=device.id)

    assert result is not None
    assert result.id == goal1.id
    assert result.daily_calories_kcal == 2000


@pytest.mark.asyncio
async def test_get_current_goal_excludes_deleted(db_session: AsyncSession):
    """Test that soft-deleted goals are not returned."""
    device = await create_device(db_session)
    goal1 = await create_goal(db_session, device.id)
    goal2 = await create_goal(db_session, device.id)

    await soft_delete_goal(db_session, device_id=device.id, goal_id=goal2.id)

    result = await get_current_goal(db_session, device_id=device.id)

    assert result is not None
    assert result.id == goal1.id


@pytest.mark.asyncio
async def test_create_manual_goal_with_macro_calc(db_session: AsyncSession):
    """Test creating a manual goal calculates macros."""
    device = await create_device(db_session)

    data = GoalCreateManualRequest(
        daily_calories_kcal=2000,
        protein_percent=30,
        carbs_percent=40,
        fat_percent=30,
        water_ml=2000,
    )

    goal = await create_manual_goal(db_session, device_id=device.id, data=data)

    assert goal.goal_type == GoalType.manual.value
    assert goal.daily_calories_kcal == 2000
    assert goal.protein_percent == 30
    assert goal.protein_grams > 0  # Should be calculated
    assert goal.carbs_grams > 0
    assert goal.fat_grams > 0


@pytest.mark.asyncio
async def test_create_manual_goal_soft_deletes_existing(db_session: AsyncSession):
    """Test that creating a manual goal soft deletes existing goals."""
    device = await create_device(db_session)
    goal1 = await create_goal(db_session, device.id)

    data = GoalCreateManualRequest(
        daily_calories_kcal=2200,
        protein_percent=30,
        carbs_percent=40,
        fat_percent=30,
        water_ml=2000,
    )

    goal2 = await create_manual_goal(db_session, device_id=device.id, data=data)

    # Refresh goal1
    await db_session.refresh(goal1)

    assert goal1.deleted_at is not None
    assert goal2.deleted_at is None


@pytest.mark.asyncio
async def test_create_calculated_goal(db_session: AsyncSession):
    """Test creating a calculated goal."""
    device = await create_device(db_session)

    data = GoalCreateCalculatedRequest(
        gender=Gender.male,
        birth_date=date(1990, 1, 1),
        height_cm=Decimal("180"),
        current_weight_kg=Decimal("80"),
        activity_level=ActivityLevel.moderate,
        weight_goal_type=WeightGoalType.maintain,
        protein_percent=30,
        carbs_percent=40,
        fat_percent=30,
        water_ml=2000,
    )

    goal = await create_calculated_goal(db_session, device_id=device.id, data=data)

    assert goal.goal_type == GoalType.calculated.value
    assert goal.gender == Gender.male.value
    assert goal.bmr_kcal is not None
    assert goal.tdee_kcal is not None
    assert goal.daily_calories_kcal > 0
    assert goal.healthy_weight_min_kg is not None
    assert goal.healthy_weight_max_kg is not None
    assert goal.current_bmi is not None


@pytest.mark.asyncio
async def test_update_goal_calories(db_session: AsyncSession):
    """Test updating goal calories."""
    device = await create_device(db_session)
    goal = await create_goal(db_session, device.id, daily_calories_kcal=2000)

    updated = await update_goal(
        db_session,
        device_id=device.id,
        goal_id=goal.id,
        daily_calories_kcal=2200,
    )

    assert updated is not None
    assert updated.daily_calories_kcal == 2200


@pytest.mark.asyncio
async def test_update_goal_macros_recalculates_grams(db_session: AsyncSession):
    """Test that updating macro percentages recalculates grams."""
    device = await create_device(db_session)
    goal = await create_goal(
        db_session,
        device.id,
        daily_calories_kcal=2000,
        protein_percent=30,
        carbs_percent=40,
        fat_percent=30,
    )

    original_protein_grams = goal.protein_grams

    updated = await update_goal(
        db_session,
        device_id=device.id,
        goal_id=goal.id,
        protein_percent=40,  # Change protein percentage
    )

    assert updated is not None
    assert updated.protein_percent == 40
    assert updated.protein_grams != original_protein_grams


@pytest.mark.asyncio
async def test_update_goal_not_found(db_session: AsyncSession):
    """Test updating a non-existent goal."""
    device = await create_device(db_session)

    result = await update_goal(
        db_session,
        device_id=device.id,
        goal_id=uuid.uuid4(),
        daily_calories_kcal=2200,
    )

    assert result is None


@pytest.mark.asyncio
async def test_soft_delete_goal_success(db_session: AsyncSession):
    """Test soft deleting a goal."""
    device = await create_device(db_session)
    goal = await create_goal(db_session, device.id)

    result = await soft_delete_goal(db_session, device_id=device.id, goal_id=goal.id)

    assert result is True


@pytest.mark.asyncio
async def test_soft_delete_goal_not_found(db_session: AsyncSession):
    """Test soft deleting a non-existent goal."""
    device = await create_device(db_session)

    result = await soft_delete_goal(db_session, device_id=device.id, goal_id=uuid.uuid4())

    assert result is False
