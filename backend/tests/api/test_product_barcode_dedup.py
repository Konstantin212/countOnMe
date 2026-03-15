"""Integration tests for product barcode deduplication via the API."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_product_with_barcode_api(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
):
    """POST product with barcode includes barcode in response."""
    client, _ = authenticated_client
    product_id = str(uuid.uuid4())

    response = await client.post(
        "/v1/products",
        json={"id": product_id, "name": "Scanned Milk", "barcode": "4901234567890"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["id"] == product_id
    assert data["name"] == "Scanned Milk"
    assert data["barcode"] == "4901234567890"


@pytest.mark.asyncio
async def test_create_duplicate_barcode_returns_existing_api(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
):
    """POST same barcode twice returns the same product, no duplicate created."""
    client, _ = authenticated_client

    first = await client.post(
        "/v1/products",
        json={"name": "Milk", "barcode": "4901234567890"},
    )
    assert first.status_code == 201
    first_id = first.json()["id"]

    second = await client.post(
        "/v1/products",
        json={"name": "Milk Again", "barcode": "4901234567890"},
    )
    # Returns existing product — still 201 (idempotent create)
    assert second.status_code == 201
    assert second.json()["id"] == first_id
    assert second.json()["name"] == "Milk"  # Original name preserved


@pytest.mark.asyncio
async def test_create_product_without_barcode_api(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
):
    """POST product without barcode has barcode=null in response."""
    client, _ = authenticated_client

    response = await client.post(
        "/v1/products",
        json={"name": "Plain Apple"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["barcode"] is None


@pytest.mark.asyncio
async def test_get_product_includes_barcode(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
):
    """GET product includes the barcode field."""
    client, _ = authenticated_client
    product_id = str(uuid.uuid4())

    await client.post(
        "/v1/products",
        json={"id": product_id, "name": "Coded Item", "barcode": "1111111111111"},
    )

    response = await client.get(f"/v1/products/{product_id}")
    assert response.status_code == 200
    assert response.json()["barcode"] == "1111111111111"
