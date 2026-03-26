from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from app.core.schemas import APIModel


class WaterLogCreateRequest(APIModel):
    day: date
    amount_ml: int


class WaterLogUpdateRequest(APIModel):
    amount_ml: int | None = None


class WaterLogResponse(APIModel):
    id: UUID
    day: date
    amount_ml: int
    created_at: datetime
    updated_at: datetime
