from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_device_id
from app.db.session import get_session
from app.schemas.stats import (
    DailyStatsPoint,
    DailyStatsResponse,
    DayStatsResponse,
    MacroTotalsResponse,
    WeightPoint,
    WeightStatsResponse,
)
from app.services.stats import get_daily_stats, get_day_stats
from app.services.weights import list_body_weights


router = APIRouter(prefix="/stats", tags=["stats"])


def _totals(t) -> MacroTotalsResponse:
    return MacroTotalsResponse(calories=t.calories, protein=t.protein, carbs=t.carbs, fat=t.fat)


@router.get("/day/{day}", response_model=DayStatsResponse)
async def stats_day(
    day: date,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> DayStatsResponse:
    totals, by_meal = await get_day_stats(session, device_id=device_id, day=day)
    return DayStatsResponse(
        day=day,
        totals=_totals(totals),
        by_meal_type={k: _totals(v) for k, v in by_meal.items()},
    )


@router.get("/daily", response_model=DailyStatsResponse)
async def stats_daily(
    from_day: date = Query(alias="from"),
    to_day: date = Query(alias="to"),
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> DailyStatsResponse:
    points_raw = await get_daily_stats(session, device_id=device_id, from_day=from_day, to_day=to_day)
    return DailyStatsResponse(
        from_day=from_day,
        to_day=to_day,
        points=[DailyStatsPoint(day=d, totals=_totals(t)) for d, t in points_raw],
    )


@router.get("/weight", response_model=WeightStatsResponse)
async def stats_weight(
    from_day: date = Query(alias="from"),
    to_day: date = Query(alias="to"),
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> WeightStatsResponse:
    rows = await list_body_weights(session, device_id=device_id, from_day=from_day, to_day=to_day)
    return WeightStatsResponse(
        from_day=from_day,
        to_day=to_day,
        points=[WeightPoint(day=r.day, weight_kg=r.weight_kg) for r in rows],
    )

