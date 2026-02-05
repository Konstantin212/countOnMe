"""Goals router - endpoints for nutrition goal management."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_device_id
from app.db.session import get_session
from app.schemas.goal import (
    GoalCalculateRequest,
    GoalCalculateResponse,
    GoalCreateCalculatedRequest,
    GoalCreateManualRequest,
    GoalResponse,
    GoalUpdateRequest,
)
from app.services.goal_calculation import calculate_full_goal
from app.services.goals import (
    create_calculated_goal,
    create_manual_goal,
    get_current_goal,
    get_goal,
    soft_delete_goal,
    update_goal,
)


router = APIRouter(prefix="/goals", tags=["goals"])


@router.post("/calculate", response_model=GoalCalculateResponse)
async def goals_calculate(
    body: GoalCalculateRequest,
    device_id: uuid.UUID = Depends(get_current_device_id),
) -> GoalCalculateResponse:
    """
    Calculate BMR/TDEE/targets without saving.

    Use this endpoint to preview calculated values before saving.
    """
    calc = calculate_full_goal(
        gender=body.gender,
        birth_date=body.birth_date,
        height_cm=body.height_cm,
        current_weight_kg=body.current_weight_kg,
        activity_level=body.activity_level,
        weight_goal_type=body.weight_goal_type,
        weight_change_pace=body.weight_change_pace,
    )

    return GoalCalculateResponse(
        bmr_kcal=calc.bmr_kcal,
        tdee_kcal=calc.tdee_kcal,
        daily_calories_kcal=calc.daily_calories_kcal,
        protein_percent=calc.protein_percent,
        carbs_percent=calc.carbs_percent,
        fat_percent=calc.fat_percent,
        protein_grams=calc.protein_grams,
        carbs_grams=calc.carbs_grams,
        fat_grams=calc.fat_grams,
        water_ml=calc.water_ml,
        healthy_weight_min_kg=calc.healthy_weight_min_kg,
        healthy_weight_max_kg=calc.healthy_weight_max_kg,
        current_bmi=calc.current_bmi,
        bmi_category=calc.bmi_category,
    )


@router.get("/current", response_model=GoalResponse | None)
async def goals_get_current(
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> GoalResponse | None:
    """Get the current active goal for this device."""
    goal = await get_current_goal(session, device_id=device_id)
    if goal is None:
        return None
    return _goal_to_response(goal)


@router.get("/{goal_id}", response_model=GoalResponse)
async def goals_get(
    goal_id: uuid.UUID,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> GoalResponse:
    """Get a specific goal by ID."""
    goal = await get_goal(session, device_id=device_id, goal_id=goal_id)
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return _goal_to_response(goal)


@router.post("/calculated", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def goals_create_calculated(
    body: GoalCreateCalculatedRequest,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> GoalResponse:
    """
    Create a calculated goal from body metrics.

    This will soft-delete any existing goals for this device.
    """
    goal = await create_calculated_goal(session, device_id=device_id, data=body)
    return _goal_to_response(goal)


@router.post("/manual", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def goals_create_manual(
    body: GoalCreateManualRequest,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> GoalResponse:
    """
    Create a manual goal with direct calorie/macro input.

    This will soft-delete any existing goals for this device.
    """
    goal = await create_manual_goal(session, device_id=device_id, data=body)
    return _goal_to_response(goal)


@router.patch("/{goal_id}", response_model=GoalResponse)
async def goals_update(
    goal_id: uuid.UUID,
    body: GoalUpdateRequest,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> GoalResponse:
    """Update goal targets (macros and water)."""
    goal = await update_goal(
        session,
        device_id=device_id,
        goal_id=goal_id,
        daily_calories_kcal=body.daily_calories_kcal,
        protein_percent=body.protein_percent,
        carbs_percent=body.carbs_percent,
        fat_percent=body.fat_percent,
        water_ml=body.water_ml,
    )
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return _goal_to_response(goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def goals_delete(
    goal_id: uuid.UUID,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a goal."""
    ok = await soft_delete_goal(session, device_id=device_id, goal_id=goal_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")


def _goal_to_response(goal) -> GoalResponse:
    """Convert UserGoal model to GoalResponse schema."""
    return GoalResponse(
        id=goal.id,
        goal_type=goal.goal_type,
        gender=goal.gender,
        birth_date=goal.birth_date,
        height_cm=goal.height_cm,
        current_weight_kg=goal.current_weight_kg,
        activity_level=goal.activity_level,
        weight_goal_type=goal.weight_goal_type,
        target_weight_kg=goal.target_weight_kg,
        weight_change_pace=goal.weight_change_pace,
        bmr_kcal=goal.bmr_kcal,
        tdee_kcal=goal.tdee_kcal,
        daily_calories_kcal=goal.daily_calories_kcal,
        protein_percent=goal.protein_percent,
        carbs_percent=goal.carbs_percent,
        fat_percent=goal.fat_percent,
        protein_grams=goal.protein_grams,
        carbs_grams=goal.carbs_grams,
        fat_grams=goal.fat_grams,
        water_ml=goal.water_ml,
        healthy_weight_min_kg=float(goal.healthy_weight_min_kg) if goal.healthy_weight_min_kg else None,
        healthy_weight_max_kg=float(goal.healthy_weight_max_kg) if goal.healthy_weight_max_kg else None,
        current_bmi=float(goal.current_bmi) if goal.current_bmi else None,
        bmi_category=goal.bmi_category,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )
