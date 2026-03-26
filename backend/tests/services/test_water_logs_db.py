"""Test water_logs service database operations."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.water.service import (
    create_water_log,
    get_water_log,
    list_water_logs,
    soft_delete_water_log,
    update_water_log,
)
from tests.factories import create_user
from tests.factories import create_water_log as factory_create_water_log


@pytest.mark.asyncio
async def test_create_water_log_success(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    today = date.today()

    log = await create_water_log(
        db_session,
        user_id=user.id,
        day=today,
        amount_ml=250,
    )

    assert log is not None
    assert log.day == today
    assert log.amount_ml == 250
    assert log.user_id == user.id


@pytest.mark.asyncio
async def test_create_water_log_negative_amount(db_session: AsyncSession) -> None:
    """Negative amount_ml is allowed (represents water removal)."""
    user = await create_user(db_session)

    log = await create_water_log(
        db_session,
        user_id=user.id,
        day=date.today(),
        amount_ml=-100,
    )

    assert log.amount_ml == -100


@pytest.mark.asyncio
async def test_list_water_logs_user_scoped(db_session: AsyncSession) -> None:
    """User A cannot see user B's water logs."""
    user1 = await create_user(db_session)
    user2 = await create_user(db_session)

    await factory_create_water_log(db_session, user_id=user1.id, amount_ml=250)
    await factory_create_water_log(db_session, user_id=user2.id, amount_ml=500)

    logs1 = await list_water_logs(db_session, user_id=user1.id)
    logs2 = await list_water_logs(db_session, user_id=user2.id)

    assert len(logs1) == 1
    assert logs1[0].user_id == user1.id
    assert len(logs2) == 1
    assert logs2[0].user_id == user2.id


@pytest.mark.asyncio
async def test_list_water_logs_day_range(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    today = date.today()
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)

    await factory_create_water_log(db_session, user_id=user.id, day=today, amount_ml=250)
    await factory_create_water_log(db_session, user_id=user.id, day=yesterday, amount_ml=300)
    await factory_create_water_log(db_session, user_id=user.id, day=two_days_ago, amount_ml=200)

    logs = await list_water_logs(
        db_session, user_id=user.id, from_day=yesterday, to_day=today,
    )

    assert len(logs) == 2
    days = [lg.day for lg in logs]
    assert yesterday in days
    assert today in days
    assert two_days_ago not in days


@pytest.mark.asyncio
async def test_list_water_logs_excludes_soft_deleted(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    log = await factory_create_water_log(db_session, user_id=user.id)

    await soft_delete_water_log(db_session, user_id=user.id, water_log_id=log.id)

    logs = await list_water_logs(db_session, user_id=user.id)
    assert all(lg.id != log.id for lg in logs)


@pytest.mark.asyncio
async def test_get_water_log_found(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    log = await factory_create_water_log(db_session, user_id=user.id)

    result = await get_water_log(db_session, user_id=user.id, water_log_id=log.id)

    assert result is not None
    assert result.id == log.id


@pytest.mark.asyncio
async def test_get_water_log_not_found(db_session: AsyncSession) -> None:
    user = await create_user(db_session)

    result = await get_water_log(db_session, user_id=user.id, water_log_id=uuid.uuid4())

    assert result is None


@pytest.mark.asyncio
async def test_get_water_log_cross_user_returns_none(db_session: AsyncSession) -> None:
    """Getting another user's water log returns None (not 403)."""
    user1 = await create_user(db_session)
    user2 = await create_user(db_session)
    log = await factory_create_water_log(db_session, user_id=user1.id)

    result = await get_water_log(db_session, user_id=user2.id, water_log_id=log.id)

    assert result is None


@pytest.mark.asyncio
async def test_update_water_log_success(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    log = await factory_create_water_log(db_session, user_id=user.id, amount_ml=250)

    updated = await update_water_log(
        db_session, user_id=user.id, water_log_id=log.id, amount_ml=500,
    )

    assert updated is not None
    assert updated.amount_ml == 500


@pytest.mark.asyncio
async def test_update_water_log_not_found(db_session: AsyncSession) -> None:
    user = await create_user(db_session)

    result = await update_water_log(
        db_session, user_id=user.id, water_log_id=uuid.uuid4(), amount_ml=500,
    )

    assert result is None


@pytest.mark.asyncio
async def test_soft_delete_water_log_success(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    log = await factory_create_water_log(db_session, user_id=user.id)

    result = await soft_delete_water_log(db_session, user_id=user.id, water_log_id=log.id)

    assert result is True


@pytest.mark.asyncio
async def test_soft_delete_water_log_not_found(db_session: AsyncSession) -> None:
    user = await create_user(db_session)

    result = await soft_delete_water_log(db_session, user_id=user.id, water_log_id=uuid.uuid4())

    assert result is False


@pytest.mark.asyncio
async def test_multiple_logs_per_day_allowed(db_session: AsyncSession) -> None:
    """Multiple water logs per day are allowed (unlike body weights)."""
    user = await create_user(db_session)
    today = date.today()

    log1 = await create_water_log(db_session, user_id=user.id, day=today, amount_ml=250)
    log2 = await create_water_log(db_session, user_id=user.id, day=today, amount_ml=300)

    assert log1.id != log2.id

    logs = await list_water_logs(db_session, user_id=user.id, from_day=today, to_day=today)
    ids = {lg.id for lg in logs}
    assert log1.id in ids
    assert log2.id in ids
