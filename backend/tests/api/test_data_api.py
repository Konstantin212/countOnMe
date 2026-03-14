"""Integration tests for data router (reset endpoint)."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import Device
from app.features.auth.service import issue_device_token
from tests.factories import create_food_entry, create_portion, create_product


@pytest.mark.asyncio
async def test_reset_deletes_food_entries(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """DELETE /v1/data/reset soft-deletes all food entries for the device."""
    client, device_id = authenticated_client

    product = await create_product(db_session, device_id)
    portion = await create_portion(db_session, device_id, product.id, is_default=True)
    entry = await create_food_entry(db_session, device_id, product.id, portion.id)

    response = await client.delete("/v1/data/reset")
    assert response.status_code == 204

    # Verify entry has deleted_at set
    await db_session.refresh(entry)
    assert entry.deleted_at is not None


@pytest.mark.asyncio
async def test_reset_requires_auth(app_client: AsyncClient) -> None:
    """DELETE /v1/data/reset without auth → 401."""
    response = await app_client.delete("/v1/data/reset")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_reset_device_scoped(
    app_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Resetting device A does not touch device B's food entries."""
    # Register device A
    device_a_id = uuid.uuid4()
    token_a, token_hash_a = issue_device_token(device_a_id)
    device_a = Device(id=device_a_id, token_hash=token_hash_a)
    db_session.add(device_a)
    await db_session.flush()

    # Register device B
    device_b_id = uuid.uuid4()
    _token_b, token_hash_b = issue_device_token(device_b_id)
    device_b = Device(id=device_b_id, token_hash=token_hash_b)
    db_session.add(device_b)
    await db_session.flush()

    # Seed food entry for device A
    product_a = await create_product(db_session, device_a_id)
    portion_a = await create_portion(db_session, device_a_id, product_a.id, is_default=True)
    entry_a = await create_food_entry(db_session, device_a_id, product_a.id, portion_a.id)

    # Seed food entry for device B
    product_b = await create_product(db_session, device_b_id)
    portion_b = await create_portion(db_session, device_b_id, product_b.id, is_default=True)
    entry_b = await create_food_entry(db_session, device_b_id, product_b.id, portion_b.id)

    # Reset device A
    app_client.headers["Authorization"] = f"Bearer {token_a}"
    response = await app_client.delete("/v1/data/reset")
    assert response.status_code == 204
    app_client.headers.pop("Authorization", None)

    # Device A entry is soft-deleted
    await db_session.refresh(entry_a)
    assert entry_a.deleted_at is not None

    # Device B entry is untouched
    await db_session.refresh(entry_b)
    assert entry_b.deleted_at is None
