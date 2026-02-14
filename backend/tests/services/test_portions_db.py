"""Test portion service database operations."""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.enums import Unit
from app.services.portions import (
    PortionConflict,
    create_portion,
    get_portion,
    list_portions,
    soft_delete_portion,
    update_portion,
)
from tests.factories import create_device, create_product
from tests.factories import create_portion as factory_create_portion


@pytest.mark.asyncio
async def test_create_portion_first_is_default(db_session: AsyncSession):
    """Test that the first portion is automatically set as default."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)

    portion = await create_portion(
        db_session,
        device_id=device.id,
        product_id=product.id,
        label="100g",
        base_amount=Decimal("100"),
        base_unit=Unit.g,
        calories=Decimal("200"),
        protein=Decimal("10"),
        carbs=Decimal("20"),
        fat=Decimal("5"),
        is_default=False,  # Even if False, first portion becomes default
    )

    assert portion.is_default is True


@pytest.mark.asyncio
async def test_create_portion_explicit_default_clears_others(db_session: AsyncSession):
    """Test that creating a portion with is_default=True clears other defaults."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)

    portion1 = await create_portion(
        db_session,
        device_id=device.id,
        product_id=product.id,
        label="100g",
        base_amount=Decimal("100"),
        base_unit=Unit.g,
        calories=Decimal("200"),
        protein=Decimal("10"),
        carbs=Decimal("20"),
        fat=Decimal("5"),
        is_default=True,
    )

    portion2 = await create_portion(
        db_session,
        device_id=device.id,
        product_id=product.id,
        label="1 piece",
        base_amount=Decimal("50"),
        base_unit=Unit.g,
        calories=Decimal("100"),
        protein=Decimal("5"),
        carbs=Decimal("10"),
        fat=Decimal("2.5"),
        is_default=True,
    )

    # Refresh portion1 to get updated data
    await db_session.refresh(portion1)

    assert portion1.is_default is False
    assert portion2.is_default is True


@pytest.mark.asyncio
async def test_create_portion_product_not_found(db_session: AsyncSession):
    """Test that creating a portion for non-existent product returns None."""
    device = await create_device(db_session)

    result = await create_portion(
        db_session,
        device_id=device.id,
        product_id=uuid.uuid4(),
        label="100g",
        base_amount=Decimal("100"),
        base_unit=Unit.g,
        calories=Decimal("200"),
        protein=Decimal("10"),
        carbs=Decimal("20"),
        fat=Decimal("5"),
        is_default=False,
    )

    assert result is None


@pytest.mark.asyncio
async def test_create_portion_wrong_device(db_session: AsyncSession):
    """Test that creating a portion for another device's product fails."""
    device1 = await create_device(db_session)
    device2 = await create_device(db_session)
    product = await create_product(db_session, device1.id)

    result = await create_portion(
        db_session,
        device_id=device2.id,
        product_id=product.id,
        label="100g",
        base_amount=Decimal("100"),
        base_unit=Unit.g,
        calories=Decimal("200"),
        protein=Decimal("10"),
        carbs=Decimal("20"),
        fat=Decimal("5"),
        is_default=False,
    )

    assert result is None


@pytest.mark.asyncio
async def test_list_portions_empty(db_session: AsyncSession):
    """Test listing portions when there are none."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)

    portions = await list_portions(db_session, device_id=device.id, product_id=product.id)

    assert portions == []


@pytest.mark.asyncio
async def test_list_portions_ordered(db_session: AsyncSession):
    """Test that portions are ordered by is_default desc, then label asc."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)

    await factory_create_portion(
        db_session, device.id, product.id, label="C portion", is_default=False
    )
    await factory_create_portion(
        db_session, device.id, product.id, label="A portion", is_default=True
    )
    await factory_create_portion(
        db_session, device.id, product.id, label="B portion", is_default=False
    )

    portions = await list_portions(db_session, device_id=device.id, product_id=product.id)

    assert len(portions) == 3
    assert portions[0].label == "A portion"  # Default first
    assert portions[1].label == "B portion"  # Then alphabetical
    assert portions[2].label == "C portion"


@pytest.mark.asyncio
async def test_list_portions_excludes_deleted(db_session: AsyncSession):
    """Test that soft-deleted portions are not listed."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)

    _portion1 = await factory_create_portion(db_session, device.id, product.id, label="Keep")
    portion2 = await factory_create_portion(db_session, device.id, product.id, label="Delete")

    # Create a third portion to become the default before deleting portion2
    _portion3 = await factory_create_portion(
        db_session, device.id, product.id, label="Backup", is_default=False
    )

    await soft_delete_portion(db_session, device_id=device.id, portion_id=portion2.id)

    portions = await list_portions(db_session, device_id=device.id, product_id=product.id)

    labels = [p.label for p in portions]
    assert "Delete" not in labels
    assert "Keep" in labels


@pytest.mark.asyncio
async def test_list_portions_device_scoped(db_session: AsyncSession):
    """Test that portions are scoped by device."""
    device1 = await create_device(db_session)
    device2 = await create_device(db_session)
    product1 = await create_product(db_session, device1.id)
    product2 = await create_product(db_session, device2.id)

    await factory_create_portion(db_session, device1.id, product1.id, label="Device1 Portion")
    await factory_create_portion(db_session, device2.id, product2.id, label="Device2 Portion")

    portions1 = await list_portions(db_session, device_id=device1.id, product_id=product1.id)
    portions2 = await list_portions(db_session, device_id=device2.id, product_id=product2.id)

    assert len(portions1) == 1
    assert portions1[0].label == "Device1 Portion"
    assert len(portions2) == 1
    assert portions2[0].label == "Device2 Portion"


@pytest.mark.asyncio
async def test_get_portion_found(db_session: AsyncSession):
    """Test getting a portion by ID."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)
    portion = await factory_create_portion(db_session, device.id, product.id)

    result = await get_portion(db_session, device_id=device.id, portion_id=portion.id)

    assert result is not None
    assert result.id == portion.id


@pytest.mark.asyncio
async def test_get_portion_not_found(db_session: AsyncSession):
    """Test getting a non-existent portion."""
    device = await create_device(db_session)

    result = await get_portion(db_session, device_id=device.id, portion_id=uuid.uuid4())

    assert result is None


@pytest.mark.asyncio
async def test_get_portion_wrong_device(db_session: AsyncSession):
    """Test that portions from other devices cannot be accessed."""
    device1 = await create_device(db_session)
    device2 = await create_device(db_session)
    product = await create_product(db_session, device1.id)
    portion = await factory_create_portion(db_session, device1.id, product.id)

    result = await get_portion(db_session, device_id=device2.id, portion_id=portion.id)

    assert result is None


@pytest.mark.asyncio
async def test_get_portion_deleted(db_session: AsyncSession):
    """Test that soft-deleted portions cannot be retrieved."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)
    portion1 = await factory_create_portion(db_session, device.id, product.id)
    _portion2 = await factory_create_portion(db_session, device.id, product.id, is_default=False)

    await soft_delete_portion(db_session, device_id=device.id, portion_id=portion1.id)

    result = await get_portion(db_session, device_id=device.id, portion_id=portion1.id)

    assert result is None


@pytest.mark.asyncio
async def test_update_portion_set_default(db_session: AsyncSession):
    """Test updating a portion to be the default."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)

    portion1 = await factory_create_portion(
        db_session, device.id, product.id, label="First", is_default=True
    )
    portion2 = await factory_create_portion(
        db_session, device.id, product.id, label="Second", is_default=False
    )

    updated = await update_portion(
        db_session,
        device_id=device.id,
        portion_id=portion2.id,
        patch={"is_default": True},
    )

    await db_session.refresh(portion1)

    assert updated.is_default is True
    assert portion1.is_default is False


@pytest.mark.asyncio
async def test_update_portion_cannot_unset_default(db_session: AsyncSession):
    """Test that unsetting the default portion raises PortionConflict."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)

    portion = await factory_create_portion(db_session, device.id, product.id, is_default=True)

    with pytest.raises(PortionConflict):
        await update_portion(
            db_session,
            device_id=device.id,
            portion_id=portion.id,
            patch={"is_default": False},
        )


@pytest.mark.asyncio
async def test_update_portion_other_fields(db_session: AsyncSession):
    """Test updating other fields without touching is_default."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)

    portion = await factory_create_portion(
        db_session,
        device.id,
        product.id,
        label="Original",
        calories=Decimal("200"),
    )

    updated = await update_portion(
        db_session,
        device_id=device.id,
        portion_id=portion.id,
        patch={"label": "Updated", "calories": Decimal("250")},
    )

    assert updated.label == "Updated"
    assert updated.calories == Decimal("250")


@pytest.mark.asyncio
async def test_soft_delete_portion_promotes_next(db_session: AsyncSession):
    """Test that deleting the default portion promotes the next one."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)

    portion1 = await factory_create_portion(
        db_session, device.id, product.id, label="First", is_default=True
    )
    portion2 = await factory_create_portion(
        db_session, device.id, product.id, label="Second", is_default=False
    )

    result = await soft_delete_portion(db_session, device_id=device.id, portion_id=portion1.id)

    await db_session.refresh(portion2)

    assert result is True
    assert portion2.is_default is True


@pytest.mark.asyncio
async def test_soft_delete_portion_only_default_raises(db_session: AsyncSession):
    """Test that deleting the only default portion raises PortionConflict."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)

    portion = await factory_create_portion(db_session, device.id, product.id, is_default=True)

    with pytest.raises(PortionConflict):
        await soft_delete_portion(db_session, device_id=device.id, portion_id=portion.id)


@pytest.mark.asyncio
async def test_soft_delete_portion_non_default(db_session: AsyncSession):
    """Test deleting a non-default portion."""
    device = await create_device(db_session)
    product = await create_product(db_session, device.id)

    portion1 = await factory_create_portion(
        db_session, device.id, product.id, label="First", is_default=True
    )
    portion2 = await factory_create_portion(
        db_session, device.id, product.id, label="Second", is_default=False
    )

    result = await soft_delete_portion(db_session, device_id=device.id, portion_id=portion2.id)

    assert result is True
    # portion1 should still be default
    await db_session.refresh(portion1)
    assert portion1.is_default is True


@pytest.mark.asyncio
async def test_soft_delete_portion_not_found(db_session: AsyncSession):
    """Test soft deleting a non-existent portion."""
    device = await create_device(db_session)

    result = await soft_delete_portion(db_session, device_id=device.id, portion_id=uuid.uuid4())

    assert result is False
