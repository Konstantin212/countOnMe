from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field

from app.core.enums import ModerationStatus, Unit, Visibility
from app.core.schemas import APIModel

# ---------------------------------------------------------------------------
# Portions
# ---------------------------------------------------------------------------


class SharedFoodPortionCreateRequest(APIModel):
    label: str = Field(min_length=1, max_length=200)
    base_amount: Decimal = Field(gt=0)
    base_unit: Unit
    gram_weight: Decimal | None = Field(default=None, gt=0)
    calories: Decimal = Field(ge=0)
    protein: Decimal | None = Field(default=None, ge=0)
    carbs: Decimal | None = Field(default=None, ge=0)
    fat: Decimal | None = Field(default=None, ge=0)
    is_default: bool = False


class SharedFoodPortionResponse(APIModel):
    id: UUID
    shared_food_id: UUID
    label: str
    base_amount: Decimal
    base_unit: Unit
    gram_weight: Decimal | None
    calories: Decimal
    protein: Decimal | None
    carbs: Decimal | None
    fat: Decimal | None
    is_default: bool


# ---------------------------------------------------------------------------
# Shared foods
# ---------------------------------------------------------------------------


class SharedFoodCreateRequest(APIModel):
    name: str = Field(min_length=1, max_length=200)
    display_name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    brand: str | None = Field(default=None, max_length=200)
    barcode: str | None = Field(default=None, max_length=50)
    category: str | None = Field(default=None, max_length=200)


class SharedFoodUpdateRequest(APIModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    brand: str | None = Field(default=None, max_length=200)
    barcode: str | None = Field(default=None, max_length=50)
    category: str | None = Field(default=None, max_length=200)


class SharedFoodResponse(APIModel):
    id: UUID
    owner_user_id: UUID
    name: str
    display_name: str
    description: str | None
    brand: str | None
    barcode: str | None
    category: str | None
    visibility: Visibility
    moderation_status: ModerationStatus
    created_at: datetime
    updated_at: datetime
    portions: list[SharedFoodPortionResponse]


class SharedFoodListItem(APIModel):
    id: UUID
    owner_user_id: UUID
    name: str
    display_name: str
    brand: str | None
    barcode: str | None
    category: str | None
    visibility: Visibility
    moderation_status: ModerationStatus
    default_portion: SharedFoodPortionResponse | None


class SharedFoodImportResponse(APIModel):
    product_id: UUID
    portion_count: int
