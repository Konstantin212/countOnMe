from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field

from app.schemas.common import APIModel


class BodyWeightCreateRequest(APIModel):
    day: date
    weight_kg: Decimal = Field(gt=0)


class BodyWeightUpdateRequest(APIModel):
    weight_kg: Decimal = Field(gt=0)


class BodyWeightResponse(APIModel):
    id: UUID
    day: date
    weight_kg: Decimal
    created_at: datetime
    updated_at: datetime

