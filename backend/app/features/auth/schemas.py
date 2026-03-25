from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.schemas import APIModel


class DeviceRegisterRequest(BaseModel):
    device_id: UUID


class DeviceRegisterResponse(BaseModel):
    device_id: UUID
    device_token: str


# ---------------------------------------------------------------------------
# Supabase auth schemas
# ---------------------------------------------------------------------------


class LinkDeviceRequest(APIModel):
    device_id: UUID
    device_name: str | None = Field(default=None, max_length=255)
    legacy_device_token: str | None = Field(default=None, max_length=500)


class UserDeviceResponse(APIModel):
    id: UUID
    device_id: UUID
    device_name: str | None
    linked_at: datetime
    last_seen_at: datetime


class UserProfileResponse(APIModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    email: str | None
    created_at: datetime
    devices: list[UserDeviceResponse] = Field(validation_alias="user_devices")
