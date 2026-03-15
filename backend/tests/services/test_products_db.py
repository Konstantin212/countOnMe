"""Test product service database operations."""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import Unit
from app.features.catalog.models import CatalogPortion, CatalogProduct
from app.features.products.service import (
    check_product_name_available,
    create_product,
    get_product,
    list_products,
    search_products,
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


@pytest.mark.asyncio
async def test_check_name_available_true(db_session: AsyncSession):
    """No matching product → available=True."""
    device = await create_device(db_session)

    result = await check_product_name_available(db_session, device_id=device.id, name="UniqueName123")

    assert result is True


@pytest.mark.asyncio
async def test_check_name_available_false(db_session: AsyncSession):
    """Exact case match → available=False."""
    device = await create_device(db_session)
    await create_product(db_session, device_id=device.id, name="Chicken")

    result = await check_product_name_available(db_session, device_id=device.id, name="Chicken")

    assert result is False


@pytest.mark.asyncio
async def test_check_name_case_insensitive(db_session: AsyncSession):
    """Case-insensitive match → available=False."""
    device = await create_device(db_session)
    await create_product(db_session, device_id=device.id, name="Chicken")

    result = await check_product_name_available(db_session, device_id=device.id, name="chicken")

    assert result is False


@pytest.mark.asyncio
async def test_check_name_ignores_deleted(db_session: AsyncSession):
    """Soft-deleted products don't affect availability."""
    device = await create_device(db_session)
    product = await create_product(db_session, device_id=device.id, name="Salmon")
    await soft_delete_product(db_session, device_id=device.id, product_id=product.id)

    result = await check_product_name_available(db_session, device_id=device.id, name="Salmon")

    assert result is True


@pytest.mark.asyncio
async def test_check_name_device_scoped(db_session: AsyncSession):
    """Other device's product doesn't affect current device's availability."""
    device1 = await create_device(db_session)
    device2 = await create_device(db_session)
    await create_product(db_session, device_id=device1.id, name="Tofu")

    result = await check_product_name_available(db_session, device_id=device2.id, name="Tofu")

    assert result is True


# ---------------------------------------------------------------------------
# search_products tests
# ---------------------------------------------------------------------------


async def _make_catalog_product(
    session: AsyncSession,
    name: str,
    calories: Decimal | None = None,
    base_amount: Decimal | None = None,
    protein: Decimal | None = None,
    carbs: Decimal | None = None,
    fat: Decimal | None = None,
    display_name: str | None = None,
    brand: str | None = None,
) -> CatalogProduct:
    """Helper: create a catalog product with an optional default portion."""
    source_id = uuid.uuid4().hex[:12]
    cp = CatalogProduct(
        source="usda",
        source_id=source_id,
        name=name,
        display_name=display_name if display_name is not None else name,
        brand=brand,
    )
    session.add(cp)
    await session.flush()
    await session.refresh(cp)

    if calories is not None and base_amount is not None:
        portion = CatalogPortion(
            catalog_product_id=cp.id,
            label="100g",
            base_amount=base_amount,
            base_unit=Unit.g,
            calories=calories,
            protein=protein,
            carbs=carbs,
            fat=fat,
            is_default=True,
        )
        session.add(portion)
        await session.flush()

    return cp


@pytest.mark.asyncio
async def test_search_starts_with_ranks_higher_than_contains(db_session: AsyncSession):
    """Starts-with matches rank before contains matches regardless of source."""
    marker = uuid.uuid4().hex[:8]
    device = await create_device(db_session)
    # User product: contains match ("Apple" contains "pple")
    await create_product(db_session, device_id=device.id, name=f"Apple{marker}")
    # Catalog product: starts-with match ("pple..." starts with "pple")
    await _make_catalog_product(
        db_session,
        name=f"pple{marker}",
        display_name=f"pple{marker}",
        calories=Decimal("52"),
        base_amount=Decimal("100"),
    )

    results = await search_products(db_session, device_id=device.id, q=f"pple{marker}")

    assert len(results) == 2
    # Catalog item starts with "pple" → rank 0; user item contains "pple" → rank 1
    assert results[0].source == "catalog"
    assert results[1].source == "user"


@pytest.mark.asyncio
async def test_search_interleaves_by_relevance_not_source(db_session: AsyncSession):
    """User and catalog results are interleaved by relevance, not grouped by source."""
    marker = uuid.uuid4().hex[:8]
    device = await create_device(db_session)
    # Two user products: one starts-with, one contains
    await create_product(db_session, device_id=device.id, name=f"Food{marker}Alpha")
    await create_product(db_session, device_id=device.id, name=f"XFood{marker}Beta")
    # Two catalog products: one starts-with, one contains
    await _make_catalog_product(
        db_session,
        name=f"Food{marker}Gamma",
        display_name=f"Food{marker}Gamma",
        calories=Decimal("100"),
        base_amount=Decimal("100"),
    )
    await _make_catalog_product(
        db_session,
        name=f"YFood{marker}Delta",
        display_name=f"YFood{marker}Delta",
        calories=Decimal("100"),
        base_amount=Decimal("100"),
    )

    results = await search_products(db_session, device_id=device.id, q=f"Food{marker}", limit=10)

    # Starts-with matches (rank 0): Food{marker}Alpha (user), Food{marker}Gamma (catalog)
    # Contains matches  (rank 1): XFood{marker}Beta (user), YFood{marker}Delta (catalog)
    starts_with = [r for r in results if not r.name.startswith("X") and not r.name.startswith("Y")]
    contains = [r for r in results if r.name.startswith("X") or r.name.startswith("Y")]
    # All starts-with results come before all contains results
    assert len(starts_with) == 2
    assert len(contains) == 2
    starts_with_indices = [results.index(r) for r in starts_with]
    contains_indices = [results.index(r) for r in contains]
    assert max(starts_with_indices) < min(contains_indices)


@pytest.mark.asyncio
async def test_search_total_truncated_to_limit(db_session: AsyncSession):
    """Results are truncated to limit after merging both sources."""
    marker = uuid.uuid4().hex[:8]
    device = await create_device(db_session)
    for i in range(4):
        await create_product(db_session, device_id=device.id, name=f"Food{marker}{i}")
    for i in range(4):
        await _make_catalog_product(
            db_session,
            name=f"Food{marker}Cat{i}",
            display_name=f"Food{marker}Cat{i}",
            calories=Decimal("100"),
            base_amount=Decimal("100"),
        )

    results = await search_products(db_session, device_id=device.id, q=f"Food{marker}", limit=5)

    assert len(results) == 5


@pytest.mark.asyncio
async def test_search_calories_per_100g_computed(db_session: AsyncSession):
    """calories_per_100g = round(calories / base_amount * 100, 2)."""
    marker = uuid.uuid4().hex[:8]
    device = await create_device(db_session)
    await _make_catalog_product(
        db_session,
        name=f"Beef{marker}",
        calories=Decimal("250"),
        base_amount=Decimal("100"),
    )

    results = await search_products(db_session, device_id=device.id, q=f"Beef{marker}")

    catalog_results = [r for r in results if r.source == "catalog"]
    assert len(catalog_results) == 1
    assert catalog_results[0].calories_per_100g == 250.0


@pytest.mark.asyncio
async def test_search_catalog_no_default_portion_null_calories(db_session: AsyncSession):
    """Catalog product with no default portion → calories_per_100g=None."""
    marker = uuid.uuid4().hex[:8]
    device = await create_device(db_session)
    await _make_catalog_product(db_session, name=f"Rice{marker}")

    results = await search_products(db_session, device_id=device.id, q=f"Rice{marker}")

    assert len(results) == 1
    assert results[0].source == "catalog"
    assert results[0].calories_per_100g is None


@pytest.mark.asyncio
async def test_search_limit_cap(db_session: AsyncSession):
    """Total results capped at limit param."""
    marker = uuid.uuid4().hex[:8]
    device = await create_device(db_session)
    for i in range(5):
        await create_product(db_session, device_id=device.id, name=f"Limitfood{marker}{i}")
    for i in range(5):
        await _make_catalog_product(
            db_session,
            name=f"Limitcat{marker}{i}",
            calories=Decimal("100"),
            base_amount=Decimal("100"),
        )

    results = await search_products(db_session, device_id=device.id, q=marker, limit=6)

    assert len(results) <= 6


@pytest.mark.asyncio
async def test_search_excludes_deleted_user_products(db_session: AsyncSession):
    """Soft-deleted user products not returned."""
    marker = uuid.uuid4().hex[:8]
    device = await create_device(db_session)
    product = await create_product(db_session, device_id=device.id, name=f"DeleteMe{marker}")
    await soft_delete_product(db_session, device_id=device.id, product_id=product.id)

    results = await search_products(db_session, device_id=device.id, q=f"DeleteMe{marker}")

    user_results = [r for r in results if r.source == "user"]
    assert len(user_results) == 0


@pytest.mark.asyncio
async def test_search_device_scoped_user_products(db_session: AsyncSession):
    """Only current device's user products returned, not other devices'."""
    marker = uuid.uuid4().hex[:8]
    device1 = await create_device(db_session)
    device2 = await create_device(db_session)
    await create_product(db_session, device_id=device1.id, name=f"ScopedItem{marker}")
    await create_product(db_session, device_id=device2.id, name=f"ScopedItem{marker}")

    results = await search_products(db_session, device_id=device1.id, q=f"ScopedItem{marker}")

    user_results = [r for r in results if r.source == "user"]
    assert len(user_results) == 1


@pytest.mark.asyncio
async def test_search_macros_per_100g_computed(db_session: AsyncSession):
    """protein/carbs/fat_per_100g are computed correctly from portion data."""
    marker = uuid.uuid4().hex[:8]
    device = await create_device(db_session)
    await _make_catalog_product(
        db_session,
        name=f"MacroFood{marker}",
        calories=Decimal("250"),
        base_amount=Decimal("200"),
        protein=Decimal("50"),
        carbs=Decimal("30"),
        fat=Decimal("20"),
    )

    results = await search_products(db_session, device_id=device.id, q=f"MacroFood{marker}")

    catalog_results = [r for r in results if r.source == "catalog"]
    assert len(catalog_results) == 1
    item = catalog_results[0]
    # 50 / 200 * 100 = 25.0
    assert item.protein_per_100g == 25.0
    # 30 / 200 * 100 = 15.0
    assert item.carbs_per_100g == 15.0
    # 20 / 200 * 100 = 10.0
    assert item.fat_per_100g == 10.0


@pytest.mark.asyncio
async def test_search_catalog_no_macro_data_null(db_session: AsyncSession):
    """Catalog product with protein=None on portion → protein_per_100g=None."""
    marker = uuid.uuid4().hex[:8]
    device = await create_device(db_session)
    await _make_catalog_product(
        db_session,
        name=f"NoMacro{marker}",
        calories=Decimal("100"),
        base_amount=Decimal("100"),
        protein=None,
        carbs=None,
        fat=None,
    )

    results = await search_products(db_session, device_id=device.id, q=f"NoMacro{marker}")

    catalog_results = [r for r in results if r.source == "catalog"]
    assert len(catalog_results) == 1
    item = catalog_results[0]
    assert item.protein_per_100g is None
    assert item.carbs_per_100g is None
    assert item.fat_per_100g is None


@pytest.mark.asyncio
async def test_search_catalog_returns_display_name(db_session: AsyncSession):
    """display_name field is populated in catalog search results."""
    marker = uuid.uuid4().hex[:8]
    device = await create_device(db_session)
    await _make_catalog_product(
        db_session,
        name=f"Chicken, breast, raw {marker}",
        display_name=f"Chicken breast {marker}",
        calories=Decimal("165"),
        base_amount=Decimal("100"),
    )

    results = await search_products(db_session, device_id=device.id, q=f"Chicken breast {marker}")

    catalog_results = [r for r in results if r.source == "catalog"]
    assert len(catalog_results) == 1
    assert catalog_results[0].display_name == f"Chicken breast {marker}"


@pytest.mark.asyncio
async def test_search_catalog_returns_brand(db_session: AsyncSession):
    """brand field is populated for OFF items in catalog search results."""
    marker = uuid.uuid4().hex[:8]
    device = await create_device(db_session)
    await _make_catalog_product(
        db_session,
        name=f"Protein Bar {marker}",
        display_name=f"Protein Bar {marker}",
        brand=f"FitBrand-{marker}",
        calories=Decimal("200"),
        base_amount=Decimal("100"),
    )

    results = await search_products(db_session, device_id=device.id, q=f"Protein Bar {marker}")

    catalog_results = [r for r in results if r.source == "catalog"]
    assert len(catalog_results) == 1
    assert catalog_results[0].brand == f"FitBrand-{marker}"
