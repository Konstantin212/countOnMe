"""Goals service - CRUD operations for user nutrition goals."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_goal import UserGoal
from app.schemas.enums import (
    ActivityLevel,
    Gender,
    GoalType,
    WeightChangePace,
    WeightGoalType,
)
from app.schemas.goal import GoalCreateCalculatedRequest, GoalCreateManualRequest
from app.services.goal_calculation import (
    calculate_bmi,
    calculate_full_goal,
    calculate_healthy_weight_range,
    calculate_macros_for_manual,
)


def _not_deleted(stmt: Select) -> Select:
    return stmt.where(UserGoal.deleted_at.is_(None))


async def get_current_goal(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
) -> UserGoal | None:
    """Get the current (most recent) active goal for a device."""
    stmt = (
        _not_deleted(select(UserGoal))
        .where(UserGoal.device_id == device_id)
        .order_by(UserGoal.created_at.desc())
        .limit(1)
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def get_goal(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    goal_id: uuid.UUID,
) -> UserGoal | None:
    """Get a specific goal by ID (device-scoped)."""
    stmt = _not_deleted(select(UserGoal)).where(
        UserGoal.device_id == device_id,
        UserGoal.id == goal_id,
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def create_calculated_goal(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    data: GoalCreateCalculatedRequest,
) -> UserGoal:
    """Create a calculated goal from body metrics."""
    # Perform full calculation
    calc = calculate_full_goal(
        gender=data.gender,
        birth_date=data.birth_date,
        height_cm=data.height_cm,
        current_weight_kg=data.current_weight_kg,
        activity_level=data.activity_level,
        weight_goal_type=data.weight_goal_type,
        weight_change_pace=data.weight_change_pace,
        protein_percent=data.protein_percent,
        carbs_percent=data.carbs_percent,
        fat_percent=data.fat_percent,
        water_ml=data.water_ml,
    )

    # Soft delete any existing goals for this device
    await _soft_delete_existing_goals(session, device_id=device_id)

    # Create new goal
    goal = UserGoal(
        id=data.id,
        device_id=device_id,
        goal_type=GoalType.calculated.value,
        # Body metrics
        gender=data.gender.value,
        birth_date=data.birth_date,
        height_cm=data.height_cm,
        current_weight_kg=data.current_weight_kg,
        activity_level=data.activity_level.value,
        # Weight goal
        weight_goal_type=data.weight_goal_type.value,
        target_weight_kg=data.target_weight_kg,
        weight_change_pace=data.weight_change_pace.value if data.weight_change_pace else None,
        # Calculated values
        bmr_kcal=calc.bmr_kcal,
        tdee_kcal=calc.tdee_kcal,
        # Targets
        daily_calories_kcal=calc.daily_calories_kcal,
        protein_percent=calc.protein_percent,
        carbs_percent=calc.carbs_percent,
        fat_percent=calc.fat_percent,
        protein_grams=calc.protein_grams,
        carbs_grams=calc.carbs_grams,
        fat_grams=calc.fat_grams,
        water_ml=calc.water_ml,
        # Weight range
        healthy_weight_min_kg=Decimal(str(calc.healthy_weight_min_kg)),
        healthy_weight_max_kg=Decimal(str(calc.healthy_weight_max_kg)),
        current_bmi=Decimal(str(calc.current_bmi)),
        bmi_category=calc.bmi_category,
    ) if data.id else UserGoal(
        device_id=device_id,
        goal_type=GoalType.calculated.value,
        # Body metrics
        gender=data.gender.value,
        birth_date=data.birth_date,
        height_cm=data.height_cm,
        current_weight_kg=data.current_weight_kg,
        activity_level=data.activity_level.value,
        # Weight goal
        weight_goal_type=data.weight_goal_type.value,
        target_weight_kg=data.target_weight_kg,
        weight_change_pace=data.weight_change_pace.value if data.weight_change_pace else None,
        # Calculated values
        bmr_kcal=calc.bmr_kcal,
        tdee_kcal=calc.tdee_kcal,
        # Targets
        daily_calories_kcal=calc.daily_calories_kcal,
        protein_percent=calc.protein_percent,
        carbs_percent=calc.carbs_percent,
        fat_percent=calc.fat_percent,
        protein_grams=calc.protein_grams,
        carbs_grams=calc.carbs_grams,
        fat_grams=calc.fat_grams,
        water_ml=calc.water_ml,
        # Weight range
        healthy_weight_min_kg=Decimal(str(calc.healthy_weight_min_kg)),
        healthy_weight_max_kg=Decimal(str(calc.healthy_weight_max_kg)),
        current_bmi=Decimal(str(calc.current_bmi)),
        bmi_category=calc.bmi_category,
    )

    session.add(goal)
    await session.commit()
    await session.refresh(goal)
    return goal


async def create_manual_goal(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    data: GoalCreateManualRequest,
) -> UserGoal:
    """Create a manual goal with direct calorie/macro input."""
    # Calculate macro grams
    macros = calculate_macros_for_manual(
        data.daily_calories_kcal,
        data.protein_percent,
        data.carbs_percent,
        data.fat_percent,
    )

    # Soft delete any existing goals for this device
    await _soft_delete_existing_goals(session, device_id=device_id)

    # Create new goal
    goal = UserGoal(
        id=data.id,
        device_id=device_id,
        goal_type=GoalType.manual.value,
        # Targets
        daily_calories_kcal=data.daily_calories_kcal,
        protein_percent=data.protein_percent,
        carbs_percent=data.carbs_percent,
        fat_percent=data.fat_percent,
        protein_grams=macros.protein_grams,
        carbs_grams=macros.carbs_grams,
        fat_grams=macros.fat_grams,
        water_ml=data.water_ml,
    ) if data.id else UserGoal(
        device_id=device_id,
        goal_type=GoalType.manual.value,
        # Targets
        daily_calories_kcal=data.daily_calories_kcal,
        protein_percent=data.protein_percent,
        carbs_percent=data.carbs_percent,
        fat_percent=data.fat_percent,
        protein_grams=macros.protein_grams,
        carbs_grams=macros.carbs_grams,
        fat_grams=macros.fat_grams,
        water_ml=data.water_ml,
    )

    session.add(goal)
    await session.commit()
    await session.refresh(goal)
    return goal


async def update_goal(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    goal_id: uuid.UUID,
    daily_calories_kcal: int | None = None,
    protein_percent: int | None = None,
    carbs_percent: int | None = None,
    fat_percent: int | None = None,
    water_ml: int | None = None,
) -> UserGoal | None:
    """Update goal targets (macros and water only)."""
    goal = await get_goal(session, device_id=device_id, goal_id=goal_id)
    if goal is None:
        return None

    # Update calories if provided
    if daily_calories_kcal is not None:
        goal.daily_calories_kcal = daily_calories_kcal

    # Track if we need to recalculate macro grams
    calories = goal.daily_calories_kcal
    p_pct = protein_percent if protein_percent is not None else goal.protein_percent
    c_pct = carbs_percent if carbs_percent is not None else goal.carbs_percent
    f_pct = fat_percent if fat_percent is not None else goal.fat_percent

    # Update percentages
    if protein_percent is not None:
        goal.protein_percent = protein_percent
    if carbs_percent is not None:
        goal.carbs_percent = carbs_percent
    if fat_percent is not None:
        goal.fat_percent = fat_percent

    # Recalculate grams if calories or percentages changed
    if any(x is not None for x in [daily_calories_kcal, protein_percent, carbs_percent, fat_percent]):
        macros = calculate_macros_for_manual(calories, p_pct, c_pct, f_pct)
        goal.protein_grams = macros.protein_grams
        goal.carbs_grams = macros.carbs_grams
        goal.fat_grams = macros.fat_grams

    # Update water
    if water_ml is not None:
        goal.water_ml = water_ml

    goal.updated_at = datetime.now(timezone.utc)
    session.add(goal)
    await session.commit()
    await session.refresh(goal)
    return goal


async def soft_delete_goal(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    goal_id: uuid.UUID,
) -> bool:
    """Soft delete a goal."""
    goal = await get_goal(session, device_id=device_id, goal_id=goal_id)
    if goal is None:
        return False

    goal.deleted_at = datetime.now(timezone.utc)
    goal.updated_at = datetime.now(timezone.utc)
    session.add(goal)
    await session.commit()
    return True


async def _soft_delete_existing_goals(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
) -> None:
    """Soft delete all existing goals for a device."""
    stmt = _not_deleted(select(UserGoal)).where(UserGoal.device_id == device_id)
    res = await session.execute(stmt)
    goals = res.scalars().all()

    now = datetime.now(timezone.utc)
    for goal in goals:
        goal.deleted_at = now
        goal.updated_at = now
        session.add(goal)

    await session.flush()
