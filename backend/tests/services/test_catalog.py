"""Test catalog service database operations."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.catalog.models import CatalogPortion, CatalogProduct
from app.features.catalog.service import (
    get_catalog_product,
    get_default_portion,
    list_catalog_products,
)
from tests.factories import create_catalog_product


def _unique_name(prefix: str) -> str:
    """Return a unique product name for test isolation."""
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


@pytest.mark.asyncio
async def test_list_catalog_products_returns_all(db_session: AsyncSession) -> None:
    """Basic list returns inserted products matching a search."""
    marker = uuid.uuid4().hex[:8]
    p1 = await create_catalog_product(
        db_session,
        name=f"ChickenBreast-{marker}",
        display_name=f"ChickenBreast-{marker}",
    )
    p2 = await create_catalog_product(
        db_session,
        name=f"BrownRice-{marker}",
        display_name=f"BrownRice-{marker}",
    )
    await db_session.commit()

    results = await list_catalog_products(db_session, search=marker, limit=200, offset=0)

    ids = {r.id for r in results}
    assert p1.id in ids
    assert p2.id in ids


@pytest.mark.asyncio
async def test_list_catalog_products_search_filters_by_name(db_session: AsyncSession) -> None:
    """search=<marker> returns only matching products via ILIKE fallback."""
    # Use a unique marker so we don't pick up leftovers from previous runs
    marker = uuid.uuid4().hex[:8]
    await create_catalog_product(
        db_session,
        name=f"HummusZZZ-{marker} Classic",
        display_name=f"HummusZZZ-{marker} Classic",
    )
    await create_catalog_product(
        db_session,
        name=f"ChickpeaZZZ-{marker} Salad",
        display_name=f"ChickpeaZZZ-{marker} Salad",
    )
    await db_session.commit()

    results = await list_catalog_products(
        db_session, search=f"HummusZZZ-{marker}", limit=50, offset=0
    )

    assert len(results) == 1
    assert "HummusZZZ" in results[0].display_name


@pytest.mark.asyncio
async def test_list_catalog_products_search_case_insensitive(db_session: AsyncSession) -> None:
    """Search is case-insensitive."""
    marker = uuid.uuid4().hex[:8]
    name = f"AlmondButter-{marker}"
    await create_catalog_product(db_session, name=name, display_name=name)
    await db_session.commit()

    results = await list_catalog_products(
        db_session, search=f"ALMONDBUTTER-{marker}", limit=50, offset=0
    )

    assert len(results) == 1
    assert results[0].display_name == name


@pytest.mark.asyncio
async def test_list_catalog_products_pagination(db_session: AsyncSession) -> None:
    """limit/offset works correctly."""
    marker = uuid.uuid4().hex[:8]
    for i in range(5):
        await create_catalog_product(
            db_session,
            name=f"PaginatedItem-{marker}-{i:02d}",
            display_name=f"PaginatedItem-{marker}-{i:02d}",
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
    product = await create_catalog_product(db_session, name=_unique_name("Oat Milk"))
    await db_session.commit()

    result = await get_catalog_product(db_session, catalog_product_id=product.id)

    assert result is not None
    assert result.id == product.id
    assert "Oat Milk" in result.display_name


@pytest.mark.asyncio
async def test_get_catalog_product_not_found(db_session: AsyncSession) -> None:
    """Returns None for unknown id."""
    result = await get_catalog_product(
        db_session, catalog_product_id=uuid.uuid4()
    )

    assert result is None


def test_get_default_portion_returns_default() -> None:
    """Returns the portion with is_default=True."""
    product = CatalogProduct(
        id=uuid.uuid4(),
        source="usda",
        source_id="12345",
        name="Test",
        display_name="Test",
    )
    non_default = CatalogPortion(id=uuid.uuid4(), label="1 tbsp", is_default=False)
    default = CatalogPortion(id=uuid.uuid4(), label="100 g", is_default=True)
    product.portions = [non_default, default]

    result = get_default_portion(product)

    assert result is default


def test_get_default_portion_returns_none_when_no_default() -> None:
    """Returns None when no portion has is_default=True."""
    product = CatalogProduct(
        id=uuid.uuid4(),
        source="usda",
        source_id="12346",
        name="Test",
        display_name="Test",
    )
    portion = CatalogPortion(id=uuid.uuid4(), label="1 tbsp", is_default=False)
    product.portions = [portion]

    result = get_default_portion(product)

    assert result is None


def test_get_default_portion_returns_none_when_no_portions() -> None:
    """Returns None when the product has no portions at all."""
    product = CatalogProduct(
        id=uuid.uuid4(),
        source="usda",
        source_id="12347",
        name="Test",
        display_name="Test",
    )
    product.portions = []

    result = get_default_portion(product)

    assert result is None


# ---------------------------------------------------------------------------
# tsvector search tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_catalog_products_tsvector_search(db_session: AsyncSession) -> None:
    """Tsvector search: 'chicken' finds 'Chicken breast, grilled' via stemming."""
    marker = uuid.uuid4().hex[:8]
    await create_catalog_product(
        db_session,
        name=f"Chicken breast grilled {marker}",
        display_name=f"Chicken breast grilled {marker}",
    )
    await create_catalog_product(
        db_session,
        name=f"Brown rice {marker}",
        display_name=f"Brown rice {marker}",
    )
    await db_session.commit()

    results = await list_catalog_products(
        db_session, search=f"chicken {marker}", limit=50, offset=0
    )

    assert len(results) >= 1
    assert all("Chicken" in r.display_name for r in results)


@pytest.mark.asyncio
async def test_list_catalog_products_tsvector_fallback_to_ilike(db_session: AsyncSession) -> None:
    """ILIKE catches terms that tsvector doesn't stem well (combined query)."""
    marker = uuid.uuid4().hex[:8]
    # Create a product with a brand-like name that won't stem well
    await create_catalog_product(
        db_session,
        name=f"XyloFoodz-{marker} Bar",
        display_name=f"XyloFoodz-{marker} Bar",
    )
    await db_session.commit()

    # Search for the unique marker — tsvector won't match it, ILIKE should
    results = await list_catalog_products(
        db_session, search=f"XyloFoodz-{marker}", limit=50, offset=0
    )

    assert len(results) == 1
    assert f"XyloFoodz-{marker}" in results[0].display_name


@pytest.mark.asyncio
async def test_list_catalog_products_short_query_uses_ilike(db_session: AsyncSession) -> None:
    """2-char query uses ILIKE directly (too short for tsvector)."""
    marker = uuid.uuid4().hex[:8]
    await create_catalog_product(
        db_session,
        name=f"QZ{marker} Snack",
        display_name=f"QZ{marker} Snack",
    )
    await db_session.commit()

    # 2-char search prefix
    results = await list_catalog_products(
        db_session, search="QZ", limit=50, offset=0
    )

    # Should find it via ILIKE
    found = [r for r in results if marker in r.display_name]
    assert len(found) >= 1


@pytest.mark.asyncio
async def test_list_catalog_products_search_by_brand(db_session: AsyncSession) -> None:
    """Tsvector search finds product via brand field."""
    marker = uuid.uuid4().hex[:8]
    await create_catalog_product(
        db_session,
        name=f"Granola Bar {marker}",
        display_name=f"Granola Bar {marker}",
        brand=f"NatureBrand{marker}",
    )
    await db_session.commit()

    results = await list_catalog_products(
        db_session, search=f"NatureBrand{marker}", limit=50, offset=0
    )

    # Should find via tsvector (brand is in search_vector) or ILIKE fallback
    assert len(results) >= 1
    assert any(marker in r.display_name for r in results)
