"""Tests for claim_device_data service function."""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import User, UserDevice
from app.features.auth.service import (
    DataClaimedByOther,
    DeviceNotLinked,
    claim_device_data,
)
from app.features.products.models import Product
from tests.factories import (
    create_body_weight,
    create_device,
    create_food_entry,
    create_goal,
    create_portion,
    create_product,
)


async def _create_user(session: AsyncSession, **overrides) -> User:
    """Helper to create a test user."""
    defaults = {
        "supabase_id": uuid.uuid4(),
        "email": f"test-{uuid.uuid4().hex[:8]}@example.com",
    }
    defaults.update(overrides)
    user = User(**defaults)
    session.add(user)
    await session.flush()
    await session.refresh(user)
    return user


async def _link_device(session: AsyncSession, user_id: uuid.UUID, device_id: uuid.UUID) -> UserDevice:
    """Helper to create a user_device link."""
    ud = UserDevice(user_id=user_id, device_id=device_id)
    session.add(ud)
    await session.flush()
    return ud


@pytest.mark.asyncio
async def test_claim_device_data_with_data(db_session: AsyncSession) -> None:
    """Claiming a linked device transfers all unclaimed data to user."""
    device = await create_device(db_session)
    user = await _create_user(db_session)
    await _link_device(db_session, user.id, device.id)

    # Create data on device
    product = await create_product(db_session, device.id)
    portion = await create_portion(db_session, device.id, product.id, is_default=True)
    await create_food_entry(db_session, device.id, product.id, portion.id)
    await create_goal(db_session, device.id)
    await create_body_weight(db_session, device.id, day=date(2026, 3, 1))
    await db_session.commit()

    counts = await claim_device_data(db_session, user_id=user.id, device_id=device.id)
    await db_session.commit()

    assert counts["products"] == 1
    assert counts["portions"] == 1
    assert counts["food_entries"] == 1
    assert counts["goals"] == 1
    assert counts["body_weights"] == 1

    # Verify user_id is set on the product
    result = await db_session.execute(
        select(Product).where(Product.id == product.id)
    )
    p = result.scalar_one()
    assert p.user_id == user.id
    assert p.created_on_device_id == device.id
    assert p.updated_on_device_id == device.id


@pytest.mark.asyncio
async def test_claim_device_data_idempotent(db_session: AsyncSession) -> None:
    """Re-running claim on already-claimed data returns zero counts."""
    device = await create_device(db_session)
    user = await _create_user(db_session)
    await _link_device(db_session, user.id, device.id)

    await create_product(db_session, device.id)
    await db_session.commit()

    # First claim
    counts1 = await claim_device_data(db_session, user_id=user.id, device_id=device.id)
    await db_session.commit()
    assert counts1["products"] == 1

    # Second claim — idempotent
    counts2 = await claim_device_data(db_session, user_id=user.id, device_id=device.id)
    await db_session.commit()
    assert counts2["products"] == 0
    assert counts2["portions"] == 0
    assert counts2["food_entries"] == 0
    assert counts2["goals"] == 0
    assert counts2["body_weights"] == 0


@pytest.mark.asyncio
async def test_claim_device_not_linked_raises_404(db_session: AsyncSession) -> None:
    """Claiming a device not linked to user raises ValueError (404)."""
    device = await create_device(db_session)
    user = await _create_user(db_session)
    # No link created

    with pytest.raises(DeviceNotLinked, match="not linked"):
        await claim_device_data(db_session, user_id=user.id, device_id=device.id)


@pytest.mark.asyncio
async def test_claim_device_already_claimed_by_other_raises_409(db_session: AsyncSession) -> None:
    """Data already claimed by another user raises conflict error."""
    device = await create_device(db_session)
    user_a = await _create_user(db_session)
    user_b = await _create_user(db_session)

    # Link device to both users
    await _link_device(db_session, user_a.id, device.id)
    await _link_device(db_session, user_b.id, device.id)

    await create_product(db_session, device.id)
    await db_session.commit()

    # User A claims
    await claim_device_data(db_session, user_id=user_a.id, device_id=device.id)
    await db_session.commit()

    # User B tries to claim — product already owned by user A
    with pytest.raises(DataClaimedByOther, match="different user"):
        await claim_device_data(db_session, user_id=user_b.id, device_id=device.id)


@pytest.mark.asyncio
async def test_claim_skips_soft_deleted_rows(db_session: AsyncSession) -> None:
    """Soft-deleted rows are not claimed."""
    device = await create_device(db_session)
    user = await _create_user(db_session)
    await _link_device(db_session, user.id, device.id)

    from app.features.products.service import soft_delete_product

    product = await create_product(db_session, device.id)
    await soft_delete_product(db_session, device_id=device.id, product_id=product.id)

    counts = await claim_device_data(db_session, user_id=user.id, device_id=device.id)
    await db_session.commit()

    assert counts["products"] == 0
