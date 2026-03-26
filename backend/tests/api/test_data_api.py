"""Integration tests for data router (reset endpoint)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt as pyjwt
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import Device, UserDevice
from app.features.auth.service import SUPABASE_MANAGED_HASH
from tests.factories import create_food_entry, create_portion, create_product, create_user


@pytest.mark.asyncio
async def test_reset_deletes_food_entries(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """DELETE /v1/data/reset soft-deletes all food entries for the user."""
    client, user_id = authenticated_client

    product = await create_product(db_session, user_id=user_id)
    portion = await create_portion(db_session, user_id=user_id, product_id=product.id, is_default=True)
    entry = await create_food_entry(db_session, user_id=user_id, product_id=product.id, portion_id=portion.id)

    response = await client.delete("/v1/data/reset")
    assert response.status_code == 204

    # Verify entry has deleted_at set
    await db_session.refresh(entry)
    assert entry.deleted_at is not None


@pytest.mark.asyncio
async def test_reset_requires_auth(app_client: AsyncClient) -> None:
    """DELETE /v1/data/reset without auth -> 401."""
    response = await app_client.delete("/v1/data/reset")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_reset_user_scoped(
    app_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Resetting user A does not touch user B's food entries."""
    # --- Use module-level EC key for JWT signing ---
    from tests.conftest import _TEST_EC_PRIVATE_KEY

    # Create user A
    user_a = await create_user(db_session)
    device_a = Device(id=uuid.uuid4(), token_hash=SUPABASE_MANAGED_HASH)
    db_session.add(device_a)
    await db_session.flush()
    ud_a = UserDevice(user_id=user_a.id, device_id=device_a.id)
    db_session.add(ud_a)
    await db_session.flush()

    # Create user B
    user_b = await create_user(db_session)
    device_b = Device(id=uuid.uuid4(), token_hash=SUPABASE_MANAGED_HASH)
    db_session.add(device_b)
    await db_session.flush()
    ud_b = UserDevice(user_id=user_b.id, device_id=device_b.id)
    db_session.add(ud_b)
    await db_session.flush()

    # Seed food entry for user A
    product_a = await create_product(db_session, user_id=user_a.id)
    portion_a = await create_portion(db_session, user_id=user_a.id, product_id=product_a.id, is_default=True)
    entry_a = await create_food_entry(db_session, user_id=user_a.id, product_id=product_a.id, portion_id=portion_a.id)

    # Seed food entry for user B
    product_b = await create_product(db_session, user_id=user_b.id)
    portion_b = await create_portion(db_session, user_id=user_b.id, product_id=product_b.id, is_default=True)
    entry_b = await create_food_entry(db_session, user_id=user_b.id, product_id=product_b.id, portion_id=portion_b.id)

    # Build JWT for user A
    payload = {
        "sub": str(user_a.supabase_id),
        "email": user_a.email,
        "aud": "authenticated",
        "exp": datetime.now(UTC) + timedelta(hours=1),
        "iat": datetime.now(UTC),
    }
    jwt_a = pyjwt.encode(payload, _TEST_EC_PRIVATE_KEY, algorithm="ES256")

    # Reset user A
    app_client.headers["Authorization"] = f"Bearer {jwt_a}"
    response = await app_client.delete("/v1/data/reset")
    assert response.status_code == 204
    app_client.headers.pop("Authorization", None)

    # User A entry is soft-deleted
    await db_session.refresh(entry_a)
    assert entry_a.deleted_at is not None

    # User B entry is untouched
    await db_session.refresh(entry_b)
    assert entry_b.deleted_at is None
