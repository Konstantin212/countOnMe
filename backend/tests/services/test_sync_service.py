"""Unit tests for sync service — pull deltas and push mutations."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.sync.schemas import (
    MutationAction,
    MutationResultStatus,
    SyncMutation,
)
from app.features.sync.service import (
    _client_wins_lww,
    compute_sync_cursor,
    get_deltas,
    parse_sync_cursor,
    process_push,
)
from tests.factories import (
    create_product,
    create_user,
    create_water_log,
)

# ===================================================================
# Pull — get_deltas
# ===================================================================


@pytest.mark.asyncio
async def test_get_deltas_empty(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    await db_session.commit()

    changes, has_more = await get_deltas(db_session, user.id, 0)

    assert has_more is False
    for rows in changes.values():
        assert rows == []


@pytest.mark.asyncio
async def test_get_deltas_returns_products(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    await db_session.commit()

    changes, has_more = await get_deltas(db_session, user.id, 0)

    assert has_more is False
    product_ids = [r.id for r in changes["products"]]
    assert product.id in product_ids


@pytest.mark.asyncio
async def test_get_deltas_user_scoped(db_session: AsyncSession) -> None:
    """User A's data does not appear for user B."""
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)
    await create_product(db_session, user_id=user_a.id)
    await db_session.commit()

    changes, _ = await get_deltas(db_session, user_b.id, 0)
    assert changes["products"] == []


@pytest.mark.asyncio
async def test_get_deltas_respects_since_version(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    p1 = await create_product(db_session, user_id=user.id)
    await db_session.commit()

    # Record the sync_version of p1
    await db_session.refresh(p1)
    version_after_p1 = p1.sync_version

    p2 = await create_product(db_session, user_id=user.id)
    await db_session.commit()

    changes, _ = await get_deltas(db_session, user.id, version_after_p1)
    product_ids = [r.id for r in changes["products"]]
    assert p2.id in product_ids
    assert p1.id not in product_ids


@pytest.mark.asyncio
async def test_get_deltas_includes_soft_deleted(db_session: AsyncSession) -> None:
    """Soft-deleted rows appear in deltas so client can reconcile."""
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    product.deleted_at = datetime.now(UTC)
    db_session.add(product)
    await db_session.commit()

    changes, _ = await get_deltas(db_session, user.id, 0)
    product_ids = [r.id for r in changes["products"]]
    assert product.id in product_ids


@pytest.mark.asyncio
async def test_get_deltas_multiple_entity_types(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    await create_product(db_session, user_id=user.id)
    await create_water_log(db_session, user_id=user.id)
    await db_session.commit()

    changes, _ = await get_deltas(db_session, user.id, 0)
    assert len(changes["products"]) >= 1
    assert len(changes["water_logs"]) >= 1


@pytest.mark.asyncio
async def test_get_deltas_pagination(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    for _ in range(3):
        await create_product(db_session, user_id=user.id)
    await db_session.commit()

    changes, has_more = await get_deltas(db_session, user.id, 0, limit=2)
    total = sum(len(rows) for rows in changes.values())
    assert total <= 2
    assert has_more is True


# ===================================================================
# Cursor helpers
# ===================================================================


def test_compute_sync_cursor_empty() -> None:
    changes: dict[str, list] = {"products": [], "portions": []}
    assert compute_sync_cursor(changes) is None


def test_parse_sync_cursor_none() -> None:
    assert parse_sync_cursor(None) == 0


def test_parse_sync_cursor_valid() -> None:
    assert parse_sync_cursor("42|2026-03-26T10:00:00Z") == 42


def test_parse_sync_cursor_invalid() -> None:
    assert parse_sync_cursor("bad") == 0


# ===================================================================
# LWW helper
# ===================================================================


def test_client_wins_lww_newer() -> None:
    server = datetime(2026, 1, 1, tzinfo=UTC)
    client = datetime(2026, 1, 2, tzinfo=UTC)
    assert _client_wins_lww(server, client) is True


def test_client_wins_lww_equal() -> None:
    ts = datetime(2026, 1, 1, tzinfo=UTC)
    assert _client_wins_lww(ts, ts) is False


def test_client_wins_lww_older() -> None:
    server = datetime(2026, 1, 2, tzinfo=UTC)
    client = datetime(2026, 1, 1, tzinfo=UTC)
    assert _client_wins_lww(server, client) is False


# ===================================================================
# Push — process_push
# ===================================================================


@pytest.mark.asyncio
async def test_process_push_upsert_new(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    await db_session.commit()

    mutation = SyncMutation(
        entity_type="products",
        action=MutationAction.upsert,
        id=uuid.uuid4(),
        data={"name": "PushNew"},
        client_updated_at=datetime.now(UTC),
    )
    results = await process_push(db_session, user_id=user.id, mutations=[mutation])

    assert len(results) == 1
    assert results[0].status == MutationResultStatus.applied


@pytest.mark.asyncio
async def test_process_push_upsert_update(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    await db_session.commit()

    mutation = SyncMutation(
        entity_type="products",
        action=MutationAction.upsert,
        id=product.id,
        data={"name": "PushUpdated"},
        client_updated_at=datetime.now(UTC) + timedelta(seconds=60),
    )
    results = await process_push(db_session, user_id=user.id, mutations=[mutation])

    assert results[0].status == MutationResultStatus.applied


@pytest.mark.asyncio
async def test_process_push_lww_conflict(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    await db_session.commit()

    mutation = SyncMutation(
        entity_type="products",
        action=MutationAction.upsert,
        id=product.id,
        data={"name": "OldUpdate"},
        client_updated_at=datetime.now(UTC) - timedelta(hours=1),
    )
    results = await process_push(db_session, user_id=user.id, mutations=[mutation])

    assert results[0].status == MutationResultStatus.conflict


@pytest.mark.asyncio
async def test_process_push_delete(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    product = await create_product(db_session, user_id=user.id)
    await db_session.commit()

    mutation = SyncMutation(
        entity_type="products",
        action=MutationAction.delete,
        id=product.id,
        client_updated_at=datetime.now(UTC) + timedelta(seconds=60),
    )
    results = await process_push(db_session, user_id=user.id, mutations=[mutation])

    assert results[0].status == MutationResultStatus.applied


@pytest.mark.asyncio
async def test_process_push_unknown_entity(db_session: AsyncSession) -> None:
    """Unknown entity_type is rejected at Pydantic schema level."""
    with pytest.raises(ValidationError, match="literal_error"):
        SyncMutation(
            entity_type="nonexistent",
            action=MutationAction.upsert,
            id=uuid.uuid4(),
            data={},
            client_updated_at=datetime.now(UTC),
        )


@pytest.mark.asyncio
async def test_process_push_water_log(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    await db_session.commit()

    water_id = uuid.uuid4()
    mutation = SyncMutation(
        entity_type="water_logs",
        action=MutationAction.upsert,
        id=water_id,
        data={"day": "2026-03-26", "amount_ml": 500},
        client_updated_at=datetime.now(UTC),
    )
    results = await process_push(db_session, user_id=user.id, mutations=[mutation])

    assert results[0].status == MutationResultStatus.applied


@pytest.mark.asyncio
async def test_process_push_cross_user_blocked(db_session: AsyncSession) -> None:
    """Push cannot modify another user's data.

    User B tries to update user A's product. The ownership filter scopes
    by user_id so user B's lookup finds nothing. Then the insert fails
    because the PK already exists (owned by user A). This returns an error.
    """
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)
    product = await create_product(db_session, user_id=user_a.id)
    await db_session.commit()

    mutation = SyncMutation(
        entity_type="products",
        action=MutationAction.upsert,
        id=product.id,
        data={"name": "Hijacked"},
        client_updated_at=datetime.now(UTC) + timedelta(seconds=60),
    )
    results = await process_push(db_session, user_id=user_b.id, mutations=[mutation])
    # PK collision: user B cannot insert with user A's product ID
    assert results[0].status == MutationResultStatus.error
