from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.device import Device
from app.schemas.device import DeviceRegisterRequest, DeviceRegisterResponse
from app.services.auth import get_device_by_id, issue_device_token


router = APIRouter(prefix="/devices", tags=["devices"])


@router.post("/register", response_model=DeviceRegisterResponse)
async def register_device(
    body: DeviceRegisterRequest,
    session: AsyncSession = Depends(get_session),
) -> DeviceRegisterResponse:
    device = await get_device_by_id(session, body.device_id)
    if device is None:
        device = Device(id=body.device_id, token_hash="pending")
        session.add(device)
        await session.flush()

    device_token, token_hash = issue_device_token(device.id)
    device.token_hash = token_hash

    await session.commit()

    return DeviceRegisterResponse(device_id=device.id, device_token=device_token)

