"""Test fasting service database operations."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.fasting.schemas import FastingStartRequest, FastingUpdateRequest
from app.features.fasting.service import (
    FastingConflict,
    end_fasting_session,
    get_active_session,
    get_fasting_session,
    list_fasting_sessions,
    soft_delete_fasting_session,
    start_fasting_session,
    update_fasting_session,
)
from tests.factories import create_fasting_session, create_user


@pytest.mark.asyncio
async def test_start_session(db_session: AsyncSession) -> None:
    """Starting a session calculates target_end_at and defaults completed=False."""
    user = await create_user(db_session)
    now = datetime.now(UTC)

    data = FastingStartRequest(technique="16:8", fasting_hours=16, started_at=now)
    row = await start_fasting_session(db_session, user_id=user.id, data=data)

    assert row.technique == "16:8"
    assert row.fasting_hours == 16
    assert row.started_at == now
    assert row.target_end_at == now + timedelta(hours=16)
    assert row.ended_at is None
    assert row.completed is False


@pytest.mark.asyncio
async def test_start_session_conflict(db_session: AsyncSession) -> None:
    """Starting a second session while one is active raises FastingConflict."""
    user = await create_user(db_session)
    now = datetime.now(UTC)

    data = FastingStartRequest(technique="16:8", fasting_hours=16, started_at=now)
    await start_fasting_session(db_session, user_id=user.id, data=data)

    with pytest.raises(FastingConflict):
        data2 = FastingStartRequest(technique="18:6", fasting_hours=18, started_at=now)
        await start_fasting_session(db_session, user_id=user.id, data=data2)


@pytest.mark.asyncio
async def test_end_session_completed(db_session: AsyncSession) -> None:
    """Ending after target marks completed=True."""
    user = await create_user(db_session)
    now = datetime.now(UTC)

    data = FastingStartRequest(technique="16:8", fasting_hours=16, started_at=now)
    row = await start_fasting_session(db_session, user_id=user.id, data=data)

    ended = now + timedelta(hours=17)
    result = await end_fasting_session(
        db_session, user_id=user.id, session_id=row.id, ended_at=ended,
    )

    assert result is not None
    assert result.ended_at == ended
    assert result.completed is True


@pytest.mark.asyncio
async def test_end_session_early(db_session: AsyncSession) -> None:
    """Ending before target marks completed=False."""
    user = await create_user(db_session)
    now = datetime.now(UTC)

    data = FastingStartRequest(technique="16:8", fasting_hours=16, started_at=now)
    row = await start_fasting_session(db_session, user_id=user.id, data=data)

    ended = now + timedelta(hours=10)
    result = await end_fasting_session(
        db_session, user_id=user.id, session_id=row.id, ended_at=ended,
    )

    assert result is not None
    assert result.completed is False


@pytest.mark.asyncio
async def test_update_session(db_session: AsyncSession) -> None:
    """Editing a session after it ends recalculates fields."""
    user = await create_user(db_session)
    now = datetime.now(UTC)

    data = FastingStartRequest(technique="16:8", fasting_hours=16, started_at=now)
    row = await start_fasting_session(db_session, user_id=user.id, data=data)

    # End it
    ended = now + timedelta(hours=17)
    await end_fasting_session(db_session, user_id=user.id, session_id=row.id, ended_at=ended)

    # Update technique and fasting_hours
    update = FastingUpdateRequest(technique="20:4", fasting_hours=20)
    updated = await update_fasting_session(
        db_session, user_id=user.id, session_id=row.id, data=update,
    )

    assert updated is not None
    assert updated.technique == "20:4"
    assert updated.fasting_hours == 20
    # target_end_at should be recalculated
    assert updated.target_end_at == now + timedelta(hours=20)
    # ended_at was 17h, target is now 20h => not completed
    assert updated.completed is False


@pytest.mark.asyncio
async def test_list_sessions(db_session: AsyncSession) -> None:
    """List returns non-deleted sessions ordered by started_at DESC."""
    user = await create_user(db_session)
    now = datetime.now(UTC)

    s1 = await create_fasting_session(
        db_session, user_id=user.id, started_at=now - timedelta(hours=48),
    )
    s2 = await create_fasting_session(
        db_session, user_id=user.id, started_at=now - timedelta(hours=24),
        ended_at=now - timedelta(hours=8),
    )

    result = await list_fasting_sessions(db_session, user_id=user.id)
    ids = [r.id for r in result]

    assert s2.id in ids
    assert s1.id in ids
    # s2 started later, so it should be first
    assert ids.index(s2.id) < ids.index(s1.id)


@pytest.mark.asyncio
async def test_get_session(db_session: AsyncSession) -> None:
    """Get a specific session by id."""
    user = await create_user(db_session)
    row = await create_fasting_session(db_session, user_id=user.id)

    result = await get_fasting_session(db_session, user_id=user.id, session_id=row.id)
    assert result is not None
    assert result.id == row.id


@pytest.mark.asyncio
async def test_get_session_not_found(db_session: AsyncSession) -> None:
    """Get returns None for non-existent id."""
    user = await create_user(db_session)
    result = await get_fasting_session(db_session, user_id=user.id, session_id=uuid.uuid4())
    assert result is None


@pytest.mark.asyncio
async def test_get_active_session(db_session: AsyncSession) -> None:
    """Get active returns the session with ended_at IS NULL."""
    user = await create_user(db_session)
    row = await create_fasting_session(db_session, user_id=user.id)

    result = await get_active_session(db_session, user_id=user.id)
    assert result is not None
    assert result.id == row.id


@pytest.mark.asyncio
async def test_get_active_session_none(db_session: AsyncSession) -> None:
    """Get active returns None when all sessions are ended."""
    user = await create_user(db_session)
    now = datetime.now(UTC)
    await create_fasting_session(
        db_session, user_id=user.id,
        started_at=now - timedelta(hours=24),
        ended_at=now - timedelta(hours=8),
    )

    result = await get_active_session(db_session, user_id=user.id)
    assert result is None


@pytest.mark.asyncio
async def test_soft_delete(db_session: AsyncSession) -> None:
    """Soft-deleted sessions don't appear in list or get."""
    user = await create_user(db_session)
    row = await create_fasting_session(
        db_session, user_id=user.id,
        ended_at=datetime.now(UTC),
    )

    ok = await soft_delete_fasting_session(db_session, user_id=user.id, session_id=row.id)
    assert ok is True

    # Should not be returned by get
    result = await get_fasting_session(db_session, user_id=user.id, session_id=row.id)
    assert result is None


@pytest.mark.asyncio
async def test_re_ending_session_preserves_original(db_session: AsyncSession) -> None:
    """Ending an already-ended session is idempotent — original ended_at is preserved."""
    user = await create_user(db_session)
    now = datetime.now(UTC)

    data = FastingStartRequest(technique="16:8", fasting_hours=16, started_at=now)
    row = await start_fasting_session(db_session, user_id=user.id, data=data)

    first_ended = now + timedelta(hours=17)
    result1 = await end_fasting_session(
        db_session, user_id=user.id, session_id=row.id, ended_at=first_ended,
    )
    assert result1 is not None
    assert result1.ended_at == first_ended
    assert result1.completed is True

    # Attempt to end again with a different time
    second_ended = now + timedelta(hours=10)
    result2 = await end_fasting_session(
        db_session, user_id=user.id, session_id=row.id, ended_at=second_ended,
    )

    # Original ended_at must be preserved
    assert result2 is not None
    assert result2.ended_at == first_ended
    assert result2.completed is True


@pytest.mark.asyncio
async def test_user_isolation(db_session: AsyncSession) -> None:
    """User A cannot see User B's fasting sessions."""
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)

    row = await create_fasting_session(db_session, user_id=user_a.id)

    # User B cannot get A's session
    result = await get_fasting_session(db_session, user_id=user_b.id, session_id=row.id)
    assert result is None

    # User B's list should not include A's session
    b_list = await list_fasting_sessions(db_session, user_id=user_b.id)
    b_ids = {r.id for r in b_list}
    assert row.id not in b_ids
