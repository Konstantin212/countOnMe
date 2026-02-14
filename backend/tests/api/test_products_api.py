"""Integration tests for products router."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_products_empty(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test listing products when none exist."""
    client, _ = authenticated_client

    response = await client.get("/v1/products")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_products_with_data(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test listing products returns all device products."""
    client, _ = authenticated_client

    # Create two products
    product1_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": product1_id, "name": "Apple"})

    product2_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": product2_id, "name": "Banana"})

    # List products
    response = await client.get("/v1/products")
    assert response.status_code == 200
    products = response.json()
    assert len(products) == 2
    assert {p["name"] for p in products} == {"Apple", "Banana"}


@pytest.mark.asyncio
async def test_create_product(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test creating a product returns 201 and product data."""
    client, _ = authenticated_client

    product_id = str(uuid.uuid4())
    response = await client.post("/v1/products", json={"id": product_id, "name": "Orange"})

    assert response.status_code == 201
    data = response.json()
    assert data["id"] == product_id
    assert data["name"] == "Orange"
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_create_product_validation_error(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test creating product with invalid data returns 422."""
    client, _ = authenticated_client

    response = await client.post("/v1/products", json={"id": str(uuid.uuid4())})
    assert response.status_code == 422  # Missing name


@pytest.mark.asyncio
async def test_get_product_found(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test getting an existing product returns 200 and data."""
    client, _ = authenticated_client

    # Create product
    product_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": product_id, "name": "Grape"})

    # Get product
    response = await client.get(f"/v1/products/{product_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == product_id
    assert data["name"] == "Grape"


@pytest.mark.asyncio
async def test_get_product_not_found(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test getting non-existent product returns 404."""
    client, _ = authenticated_client

    unknown_id = str(uuid.uuid4())
    response = await client.get(f"/v1/products/{unknown_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_product(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test updating a product returns 200 with updated data."""
    client, _ = authenticated_client

    # Create product
    product_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": product_id, "name": "Peach"})

    # Update product
    response = await client.patch(f"/v1/products/{product_id}", json={"name": "Nectarine"})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == product_id
    assert data["name"] == "Nectarine"


@pytest.mark.asyncio
async def test_update_product_not_found(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test updating non-existent product returns 404."""
    client, _ = authenticated_client

    unknown_id = str(uuid.uuid4())
    response = await client.patch(f"/v1/products/{unknown_id}", json={"name": "Test"})
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_product(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test deleting a product returns 204 and soft-deletes."""
    client, _ = authenticated_client

    # Create product
    product_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": product_id, "name": "Mango"})

    # Delete product
    response = await client.delete(f"/v1/products/{product_id}")
    assert response.status_code == 204

    # Product should not appear in list
    list_response = await client.get("/v1/products")
    products = list_response.json()
    assert not any(p["id"] == product_id for p in products)


@pytest.mark.asyncio
async def test_delete_product_not_found(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test deleting non-existent product returns 404."""
    client, _ = authenticated_client

    unknown_id = str(uuid.uuid4())
    response = await client.delete(f"/v1/products/{unknown_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_device_scoping_prevents_cross_device_access(
    app_client: AsyncClient,
    db_session,
):
    """Test that device A cannot access device B's products."""
    # Register device A
    device_a_id = str(uuid.uuid4())
    response_a = await app_client.post("/v1/devices/register", json={"device_id": device_a_id})
    token_a = response_a.json()["device_token"]

    # Register device B
    device_b_id = str(uuid.uuid4())
    response_b = await app_client.post("/v1/devices/register", json={"device_id": device_b_id})
    token_b = response_b.json()["device_token"]

    # Device A creates a product
    app_client.headers["Authorization"] = f"Bearer {token_a}"
    product_id = str(uuid.uuid4())
    await app_client.post("/v1/products", json={"id": product_id, "name": "Device A Product"})

    # Device B tries to access Device A's product
    app_client.headers["Authorization"] = f"Bearer {token_b}"
    response = await app_client.get(f"/v1/products/{product_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_requires_authentication(app_client: AsyncClient):
    """Test that all product endpoints require authentication."""
    # List
    response = await app_client.get("/v1/products")
    assert response.status_code == 401

    # Get
    response = await app_client.get(f"/v1/products/{uuid.uuid4()}")
    assert response.status_code == 401

    # Create
    response = await app_client.post("/v1/products", json={"id": str(uuid.uuid4()), "name": "Test"})
    assert response.status_code == 401

    # Update
    response = await app_client.patch(f"/v1/products/{uuid.uuid4()}", json={"name": "Test"})
    assert response.status_code == 401

    # Delete
    response = await app_client.delete(f"/v1/products/{uuid.uuid4()}")
    assert response.status_code == 401
