from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.body_weight import BodyWeight


class WeightConflict(Exception):
    pass


def _not_deleted(stmt: Select):
    return stmt.where(BodyWeight.deleted_at.is_(None))


async def create_body_weight(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    day: date,
    weight_kg,
) -> BodyWeight:
    # Only one per day (non-deleted).
    existing = await get_body_weight_by_day(session, device_id=device_id, day=day)
    if existing is not None:
        raise WeightConflict("Weight for this day already exists.")

    row = BodyWeight(device_id=device_id, day=day, weight_kg=weight_kg)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def list_body_weights(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    from_day: date | None = None,
    to_day: date | None = None,
) -> list[BodyWeight]:
    stmt = _not_deleted(select(BodyWeight)).where(BodyWeight.device_id == device_id)
    if from_day is not None:
        stmt = stmt.where(BodyWeight.day >= from_day)
    if to_day is not None:
        stmt = stmt.where(BodyWeight.day <= to_day)
    stmt = stmt.order_by(BodyWeight.day.asc())
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def get_body_weight(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    weight_id: uuid.UUID,
) -> BodyWeight | None:
    stmt = _not_deleted(select(BodyWeight)).where(BodyWeight.device_id == device_id, BodyWeight.id == weight_id)
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def get_body_weight_by_day(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    day: date,
) -> BodyWeight | None:
    stmt = _not_deleted(select(BodyWeight)).where(BodyWeight.device_id == device_id, BodyWeight.day == day)
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def update_body_weight(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    weight_id: uuid.UUID,
    weight_kg,
) -> BodyWeight | None:
    row = await get_body_weight(session, device_id=device_id, weight_id=weight_id)
    if row is None:
        return None
    row.weight_kg = weight_kg
    row.updated_at = datetime.now(UTC)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def soft_delete_body_weight(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    weight_id: uuid.UUID,
) -> bool:
    row = await get_body_weight(session, device_id=device_id, weight_id=weight_id)
    if row is None:
        return False
    row.deleted_at = datetime.now(UTC)
    row.updated_at = datetime.now(UTC)
    session.add(row)
    await session.commit()
    return True

