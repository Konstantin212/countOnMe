"""Integration tests for catalog barcode lookup route."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import create_catalog_portion, create_catalog_product


def _unique_barcode() -> str:
    """Return a unique barcode string for test isolation."""
    return f"BC-{uuid.uuid4().hex[:12]}"


@pytest.mark.asyncio
async def test_barcode_lookup_requires_auth(app_client: AsyncClient) -> None:
    """Returns 401 without a bearer token."""
    response = await app_client.get("/v1/catalog/products/barcode/1234567890")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_barcode_lookup_found(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """GET barcode route returns 200 with product data when found."""
    barcode = _unique_barcode()
    product = await create_catalog_product(
        db_session,
        name=f"BarcodeAPIProduct-{barcode}",
        barcode=barcode,
    )
    await db_session.commit()

    client, _ = authenticated_client
    response = await client.get(f"/v1/catalog/products/barcode/{barcode}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(product.id)
    assert data["barcode"] == barcode


@pytest.mark.asyncio
async def test_barcode_lookup_not_found(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
) -> None:
    """GET barcode route returns 404 for unknown barcode."""
    client, _ = authenticated_client
    response = await client.get("/v1/catalog/products/barcode/UNKNOWN-999999")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_barcode_lookup_returns_portions(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """GET barcode route includes portions in response."""
    barcode = _unique_barcode()
    product = await create_catalog_product(
        db_session,
        name=f"BarcodePortions-{barcode}",
        barcode=barcode,
    )
    portion = await create_catalog_portion(
        db_session,
        catalog_product_id=product.id,
        label="1 serving",
        calories=250,
        is_default=True,
    )
    await db_session.commit()

    client, _ = authenticated_client
    response = await client.get(f"/v1/catalog/products/barcode/{barcode}")

    assert response.status_code == 200
    data = response.json()
    assert len(data["portions"]) == 1
    assert data["portions"][0]["id"] == str(portion.id)
    assert data["portions"][0]["label"] == "1 serving"
    assert data["default_portion"] is not None
    assert data["default_portion"]["id"] == str(portion.id)
