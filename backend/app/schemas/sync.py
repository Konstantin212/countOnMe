from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from app.schemas.common import APIModel
from app.schemas.enums import MealType, Unit


class SyncProduct(APIModel):
    id: UUID
    name: str
    updated_at: datetime
    deleted_at: datetime | None


class SyncPortion(APIModel):
    id: UUID
    product_id: UUID
    label: str
    base_amount: Decimal
    base_unit: Unit
    calories: Decimal
    protein: Decimal | None
    carbs: Decimal | None
    fat: Decimal | None
    is_default: bool
    updated_at: datetime
    deleted_at: datetime | None


class SyncFoodEntry(APIModel):
    id: UUID
    product_id: UUID
    portion_id: UUID
    day: date
    meal_type: MealType
    amount: Decimal
    unit: Unit
    updated_at: datetime
    deleted_at: datetime | None


class SyncSinceResponse(APIModel):
    cursor: str | None
    products: list[SyncProduct]
    portions: list[SyncPortion]
    food_entries: list[SyncFoodEntry]

