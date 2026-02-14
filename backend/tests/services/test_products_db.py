"""Test product service database operations."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.products import (
    create_product,
    get_product,
    list_products,
    soft_delete_product,
    update_product,
)
from tests.factories import create_device


@pytest.mark.asyncio
async def test_create_product(db_session: AsyncSession):
    """Test creating a product."""
    device = await create_device(db_session)
    product = await create_product(db_session, device_id=device.id, name="Apple")

    assert product.id is not None
    assert product.device_id == device.id
    assert product.name == "Apple"
    assert product.created_at is not None
    assert product.deleted_at is None


@pytest.mark.asyncio
async def test_create_product_with_id(db_session: AsyncSession):
    """Test creating a product with explicit ID."""
    device = await create_device(db_session)
    product_id = uuid.uuid4()
    product = await create_product(
        db_session, device_id=device.id, name="Banana", product_id=product_id
    )

    assert product.id == product_id
    assert product.name == "Banana"


@pytest.mark.asyncio
async def test_list_products_empty(db_session: AsyncSession):
    """Test listing products when there are none."""
    device = await create_device(db_session)
    products = await list_products(db_session, device_id=device.id)

    assert products == []


@pytest.mark.asyncio
async def test_list_products_alphabetical(db_session: AsyncSession):
    """Test that products are returned in alphabetical order."""
    device = await create_device(db_session)
    await create_product(db_session, device_id=device.id, name="Carrot")
    await create_product(db_session, device_id=device.id, name="Apple")
    await create_product(db_session, device_id=device.id, name="Banana")

    products = await list_products(db_session, device_id=device.id)

    assert len(products) == 3
    assert products[0].name == "Apple"
    assert products[1].name == "Banana"
    assert products[2].name == "Carrot"


@pytest.mark.asyncio
async def test_list_products_excludes_deleted(db_session: AsyncSession):
    """Test that soft-deleted products are not listed."""
    device = await create_device(db_session)
    await create_product(db_session, device_id=device.id, name="Apple")
    product2 = await create_product(db_session, device_id=device.id, name="Banana")

    # Soft delete product2
    await soft_delete_product(db_session, device_id=device.id, product_id=product2.id)

    products = await list_products(db_session, device_id=device.id)

    assert len(products) == 1
    assert products[0].name == "Apple"


@pytest.mark.asyncio
async def test_list_products_device_scoped(db_session: AsyncSession):
    """Test that products are scoped by device."""
    device1 = await create_device(db_session)
    device2 = await create_device(db_session)
    await create_product(db_session, device_id=device1.id, name="Device1 Product")
    await create_product(db_session, device_id=device2.id, name="Device2 Product")

    products1 = await list_products(db_session, device_id=device1.id)
    products2 = await list_products(db_session, device_id=device2.id)

    assert len(products1) == 1
    assert products1[0].name == "Device1 Product"
    assert len(products2) == 1
    assert products2[0].name == "Device2 Product"


@pytest.mark.asyncio
async def test_get_product_found(db_session: AsyncSession):
    """Test getting a product by ID."""
    device = await create_device(db_session)
    product = await create_product(db_session, device_id=device.id, name="Apple")

    result = await get_product(db_session, device_id=device.id, product_id=product.id)

    assert result is not None
    assert result.id == product.id
    assert result.name == "Apple"


@pytest.mark.asyncio
async def test_get_product_not_found(db_session: AsyncSession):
    """Test getting a non-existent product."""
    device = await create_device(db_session)

    result = await get_product(db_session, device_id=device.id, product_id=uuid.uuid4())

    assert result is None


@pytest.mark.asyncio
async def test_get_product_wrong_device(db_session: AsyncSession):
    """Test that products from other devices cannot be accessed."""
    device1 = await create_device(db_session)
    device2 = await create_device(db_session)
    product = await create_product(db_session, device_id=device1.id, name="Apple")

    result = await get_product(db_session, device_id=device2.id, product_id=product.id)

    assert result is None


@pytest.mark.asyncio
async def test_get_product_deleted(db_session: AsyncSession):
    """Test that soft-deleted products cannot be retrieved."""
    device = await create_device(db_session)
    product = await create_product(db_session, device_id=device.id, name="Apple")
    await soft_delete_product(db_session, device_id=device.id, product_id=product.id)

    result = await get_product(db_session, device_id=device.id, product_id=product.id)

    assert result is None


@pytest.mark.asyncio
async def test_update_product_name(db_session: AsyncSession):
    """Test updating a product's name."""
    device = await create_device(db_session)
    product = await create_product(db_session, device_id=device.id, name="Aple")

    updated = await update_product(
        db_session,
        device_id=device.id,
        product_id=product.id,
        name="Apple"
    )

    assert updated is not None
    assert updated.id == product.id
    assert updated.name == "Apple"
    assert updated.updated_at >= product.updated_at


@pytest.mark.asyncio
async def test_update_product_not_found(db_session: AsyncSession):
    """Test updating a non-existent product."""
    device = await create_device(db_session)

    result = await update_product(
        db_session,
        device_id=device.id,
        product_id=uuid.uuid4(),
        name="New Name"
    )

    assert result is None


@pytest.mark.asyncio
async def test_soft_delete_product_success(db_session: AsyncSession):
    """Test soft deleting a product."""
    device = await create_device(db_session)
    product = await create_product(db_session, device_id=device.id, name="Apple")

    result = await soft_delete_product(db_session, device_id=device.id, product_id=product.id)

    assert result is True
    # Verify product is soft deleted
    deleted = await get_product(db_session, device_id=device.id, product_id=product.id)
    assert deleted is None


@pytest.mark.asyncio
async def test_soft_delete_product_not_found(db_session: AsyncSession):
    """Test soft deleting a non-existent product."""
    device = await create_device(db_session)

    result = await soft_delete_product(db_session, device_id=device.id, product_id=uuid.uuid4())

    assert result is False
