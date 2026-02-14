"""Integration tests for portions router."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_portions_empty(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test listing portions for a product with no portions."""
    client, _ = authenticated_client

    # Create a product
    product_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": product_id, "name": "Apple"})

    response = await client.get(f"/v1/products/{product_id}/portions")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_portion(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test creating a portion returns 201."""
    client, _ = authenticated_client

    product_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": product_id, "name": "Banana"})

    portion_data = {
        "label": "Medium",
        "base_amount": 100,
        "base_unit": "g",
        "calories": 89,
        "protein": 1.1,
        "carbs": 22.8,
        "fat": 0.3,
        "is_default": True,
    }
    response = await client.post(f"/v1/products/{product_id}/portions", json=portion_data)
    assert response.status_code == 201
    data = response.json()
    assert data["label"] == "Medium"
    assert data["is_default"] is True


@pytest.mark.asyncio
async def test_create_portion_product_not_found(
    authenticated_client: tuple[AsyncClient, uuid.UUID]
):
    """Test creating portion for non-existent product returns 404."""
    client, _ = authenticated_client

    unknown_id = str(uuid.uuid4())
    portion_data = {
        "label": "Test",
        "base_amount": 100,
        "base_unit": "g",
        "calories": 100,
        "is_default": False,
    }
    response = await client.post(f"/v1/products/{unknown_id}/portions", json=portion_data)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_portion(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test getting a portion by ID."""
    client, _ = authenticated_client

    product_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": product_id, "name": "Orange"})

    portion_data = {
        "label": "Large",
        "base_amount": 150,
        "base_unit": "g",
        "calories": 65,
        "is_default": False,
    }
    create_resp = await client.post(f"/v1/products/{product_id}/portions", json=portion_data)
    portion_id = create_resp.json()["id"]

    response = await client.get(f"/v1/portions/{portion_id}")
    assert response.status_code == 200
    assert response.json()["id"] == portion_id


@pytest.mark.asyncio
async def test_get_portion_not_found(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test getting non-existent portion returns 404."""
    client, _ = authenticated_client

    response = await client.get(f"/v1/portions/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_portion(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test updating a portion."""
    client, _ = authenticated_client

    product_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": product_id, "name": "Grape"})

    portion_data = {
        "label": "Small",
        "base_amount": 50,
        "base_unit": "g",
        "calories": 34,
        "is_default": False,
    }
    create_resp = await client.post(f"/v1/products/{product_id}/portions", json=portion_data)
    portion_id = create_resp.json()["id"]

    update_data = {"label": "Tiny"}
    response = await client.patch(f"/v1/portions/{portion_id}", json=update_data)
    assert response.status_code == 200
    assert response.json()["label"] == "Tiny"


@pytest.mark.asyncio
async def test_delete_portion(authenticated_client: tuple[AsyncClient, uuid.UUID]):
    """Test deleting a non-default portion."""
    client, _ = authenticated_client

    product_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": product_id, "name": "Peach"})

    # Create default portion first
    default_portion = {
        "label": "Default",
        "base_amount": 100,
        "base_unit": "g",
        "calories": 39,
        "is_default": True,
    }
    await client.post(f"/v1/products/{product_id}/portions", json=default_portion)

    # Create non-default portion
    portion_data = {
        "label": "Regular",
        "base_amount": 150,
        "base_unit": "g",
        "calories": 58,
        "is_default": False,
    }
    create_resp = await client.post(f"/v1/products/{product_id}/portions", json=portion_data)
    portion_id = create_resp.json()["id"]

    # Delete the non-default portion
    response = await client.delete(f"/v1/portions/{portion_id}")
    assert response.status_code == 204
