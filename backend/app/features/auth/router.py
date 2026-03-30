from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user
from app.core.rate_limit import auth_action_limiter, device_register_limiter
from app.features.auth.models import Device, User
from app.features.auth.schemas import (
    ClaimCounts,
    ClaimDeviceDataRequest,
    ClaimDeviceDataResponse,
    DeviceRegisterRequest,
    DeviceRegisterResponse,
    LinkDeviceRequest,
    LinkDeviceWithClaimResponse,
    UserProfileResponse,
)
from app.features.auth.service import (
    DataClaimedByOther,
    DeviceNotLinked,
    OwnershipProofRequired,
    claim_device_data,
    delete_supabase_auth_user,
    delete_user_account,
    get_device_by_id,
    get_user_profile,
    issue_device_token,
    link_device_to_user,
)
from app.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/devices", tags=["devices"])
auth_router = APIRouter(prefix="/auth", tags=["auth"])


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
    if not settings.allow_device_auth:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Legacy device auth is disabled",
        )

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


# ---------------------------------------------------------------------------
# Supabase auth endpoints
# ---------------------------------------------------------------------------


@auth_router.post(
    "/link-device",
    response_model=LinkDeviceWithClaimResponse,
    dependencies=[Depends(auth_action_limiter)],
)
async def link_device(
    body: LinkDeviceRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LinkDeviceWithClaimResponse:
    """Link a device to the authenticated user and auto-claim device data. Idempotent."""
    try:
        user_device = await link_device_to_user(
            session,
            user=user,
            device_id=body.device_id,
            device_name=body.device_name,
            legacy_device_token=body.legacy_device_token,
        )
    except OwnershipProofRequired:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Legacy device token required to claim this device",
        ) from None
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid legacy device token",
        ) from None

    # Auto-claim device data after linking
    try:
        counts = await claim_device_data(session, user_id=user.id, device_id=body.device_id)
    except (DeviceNotLinked, DataClaimedByOther):
        # Should not happen since we just linked, but log and continue
        logger.warning(
            "Auto-claim failed for device=%s user=%s", body.device_id, user.id,
        )
        counts = {"products": 0, "portions": 0, "food_entries": 0, "goals": 0, "body_weights": 0}

    await session.commit()
    return LinkDeviceWithClaimResponse(
        id=user_device.id,
        device_id=user_device.device_id,
        device_name=user_device.device_name,
        linked_at=user_device.linked_at,
        last_seen_at=user_device.last_seen_at,
        claimed_counts=ClaimCounts(**counts),
    )


@auth_router.post(
    "/claim-device-data",
    response_model=ClaimDeviceDataResponse,
    dependencies=[Depends(auth_action_limiter)],
)
async def claim_device_data_endpoint(
    body: ClaimDeviceDataRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ClaimDeviceDataResponse:
    """Claim all unclaimed data on a device for the authenticated user."""
    try:
        counts = await claim_device_data(session, user_id=user.id, device_id=body.device_id)
    except DeviceNotLinked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not linked to your account",
        ) from None
    except DataClaimedByOther:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Device data is already claimed by another user",
        ) from None

    await session.commit()
    return ClaimDeviceDataResponse(claimed_counts=ClaimCounts(**counts))


@auth_router.get("/me", response_model=UserProfileResponse)
async def get_me(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserProfileResponse:
    """Return the authenticated user's profile with linked devices."""
    profile = await get_user_profile(session, user.id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserProfileResponse.model_validate(profile)


@auth_router.delete(
    "/account",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(auth_action_limiter)],
)
async def delete_account(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Soft-delete the authenticated user's account and remove device links."""
    supabase_id = await delete_user_account(session, user.id)
    await session.commit()

    # Best-effort Supabase auth cleanup — after commit so DB state is safe
    if supabase_id is not None:
        try:
            await delete_supabase_auth_user(supabase_id)
        except Exception:
            logger.exception("Failed to delete Supabase auth user %s (best-effort)", supabase_id)
