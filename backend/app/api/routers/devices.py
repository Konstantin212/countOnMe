from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.rate_limit import device_register_limiter
from app.db.session import get_session
from app.models.device import Device
from app.schemas.device import DeviceRegisterRequest, DeviceRegisterResponse
from app.services.auth import get_device_by_id, issue_device_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/devices", tags=["devices"])


@router.post(
    "/register",
    response_model=DeviceRegisterResponse,
    dependencies=[Depends(device_register_limiter)],
)
async def register_device(
    body: DeviceRegisterRequest,
    session: AsyncSession = Depends(get_session),
) -> DeviceRegisterResponse:
    """Register or re-register a device. Always issues a fresh token.

    Uses SELECT ... FOR UPDATE to prevent TOCTOU races when concurrent
    requests arrive for the same device_id.
    """
    # Lock the row (or gap) to serialize concurrent registrations
    stmt = (
        select(Device)
        .where(Device.id == body.device_id)
        .with_for_update()
    )
    result = await session.execute(stmt)
    device = result.scalar_one_or_none()

    if device is None:
        try:
            device = Device(id=body.device_id, token_hash="pending")  # noqa: S106
            session.add(device)
            await session.flush()
        except IntegrityError:
            logger.warning(
                "Device registration race condition for device_id=%s",
                body.device_id,
            )
            await session.rollback()
            device = await get_device_by_id(session, body.device_id)
            if device is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Device registration conflict",
                ) from None

    device_token, token_hash = issue_device_token(device.id)
    device.token_hash = token_hash
    await session.commit()

    return DeviceRegisterResponse(device_id=device.id, device_token=device_token)

