from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import APIModel


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

