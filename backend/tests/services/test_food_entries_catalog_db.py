"""Test food_entries service — catalog portion path (ADR-010)."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import MealType, Unit
from app.features.meals.service import (
    create_food_entry,
    get_food_entry,
    list_food_entries,
    soft_delete_food_entry,
    update_food_entry,
)
from tests.factories import (
    create_catalog_portion,
    create_catalog_product,
    create_user,
)
from tests.factories import (
    create_food_entry as factory_create_entry,
)


@pytest.mark.asyncio
async def test_create_food_entry_catalog_success(db_session: AsyncSession):
    """Creating a food entry with a valid catalog_portion_id succeeds."""
    user = await create_user(db_session)
    marker = uuid.uuid4().hex[:8]
    cat_product = await create_catalog_product(
        db_session, name=f"CatalogProd {marker}", source_id=f"cat-{marker}",
    )
    cat_portion = await create_catalog_portion(
        db_session,
        catalog_product_id=cat_product.id,
        label=f"100 g {marker}",
        calories=Decimal("250"),
        protein=Decimal("10"),
        carbs=Decimal("30"),
        fat=Decimal("8"),
    )
    await db_session.commit()

    entry = await create_food_entry(
        db_session,
        user_id=user.id,
        catalog_portion_id=cat_portion.id,
        day=date.today(),
        meal_type=MealType.lunch,
        amount=Decimal("150"),
        unit=Unit.g,
    )

    assert entry is not None
    assert entry.catalog_portion_id == cat_portion.id
    assert entry.product_id is None
    assert entry.portion_id is None
    assert entry.meal_type == MealType.lunch


@pytest.mark.asyncio
async def test_create_food_entry_catalog_portion_not_found(db_session: AsyncSession):
    """Non-existent catalog_portion_id returns None."""
    user = await create_user(db_session)

    result = await create_food_entry(
        db_session,
        user_id=user.id,
        catalog_portion_id=uuid.uuid4(),
        day=date.today(),
        meal_type=MealType.breakfast,
        amount=Decimal("100"),
        unit=Unit.g,
    )

    assert result is None


@pytest.mark.asyncio
async def test_create_food_entry_catalog_any_user(db_session: AsyncSession):
    """Catalog portions are global; any user can reference them."""
    user1 = await create_user(db_session)
    user2 = await create_user(db_session)
    marker = uuid.uuid4().hex[:8]
    cat_product = await create_catalog_product(
        db_session, name=f"Global {marker}", source_id=f"global-{marker}",
    )
    cat_portion = await create_catalog_portion(
        db_session,
        catalog_product_id=cat_product.id,
        label=f"100 g {marker}",
        calories=Decimal("100"),
    )
    await db_session.commit()

    entry1 = await create_food_entry(
        db_session,
        user_id=user1.id,
        catalog_portion_id=cat_portion.id,
        day=date.today(),
        meal_type=MealType.breakfast,
        amount=Decimal("100"),
        unit=Unit.g,
    )
    entry2 = await create_food_entry(
        db_session,
        user_id=user2.id,
        catalog_portion_id=cat_portion.id,
        day=date.today(),
        meal_type=MealType.dinner,
        amount=Decimal("200"),
        unit=Unit.g,
    )

    assert entry1 is not None
    assert entry2 is not None
    assert entry1.catalog_portion_id == cat_portion.id
    assert entry2.catalog_portion_id == cat_portion.id


@pytest.mark.asyncio
async def test_list_food_entries_includes_catalog(db_session: AsyncSession):
    """List returns both private and catalog entries."""
    user = await create_user(db_session)
    marker = uuid.uuid4().hex[:8]

    cat_product = await create_catalog_product(
        db_session, name=f"ListTest {marker}", source_id=f"list-{marker}",
    )
    cat_portion = await create_catalog_portion(
        db_session,
        catalog_product_id=cat_product.id,
        label=f"100 g {marker}",
        calories=Decimal("100"),
    )
    await db_session.commit()

    # Create catalog entry via factory (bypassing service validation)
    await factory_create_entry(
        db_session,
        user_id=user.id,
        catalog_portion_id=cat_portion.id,
        day=date.today(),
    )
    await db_session.commit()

    entries = await list_food_entries(db_session, user_id=user.id, day=date.today())

    catalog_entries = [e for e in entries if e.catalog_portion_id == cat_portion.id]
    assert len(catalog_entries) >= 1


@pytest.mark.asyncio
async def test_get_food_entry_catalog(db_session: AsyncSession):
    """Get by ID works for catalog entries."""
    user = await create_user(db_session)
    marker = uuid.uuid4().hex[:8]

    cat_product = await create_catalog_product(
        db_session, name=f"GetTest {marker}", source_id=f"get-{marker}",
    )
    cat_portion = await create_catalog_portion(
        db_session,
        catalog_product_id=cat_product.id,
        label=f"100 g {marker}",
        calories=Decimal("100"),
    )
    await db_session.commit()

    entry = await factory_create_entry(
        db_session,
        user_id=user.id,
        catalog_portion_id=cat_portion.id,
        day=date.today(),
    )
    await db_session.commit()

    result = await get_food_entry(db_session, user_id=user.id, entry_id=entry.id)

    assert result is not None
    assert result.id == entry.id
    assert result.catalog_portion_id == cat_portion.id


@pytest.mark.asyncio
async def test_soft_delete_food_entry_catalog(db_session: AsyncSession):
    """Soft delete works for catalog entries."""
    user = await create_user(db_session)
    marker = uuid.uuid4().hex[:8]

    cat_product = await create_catalog_product(
        db_session, name=f"DelTest {marker}", source_id=f"del-{marker}",
    )
    cat_portion = await create_catalog_portion(
        db_session,
        catalog_product_id=cat_product.id,
        label=f"100 g {marker}",
        calories=Decimal("100"),
    )
    await db_session.commit()

    entry = await factory_create_entry(
        db_session,
        user_id=user.id,
        catalog_portion_id=cat_portion.id,
        day=date.today(),
    )
    await db_session.commit()

    ok = await soft_delete_food_entry(db_session, user_id=user.id, entry_id=entry.id)
    assert ok is True

    result = await get_food_entry(db_session, user_id=user.id, entry_id=entry.id)
    assert result is None


@pytest.mark.asyncio
async def test_update_food_entry_catalog_amount(db_session: AsyncSession):
    """Updating amount on a catalog entry succeeds."""
    user = await create_user(db_session)
    marker = uuid.uuid4().hex[:8]

    cat_product = await create_catalog_product(
        db_session, name=f"UpdTest {marker}", source_id=f"upd-{marker}",
    )
    cat_portion = await create_catalog_portion(
        db_session,
        catalog_product_id=cat_product.id,
        label=f"100 g {marker}",
        calories=Decimal("100"),
    )
    await db_session.commit()

    entry = await factory_create_entry(
        db_session,
        user_id=user.id,
        catalog_portion_id=cat_portion.id,
        day=date.today(),
        amount=Decimal("100"),
    )
    await db_session.commit()

    updated = await update_food_entry(
        db_session,
        user_id=user.id,
        entry_id=entry.id,
        patch={"amount": Decimal("250")},
    )

    assert updated is not None
    assert updated.amount == Decimal("250")


@pytest.mark.asyncio
async def test_update_food_entry_catalog_rejects_portion_id(db_session: AsyncSession):
    """Updating portion_id on a catalog entry is rejected."""
    user = await create_user(db_session)
    marker = uuid.uuid4().hex[:8]

    cat_product = await create_catalog_product(
        db_session, name=f"RejTest {marker}", source_id=f"rej-{marker}",
    )
    cat_portion = await create_catalog_portion(
        db_session,
        catalog_product_id=cat_product.id,
        label=f"100 g {marker}",
        calories=Decimal("100"),
    )
    await db_session.commit()

    entry = await factory_create_entry(
        db_session,
        user_id=user.id,
        catalog_portion_id=cat_portion.id,
        day=date.today(),
    )
    await db_session.commit()

    result = await update_food_entry(
        db_session,
        user_id=user.id,
        entry_id=entry.id,
        patch={"portion_id": uuid.uuid4()},
    )

    assert result is None
