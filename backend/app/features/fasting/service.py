from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import Select, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.device import ensure_device_exists
from app.core.ownership import get_owner_filter
from app.features.fasting.models import FastingSession
from app.features.fasting.schemas import FastingStartRequest, FastingUpdateRequest


class FastingConflict(Exception):
    pass


def _not_deleted(stmt: Select) -> Select:
    return stmt.where(FastingSession.deleted_at.is_(None))


async def get_active_session(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
) -> FastingSession | None:
    """Find the active fasting session (ended_at IS NULL, not deleted)."""
    stmt = _not_deleted(select(FastingSession)).where(
        get_owner_filter(FastingSession, user_id=user_id),
        FastingSession.ended_at.is_(None),
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def start_fasting_session(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    data: FastingStartRequest,
    device_id: uuid.UUID | None = None,
) -> FastingSession:
    """Start a new fasting session. Raises FastingConflict if one is already active."""
    if device_id is not None:
        await ensure_device_exists(session, device_id)

    active = await get_active_session(session, user_id=user_id)
    if active is not None:
        raise FastingConflict("An active fasting session already exists.")

    target_end_at = data.started_at + timedelta(hours=data.fasting_hours)

    row = FastingSession(
        user_id=user_id,
        device_id=device_id,
        created_on_device_id=device_id,
        technique=data.technique,
        fasting_hours=data.fasting_hours,
        started_at=data.started_at,
        target_end_at=target_end_at,
        ended_at=None,
        completed=False,
    )
    session.add(row)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        if "uq_fasting_sessions_one_active_per_user" in str(exc):
            raise FastingConflict("An active fasting session already exists.") from exc
        raise
    await session.refresh(row)
    return row


async def end_fasting_session(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    ended_at: datetime,
    device_id: uuid.UUID | None = None,
) -> FastingSession | None:
    """End a fasting session. Sets completed based on whether target was reached."""
    row = await get_fasting_session(session, user_id=user_id, session_id=session_id)
    if row is None:
        return None

    if row.ended_at is not None:
        return row  # Already ended; return as-is

    row.ended_at = ended_at
    row.completed = ended_at >= row.target_end_at
    row.updated_at = datetime.now(UTC)
    if device_id is not None:
        row.updated_on_device_id = device_id
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def update_fasting_session(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    data: FastingUpdateRequest,
    device_id: uuid.UUID | None = None,
) -> FastingSession | None:
    """Update a fasting session. Recalculates target_end_at and completed as needed."""
    row = await get_fasting_session(session, user_id=user_id, session_id=session_id)
    if row is None:
        return None

    provided = data.model_fields_set
    for field in ("started_at", "ended_at", "technique", "fasting_hours"):
        if field in provided:
            setattr(row, field, getattr(data, field))

    # Always recalculate target_end_at when started_at or fasting_hours changes
    if "started_at" in provided or "fasting_hours" in provided:
        row.target_end_at = row.started_at + timedelta(hours=row.fasting_hours)

    # Recalculate completed if ended_at is set
    if row.ended_at is not None:
        row.completed = row.ended_at >= row.target_end_at

    row.updated_at = datetime.now(UTC)
    if device_id is not None:
        row.updated_on_device_id = device_id
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def list_fasting_sessions(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
) -> list[FastingSession]:
    stmt = (
        _not_deleted(select(FastingSession))
        .where(get_owner_filter(FastingSession, user_id=user_id))
        .order_by(FastingSession.started_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_fasting_session(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
) -> FastingSession | None:
    stmt = _not_deleted(select(FastingSession)).where(
        get_owner_filter(FastingSession, user_id=user_id),
        FastingSession.id == session_id,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def soft_delete_fasting_session(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    device_id: uuid.UUID | None = None,
) -> bool:
    row = await get_fasting_session(session, user_id=user_id, session_id=session_id)
    if row is None:
        return False
    row.deleted_at = datetime.now(UTC)
    row.updated_at = datetime.now(UTC)
    if device_id is not None:
        row.updated_on_device_id = device_id
    session.add(row)
    await session.commit()
    return True
