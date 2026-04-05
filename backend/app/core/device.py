"""Shared device helpers used across services."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import Device
from app.features.auth.service import SUPABASE_MANAGED_HASH


async def ensure_device_exists(
    session: AsyncSession,
    device_id: uuid.UUID,
) -> None:
    """Create the device row if it doesn't exist yet (idempotent)."""
    result = await session.execute(select(Device).where(Device.id == device_id))
    if result.scalar_one_or_none() is None:
        session.add(Device(id=device_id, token_hash=SUPABASE_MANAGED_HASH))
        await session.flush()
