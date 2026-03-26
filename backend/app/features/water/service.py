from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ownership import get_owner_filter
from app.features.water.models import WaterLog


def _not_deleted(stmt: Select) -> Select:
    return stmt.where(WaterLog.deleted_at.is_(None))


async def create_water_log(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    day: date,
    amount_ml: int,
    device_id: uuid.UUID | None = None,
) -> WaterLog:
    row = WaterLog(
        user_id=user_id,
        device_id=device_id,
        created_on_device_id=device_id,
        day=day,
        amount_ml=amount_ml,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def list_water_logs(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    from_day: date | None = None,
    to_day: date | None = None,
    device_id: uuid.UUID | None = None,
) -> list[WaterLog]:
    stmt = _not_deleted(select(WaterLog)).where(
        get_owner_filter(WaterLog, user_id=user_id),
    )
    if from_day is not None:
        stmt = stmt.where(WaterLog.day >= from_day)
    if to_day is not None:
        stmt = stmt.where(WaterLog.day <= to_day)
    stmt = stmt.order_by(WaterLog.day.asc(), WaterLog.created_at.asc())
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def get_water_log(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    water_log_id: uuid.UUID,
    device_id: uuid.UUID | None = None,
) -> WaterLog | None:
    stmt = _not_deleted(select(WaterLog)).where(
        get_owner_filter(WaterLog, user_id=user_id),
        WaterLog.id == water_log_id,
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def update_water_log(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    water_log_id: uuid.UUID,
    amount_ml: int | None = None,
    device_id: uuid.UUID | None = None,
) -> WaterLog | None:
    row = await get_water_log(session, user_id=user_id, water_log_id=water_log_id)
    if row is None:
        return None
    if amount_ml is not None:
        row.amount_ml = amount_ml
    row.updated_at = datetime.now(UTC)
    if device_id is not None:
        row.updated_on_device_id = device_id
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def soft_delete_water_log(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    water_log_id: uuid.UUID,
    device_id: uuid.UUID | None = None,
) -> bool:
    row = await get_water_log(session, user_id=user_id, water_log_id=water_log_id)
    if row is None:
        return False
    row.deleted_at = datetime.now(UTC)
    row.updated_at = datetime.now(UTC)
    session.add(row)
    await session.commit()
    return True
