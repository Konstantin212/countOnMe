"""Test catalog service database operations."""

from __future__ import annotations

import random
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog_portion import CatalogPortion
from app.models.catalog_product import CatalogProduct
from app.services.catalog import (
    get_catalog_product,
    get_default_portion,
    list_catalog_products,
)


def _unique_fdc_id() -> int:
    """Generate a random fdc_id unlikely to collide across test runs."""
    return random.randint(10_000_000, 99_999_999)  # noqa: S311


def _unique_name(prefix: str) -> str:
    """Return a unique product name for test isolation."""
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


async def _create_catalog_product(
    session: AsyncSession,
    *,
    name: str,
    fdc_id: int | None = None,
    category: str | None = "Test Category",
) -> CatalogProduct:
    """Helper to insert a catalog product directly."""
    product = CatalogProduct(
        fdc_id=fdc_id if fdc_id is not None else _unique_fdc_id(),
        name=name,
        category=category,
    )
    session.add(product)
    await session.flush()
    return product


async def _create_catalog_portion(
    session: AsyncSession,
    *,
    catalog_product_id: uuid.UUID,
    label: str = "100 g",
    base_amount: float = 100.0,
    base_unit: str = "g",
    calories: float = 250.0,
    is_default: bool = False,
) -> CatalogPortion:
    """Helper to insert a catalog portion directly."""
    portion = CatalogPortion(
        catalog_product_id=catalog_product_id,
        label=label,
        base_amount=base_amount,
        base_unit=base_unit,
        gram_weight=base_amount if base_unit == "g" else None,
        calories=calories,
        is_default=is_default,
    )
    session.add(portion)
    await session.flush()
    return portion


@pytest.mark.asyncio
async def test_list_catalog_products_returns_all(db_session: AsyncSession) -> None:
    """Basic list returns inserted products (by id)."""
    p1 = await _create_catalog_product(db_session, name=_unique_name("Chicken Breast"))
    p2 = await _create_catalog_product(db_session, name=_unique_name("Brown Rice"))
    await db_session.commit()

    results = await list_catalog_products(db_session, search=None, limit=200, offset=0)

    ids = {r.id for r in results}
    assert p1.id in ids
    assert p2.id in ids


@pytest.mark.asyncio
async def test_list_catalog_products_search_filters_by_name(db_session: AsyncSession) -> None:
    """search=hummus returns only matching products."""
    # Use a unique marker so we don't pick up leftovers from previous runs
    marker = uuid.uuid4().hex[:8]
    await _create_catalog_product(db_session, name=f"HummusZZZ-{marker} Classic")
    await _create_catalog_product(db_session, name=f"ChickpeaZZZ-{marker} Salad")
    await db_session.commit()

    results = await list_catalog_products(
        db_session, search=f"HummusZZZ-{marker}", limit=50, offset=0
    )

    assert len(results) == 1
    assert "HummusZZZ" in results[0].name


@pytest.mark.asyncio
async def test_list_catalog_products_search_case_insensitive(db_session: AsyncSession) -> None:
    """Search is case-insensitive."""
    marker = uuid.uuid4().hex[:8]
    name = f"AlmondButter-{marker}"
    await _create_catalog_product(db_session, name=name)
    await db_session.commit()

    results = await list_catalog_products(
        db_session, search=f"ALMONDBUTTER-{marker}", limit=50, offset=0
    )

    assert len(results) == 1
    assert results[0].name == name


@pytest.mark.asyncio
async def test_list_catalog_products_pagination(db_session: AsyncSession) -> None:
    """limit/offset works correctly."""
    marker = uuid.uuid4().hex[:8]
    for i in range(5):
        await _create_catalog_product(
            db_session, name=f"PaginatedItem-{marker}-{i:02d}"
        )
    await db_session.commit()

    page1 = await list_catalog_products(
        db_session, search=f"PaginatedItem-{marker}", limit=2, offset=0
    )
    page2 = await list_catalog_products(
        db_session, search=f"PaginatedItem-{marker}", limit=2, offset=2
    )

    assert len(page1) == 2
    assert len(page2) == 2
    # No overlap
    page1_ids = {r.id for r in page1}
    page2_ids = {r.id for r in page2}
    assert page1_ids.isdisjoint(page2_ids)


@pytest.mark.asyncio
async def test_get_catalog_product_found(db_session: AsyncSession) -> None:
    """Returns product by id."""
    product = await _create_catalog_product(db_session, name=_unique_name("Oat Milk"))
    await db_session.commit()

    result = await get_catalog_product(db_session, catalog_product_id=product.id)

    assert result is not None
    assert result.id == product.id
    assert "Oat Milk" in result.name


@pytest.mark.asyncio
async def test_get_catalog_product_not_found(db_session: AsyncSession) -> None:
    """Returns None for unknown id."""
    result = await get_catalog_product(
        db_session, catalog_product_id=uuid.uuid4()
    )

    assert result is None


def test_get_default_portion_returns_default() -> None:
    """Returns the portion with is_default=True."""
    product = CatalogProduct(id=uuid.uuid4(), fdc_id=1, name="Test")
    non_default = CatalogPortion(id=uuid.uuid4(), label="1 tbsp", is_default=False)
    default = CatalogPortion(id=uuid.uuid4(), label="100 g", is_default=True)
    product.portions = [non_default, default]

    result = get_default_portion(product)

    assert result is default


def test_get_default_portion_returns_none_when_no_default() -> None:
    """Returns None when no portion has is_default=True."""
    product = CatalogProduct(id=uuid.uuid4(), fdc_id=2, name="Test")
    portion = CatalogPortion(id=uuid.uuid4(), label="1 tbsp", is_default=False)
    product.portions = [portion]

    result = get_default_portion(product)

    assert result is None


def test_get_default_portion_returns_none_when_no_portions() -> None:
    """Returns None when the product has no portions at all."""
    product = CatalogProduct(id=uuid.uuid4(), fdc_id=3, name="Test")
    product.portions = []

    result = get_default_portion(product)

    assert result is None


