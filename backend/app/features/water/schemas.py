from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import Field

from app.core.schemas import APIModel


class WaterLogCreateRequest(APIModel):
    day: date
    amount_ml: int = Field(gt=0, le=50000)


class WaterLogUpdateRequest(APIModel):
    amount_ml: int | None = Field(default=None, gt=0, le=50000)


class WaterLogResponse(APIModel):
    id: UUID
    day: date
    amount_ml: int
    created_at: datetime
    updated_at: datetime
