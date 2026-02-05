from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.schemas.common import APIModel
from app.schemas.enums import MealType


class MacroTotalsResponse(APIModel):
    calories: Decimal
    protein: Decimal
    carbs: Decimal
    fat: Decimal


class DayStatsResponse(APIModel):
    day: date
    totals: MacroTotalsResponse
    by_meal_type: dict[MealType, MacroTotalsResponse]


class DailyStatsPoint(APIModel):
    day: date
    totals: MacroTotalsResponse


class DailyStatsResponse(APIModel):
    from_day: date
    to_day: date
    points: list[DailyStatsPoint]


class WeightPoint(APIModel):
    day: date
    weight_kg: Decimal


class WeightStatsResponse(APIModel):
    from_day: date
    to_day: date
    points: list[WeightPoint]

