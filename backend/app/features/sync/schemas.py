"""Sync schemas — request/response DTOs for delta-based sync endpoints."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.core.enums import MealType, Unit
from app.core.schemas import APIModel

# ---------------------------------------------------------------------------
# Entity-specific upsert schemas (full entity data returned in pull)
# ---------------------------------------------------------------------------


class SyncProduct(APIModel):
    id: UUID
    name: str
    barcode: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class SyncPortion(APIModel):
    id: UUID
    product_id: UUID
    label: str
    base_amount: Decimal
    base_unit: Unit
    calories: Decimal
    protein: Decimal | None = None
    carbs: Decimal | None = None
    fat: Decimal | None = None
    is_default: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class SyncFoodEntry(APIModel):
    id: UUID
    product_id: UUID
    portion_id: UUID
    day: date
    meal_type: MealType
    amount: Decimal
    unit: Unit
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class SyncBodyWeight(APIModel):
    id: UUID
    day: date
    weight_kg: Decimal
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class SyncUserGoal(APIModel):
    id: UUID
    goal_type: str
    gender: str | None = None
    birth_date: date | None = None
    height_cm: Decimal | None = None
    current_weight_kg: Decimal | None = None
    activity_level: str | None = None
    weight_goal_type: str | None = None
    target_weight_kg: Decimal | None = None
    weight_change_pace: str | None = None
    bmr_kcal: int | None = None
    tdee_kcal: int | None = None
    daily_calories_kcal: int
    protein_percent: int
    carbs_percent: int
    fat_percent: int
    protein_grams: int
    carbs_grams: int
    fat_grams: int
    water_ml: int
    healthy_weight_min_kg: Decimal | None = None
    healthy_weight_max_kg: Decimal | None = None
    current_bmi: Decimal | None = None
    bmi_category: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class SyncWaterLog(APIModel):
    id: UUID
    day: date
    amount_ml: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


# ---------------------------------------------------------------------------
# Pull response — grouped by entity type
# ---------------------------------------------------------------------------


class ProductChanges(APIModel):
    upserts: list[SyncProduct] = Field(default_factory=list)
    deletes: list[UUID] = Field(default_factory=list)


class PortionChanges(APIModel):
    upserts: list[SyncPortion] = Field(default_factory=list)
    deletes: list[UUID] = Field(default_factory=list)


class FoodEntryChanges(APIModel):
    upserts: list[SyncFoodEntry] = Field(default_factory=list)
    deletes: list[UUID] = Field(default_factory=list)


class GoalChanges(APIModel):
    upserts: list[SyncUserGoal] = Field(default_factory=list)
    deletes: list[UUID] = Field(default_factory=list)


class BodyWeightChanges(APIModel):
    upserts: list[SyncBodyWeight] = Field(default_factory=list)
    deletes: list[UUID] = Field(default_factory=list)


class WaterLogChanges(APIModel):
    upserts: list[SyncWaterLog] = Field(default_factory=list)
    deletes: list[UUID] = Field(default_factory=list)


class SyncPullResponse(APIModel):
    products: ProductChanges = Field(default_factory=ProductChanges)
    portions: PortionChanges = Field(default_factory=PortionChanges)
    food_entries: FoodEntryChanges = Field(default_factory=FoodEntryChanges)
    goals: GoalChanges = Field(default_factory=GoalChanges)
    body_weights: BodyWeightChanges = Field(default_factory=BodyWeightChanges)
    water_logs: WaterLogChanges = Field(default_factory=WaterLogChanges)
    sync_cursor: str | None = None
    has_more: bool = False


# ---------------------------------------------------------------------------
# Push request / response
# ---------------------------------------------------------------------------


class MutationAction(StrEnum):
    upsert = "upsert"
    delete = "delete"


class SyncMutation(APIModel):
    entity_type: Literal["products", "portions", "food_entries", "goals", "body_weights", "water_logs"]
    action: MutationAction
    id: UUID
    data: dict | None = None
    client_updated_at: datetime


class SyncPushRequest(APIModel):
    mutations: list[SyncMutation] = Field(max_length=50)
    device_id: UUID | None = None


class MutationResultStatus(StrEnum):
    applied = "applied"
    conflict = "conflict"
    error = "error"


class MutationResult(APIModel):
    id: UUID
    status: MutationResultStatus
    server_updated_at: datetime | None = None
    message: str | None = None


class SyncPushResponse(APIModel):
    results: list[MutationResult]
