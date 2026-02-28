from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from app.schemas.common import APIModel
from app.schemas.enums import Unit


class CatalogPortionResponse(APIModel):
    id: UUID
    label: str
    base_amount: Decimal
    base_unit: Unit
    gram_weight: Decimal | None
    calories: Decimal
    protein: Decimal | None
    carbs: Decimal | None
    fat: Decimal | None
    is_default: bool


class CatalogProductListItem(APIModel):
    id: UUID
    fdc_id: int
    name: str
    category: str | None
    default_portion: CatalogPortionResponse | None


class CatalogProductResponse(CatalogProductListItem):
    portions: list[CatalogPortionResponse]
