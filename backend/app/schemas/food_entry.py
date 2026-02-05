from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field

from app.schemas.common import APIModel
from app.schemas.enums import MealType, Unit


class FoodEntryCreateRequest(APIModel):
    product_id: UUID
    portion_id: UUID
    day: date
    meal_type: MealType
    amount: Decimal = Field(gt=0)
    unit: Unit


class FoodEntryUpdateRequest(APIModel):
    portion_id: UUID | None = None
    meal_type: MealType | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    unit: Unit | None = None


class FoodEntryResponse(APIModel):
    id: UUID
    product_id: UUID
    portion_id: UUID
    day: date
    meal_type: MealType
    amount: Decimal
    unit: Unit
    created_at: datetime
    updated_at: datetime

