from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DeviceScoped(APIModel):
    device_id: UUID


class Timestamps(APIModel):
    created_at: datetime
    last_seen_at: datetime

