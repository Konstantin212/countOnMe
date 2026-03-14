from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.core.schemas import APIModel


class ProductCreateRequest(APIModel):
    id: UUID | None = None
    name: str = Field(min_length=1, max_length=200)


class ProductUpdateRequest(APIModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)


class ProductResponse(APIModel):
    id: UUID
    name: str
    created_at: datetime
    updated_at: datetime


class ProductNameCheckResponse(APIModel):
    available: bool


class ProductSearchResultItem(APIModel):
    id: UUID
    name: str
    source: Literal["user", "catalog"]
    calories_per_100g: float | None = None
    protein_per_100g: float | None = None
    carbs_per_100g: float | None = None
    fat_per_100g: float | None = None
    catalog_id: UUID | None = (
        None  # For catalog items, mirrors id — provided so client can distinguish source without comparing source field.
    )
