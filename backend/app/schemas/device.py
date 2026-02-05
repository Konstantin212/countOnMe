from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class DeviceRegisterRequest(BaseModel):
    device_id: UUID


class DeviceRegisterResponse(BaseModel):
    device_id: UUID
    device_token: str

