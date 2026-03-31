from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Self
from uuid import UUID

from pydantic import Field, model_validator

from app.core.enums import MealType, Unit
from app.core.schemas import APIModel


class FoodEntryCreateRequest(APIModel):
    # Private product path (existing)
    product_id: UUID | None = None
    portion_id: UUID | None = None

    # Catalog path (new — ADR-010)
    catalog_portion_id: UUID | None = None

    # Common fields
    day: date
    meal_type: MealType
    amount: Decimal = Field(gt=0)
    unit: Unit

    @model_validator(mode="after")
    def check_portion_xor(self) -> Self:
        has_product = self.product_id is not None
        has_portion = self.portion_id is not None
        has_catalog = self.catalog_portion_id is not None
        if has_product != has_portion:
            raise ValueError("product_id and portion_id must be provided together")
        has_private = has_product and has_portion
        if has_private == has_catalog:
            raise ValueError(
                "Provide either (product_id + portion_id) or catalog_portion_id, not both/neither"
            )
        return self


class FoodEntryUpdateRequest(APIModel):
    portion_id: UUID | None = None
    meal_type: MealType | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    unit: Unit | None = None


class FoodEntryResponse(APIModel):
    id: UUID
    product_id: UUID | None
    portion_id: UUID | None
    catalog_portion_id: UUID | None
    day: date
    meal_type: MealType
    amount: Decimal
    unit: Unit
    resolved_product_name: str | None = None
    resolved_calories: Decimal | None = None
    created_at: datetime
    updated_at: datetime
