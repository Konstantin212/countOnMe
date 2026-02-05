from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field

from app.schemas.common import APIModel
from app.schemas.enums import Unit


class PortionCreateRequest(APIModel):
    label: str = Field(min_length=1, max_length=200)
    base_amount: Decimal = Field(gt=0)
    base_unit: Unit
    calories: Decimal = Field(ge=0)
    protein: Decimal | None = Field(default=None, ge=0)
    carbs: Decimal | None = Field(default=None, ge=0)
    fat: Decimal | None = Field(default=None, ge=0)
    is_default: bool = False


class PortionUpdateRequest(APIModel):
    label: str | None = Field(default=None, min_length=1, max_length=200)
    base_amount: Decimal | None = Field(default=None, gt=0)
    base_unit: Unit | None = None
    calories: Decimal | None = Field(default=None, ge=0)
    protein: Decimal | None = Field(default=None, ge=0)
    carbs: Decimal | None = Field(default=None, ge=0)
    fat: Decimal | None = Field(default=None, ge=0)
    is_default: bool | None = None


class PortionResponse(APIModel):
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
    created_at: datetime
    updated_at: datetime

