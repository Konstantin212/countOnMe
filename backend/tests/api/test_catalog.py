"""Integration tests for catalog router."""

from __future__ import annotations

import random
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog_portion import CatalogPortion
from app.models.catalog_product import CatalogProduct


def _unique_fdc_id() -> int:
    """Generate a random fdc_id unlikely to collide across test runs."""
    return random.randint(10_000_000, 99_999_999)  # noqa: S311


def _unique_name(prefix: str) -> str:
    """Return a unique product name for test isolation."""
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


async def _insert_catalog_product(
    session: AsyncSession,
    *,
    name: str,
    fdc_id: int | None = None,
    category: str | None = None,
) -> CatalogProduct:
    product = CatalogProduct(
        fdc_id=fdc_id if fdc_id is not None else _unique_fdc_id(),
        name=name,
        category=category,
    )
    session.add(product)
    await session.flush()
    return product


async def _insert_catalog_portion(
    session: AsyncSession,
    *,
    catalog_product_id: uuid.UUID,
    label: str = "100 g",
    calories: float = 200.0,
    is_default: bool = False,
) -> CatalogPortion:
    portion = CatalogPortion(
        catalog_product_id=catalog_product_id,
        label=label,
        base_amount=100.0,
        base_unit="g",
        gram_weight=100.0,
        calories=calories,
        is_default=is_default,
    )
    session.add(portion)
    await session.flush()
    return portion


@pytest.mark.asyncio
async def test_list_catalog_products_requires_auth(app_client: AsyncClient) -> None:
    """Returns 401 without a bearer token."""
    response = await app_client.get("/v1/catalog/products")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_catalog_products_returns_list(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """Authenticated device gets a list of catalog products."""
    marker = uuid.uuid4().hex[:8]
    name_a = f"WholeWheatBread-{marker}"
    name_b = f"CheddarCheese-{marker}"
    prod_a = await _insert_catalog_product(db_session, name=name_a)
    prod_b = await _insert_catalog_product(db_session, name=name_b)
    await db_session.commit()

    client, _ = authenticated_client
    # Use the unique marker to filter so results are deterministic
    response = await client.get(f"/v1/catalog/products?search={marker}")

    assert response.status_code == 200
    data = response.json()
    ids = {item["id"] for item in data}
    assert str(prod_a.id) in ids
    assert str(prod_b.id) in ids


@pytest.mark.asyncio
async def test_list_catalog_products_search(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """?search= filters results by name."""
    marker = uuid.uuid4().hex[:8]
    name_greek = f"GreekYogurt-{marker}"
    name_plain = f"PlainYogurt-{marker}"
    name_cheese = f"CheddarCheese-{marker}"
    p_greek = await _insert_catalog_product(db_session, name=name_greek)
    p_plain = await _insert_catalog_product(db_session, name=name_plain)
    await _insert_catalog_product(db_session, name=name_cheese)
    await db_session.commit()

    client, _ = authenticated_client
    response = await client.get(f"/v1/catalog/products?search=Yogurt-{marker}")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    ids = {item["id"] for item in data}
    assert str(p_greek.id) in ids
    assert str(p_plain.id) in ids


@pytest.mark.asyncio
async def test_list_catalog_products_pagination(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """limit and offset query params work."""
    marker = uuid.uuid4().hex[:8]
    for i in range(5):
        await _insert_catalog_product(
            db_session, name=f"PaginatedAPIItem-{marker}-{i:02d}"
        )
    await db_session.commit()

    client, _ = authenticated_client
    page1 = await client.get(
        f"/v1/catalog/products?search=PaginatedAPIItem-{marker}&limit=2&offset=0"
    )
    page2 = await client.get(
        f"/v1/catalog/products?search=PaginatedAPIItem-{marker}&limit=2&offset=2"
    )

    assert page1.status_code == 200
    assert page2.status_code == 200
    assert len(page1.json()) == 2
    assert len(page2.json()) == 2
    ids1 = {item["id"] for item in page1.json()}
    ids2 = {item["id"] for item in page2.json()}
    assert ids1.isdisjoint(ids2)


@pytest.mark.asyncio
async def test_get_catalog_product_returns_product_with_portions(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """GET /catalog/products/{id} returns the product with all its portions."""
    product = await _insert_catalog_product(
        db_session, name=_unique_name("SalmonFillet"), category="Seafood"
    )
    portion1 = await _insert_catalog_portion(
        db_session,
        catalog_product_id=product.id,
        label="100 g",
        calories=208.0,
        is_default=True,
    )
    portion2 = await _insert_catalog_portion(
        db_session,
        catalog_product_id=product.id,
        label="1 fillet",
        calories=416.0,
    )
    await db_session.commit()

    client, _ = authenticated_client
    response = await client.get(f"/v1/catalog/products/{product.id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(product.id)
    assert data["category"] == "Seafood"
    portion_ids = {p["id"] for p in data["portions"]}
    assert str(portion1.id) in portion_ids
    assert str(portion2.id) in portion_ids
    assert len(data["portions"]) == 2


@pytest.mark.asyncio
async def test_get_catalog_product_not_found(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
) -> None:
    """GET /catalog/products/{unknown_id} returns 404."""
    client, _ = authenticated_client
    response = await client.get(f"/v1/catalog/products/{uuid.uuid4()}")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_catalog_products_default_portion_included(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """List endpoint includes the default_portion field."""
    marker = uuid.uuid4().hex[:8]
    name = f"Avocado-{marker}"
    product = await _insert_catalog_product(db_session, name=name)
    await _insert_catalog_portion(
        db_session,
        catalog_product_id=product.id,
        label="100 g",
        calories=160.0,
        is_default=True,
    )
    await db_session.commit()

    client, _ = authenticated_client
    response = await client.get(f"/v1/catalog/products?search=Avocado-{marker}")

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    avocado = next(item for item in data if item["id"] == str(product.id))
    assert avocado["default_portion"] is not None
    assert avocado["default_portion"]["label"] == "100 g"
    assert avocado["default_portion"]["is_default"] is True
