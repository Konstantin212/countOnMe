"""Integration tests for catalog router."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import create_catalog_portion, create_catalog_product


def _unique_name(prefix: str) -> str:
    """Return a unique product name for test isolation."""
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


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
    prod_a = await create_catalog_product(db_session, name=name_a, display_name=name_a)
    prod_b = await create_catalog_product(db_session, name=name_b, display_name=name_b)
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
    """?search= filters results by display_name."""
    marker = uuid.uuid4().hex[:8]
    name_greek = f"GreekYogurt-{marker}"
    name_plain = f"PlainYogurt-{marker}"
    name_cheese = f"CheddarCheese-{marker}"
    p_greek = await create_catalog_product(db_session, name=name_greek, display_name=name_greek)
    p_plain = await create_catalog_product(db_session, name=name_plain, display_name=name_plain)
    await create_catalog_product(db_session, name=name_cheese, display_name=name_cheese)
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
        await create_catalog_product(
            db_session,
            name=f"PaginatedAPIItem-{marker}-{i:02d}",
            display_name=f"PaginatedAPIItem-{marker}-{i:02d}",
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
    product = await create_catalog_product(
        db_session, name=_unique_name("SalmonFillet"), category="Seafood"
    )
    portion1 = await create_catalog_portion(
        db_session,
        catalog_product_id=product.id,
        label="100 g",
        calories=208,
        is_default=True,
    )
    portion2 = await create_catalog_portion(
        db_session,
        catalog_product_id=product.id,
        label="1 fillet",
        calories=416,
        is_default=False,
    )
    await db_session.commit()

    client, _ = authenticated_client
    response = await client.get(f"/v1/catalog/products/{product.id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(product.id)
    assert data["category"] == "Seafood"
    assert data["source"] == "usda"
    assert data["display_name"] is not None
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
    product = await create_catalog_product(db_session, name=name, display_name=name)
    await create_catalog_portion(
        db_session,
        catalog_product_id=product.id,
        label="100 g",
        calories=160,
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


@pytest.mark.asyncio
async def test_list_catalog_products_response_includes_new_fields(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """Response includes source, source_id, display_name, brand, barcode."""
    marker = uuid.uuid4().hex[:8]
    product = await create_catalog_product(
        db_session,
        name=f"TestProduct-{marker}",
        display_name=f"TestProduct-{marker}",
        source="off",
        source_id=f"barcode-{marker}",
        brand=f"TestBrand-{marker}",
        barcode=f"1234567890{marker}",
    )
    await db_session.commit()

    client, _ = authenticated_client
    response = await client.get(f"/v1/catalog/products?search=TestProduct-{marker}")

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    item = next(i for i in data if i["id"] == str(product.id))
    assert item["source"] == "off"
    assert item["source_id"] == f"barcode-{marker}"
    assert item["display_name"] == f"TestProduct-{marker}"
    assert item["brand"] == f"TestBrand-{marker}"
    assert item["barcode"] == f"1234567890{marker}"
