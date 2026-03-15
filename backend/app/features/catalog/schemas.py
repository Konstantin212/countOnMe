from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from app.core.enums import Unit
from app.core.schemas import APIModel


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
    source: str
    source_id: str
    name: str
    display_name: str
    brand: str | None
    barcode: str | None
    category: str | None
    default_portion: CatalogPortionResponse | None


class CatalogProductResponse(CatalogProductListItem):
    portions: list[CatalogPortionResponse]
