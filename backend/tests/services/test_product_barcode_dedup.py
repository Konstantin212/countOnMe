"""Tests for product barcode deduplication in the service layer."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.products.service import (
    create_product,
    get_product_by_barcode,
)
from tests.factories import create_device


@pytest.mark.asyncio
async def test_create_product_with_barcode(db_session: AsyncSession):
    """Creating a product with a barcode stores it."""
    device = await create_device(db_session)
    product = await create_product(
        db_session, device_id=device.id, name="Milk", barcode="4901234567890"
    )

    assert product.barcode == "4901234567890"
    assert product.name == "Milk"


@pytest.mark.asyncio
async def test_create_product_duplicate_barcode_returns_existing(db_session: AsyncSession):
    """Creating a product with an existing barcode on the same device returns the existing product."""
    device = await create_device(db_session)
    original = await create_product(
        db_session, device_id=device.id, name="Milk", barcode="4901234567890"
    )

    duplicate = await create_product(
        db_session, device_id=device.id, name="Milk 2", barcode="4901234567890"
    )

    assert duplicate.id == original.id
    assert duplicate.name == "Milk"  # Original name kept


@pytest.mark.asyncio
async def test_create_product_same_barcode_different_device(db_session: AsyncSession):
    """Same barcode on different devices creates separate products."""
    device1 = await create_device(db_session)
    device2 = await create_device(db_session)

    product1 = await create_product(
        db_session, device_id=device1.id, name="Milk", barcode="4901234567890"
    )
    product2 = await create_product(
        db_session, device_id=device2.id, name="Milk", barcode="4901234567890"
    )

    assert product1.id != product2.id


@pytest.mark.asyncio
async def test_create_product_without_barcode_no_dedup(db_session: AsyncSession):
    """Products without barcodes are never deduplicated."""
    device = await create_device(db_session)

    product1 = await create_product(db_session, device_id=device.id, name="Apple")
    product2 = await create_product(db_session, device_id=device.id, name="Apple")

    assert product1.id != product2.id


@pytest.mark.asyncio
async def test_get_product_by_barcode_found(db_session: AsyncSession):
    """Lookup by barcode returns the product."""
    device = await create_device(db_session)
    product = await create_product(
        db_session, device_id=device.id, name="Juice", barcode="1234567890123"
    )

    found = await get_product_by_barcode(
        db_session, device_id=device.id, barcode="1234567890123"
    )

    assert found is not None
    assert found.id == product.id


@pytest.mark.asyncio
async def test_get_product_by_barcode_not_found(db_session: AsyncSession):
    """Lookup by barcode with no match returns None."""
    device = await create_device(db_session)

    found = await get_product_by_barcode(
        db_session, device_id=device.id, barcode="0000000000000"
    )

    assert found is None


@pytest.mark.asyncio
async def test_get_product_by_barcode_excludes_deleted(db_session: AsyncSession):
    """Soft-deleted products are not returned by barcode lookup."""
    from app.features.products.service import soft_delete_product

    device = await create_device(db_session)
    product = await create_product(
        db_session, device_id=device.id, name="Soda", barcode="9999999999999"
    )
    await soft_delete_product(db_session, device_id=device.id, product_id=product.id)

    found = await get_product_by_barcode(
        db_session, device_id=device.id, barcode="9999999999999"
    )

    assert found is None


@pytest.mark.asyncio
async def test_get_product_by_barcode_device_scoped(db_session: AsyncSession):
    """Barcode lookup is scoped to the requesting device."""
    device1 = await create_device(db_session)
    device2 = await create_device(db_session)

    await create_product(
        db_session, device_id=device1.id, name="Water", barcode="5555555555555"
    )

    found = await get_product_by_barcode(
        db_session, device_id=device2.id, barcode="5555555555555"
    )

    assert found is None


@pytest.mark.asyncio
async def test_create_product_duplicate_barcode_soft_deleted_creates_new(db_session: AsyncSession):
    """If an existing barcode product is soft-deleted, a new one is created."""
    from app.features.products.service import soft_delete_product

    device = await create_device(db_session)
    original = await create_product(
        db_session, device_id=device.id, name="Milk", barcode="4901234567890"
    )
    await soft_delete_product(db_session, device_id=device.id, product_id=original.id)

    new_product = await create_product(
        db_session, device_id=device.id, name="Milk Fresh", barcode="4901234567890"
    )

    assert new_product.id != original.id
    assert new_product.barcode == "4901234567890"
    assert new_product.name == "Milk Fresh"
