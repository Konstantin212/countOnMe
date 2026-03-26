"""Integration tests for sync pull endpoint."""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_pull_empty(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Pull with no data returns empty sets and no cursor."""
    client, _ = authenticated_client

    response = await client.get("/v1/sync/pull")
    assert response.status_code == 200
    data = response.json()
    assert data["products"]["upserts"] == []
    assert data["products"]["deletes"] == []
    assert data["portions"]["upserts"] == []
    assert data["food_entries"]["upserts"] == []
    assert data["goals"]["upserts"] == []
    assert data["body_weights"]["upserts"] == []
    assert data["water_logs"]["upserts"] == []
    assert data["has_more"] is False


@pytest.mark.asyncio
async def test_pull_returns_products(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """After creating a product, pull returns it in products.upserts."""
    client, _ = authenticated_client

    product_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": product_id, "name": "SyncTestProduct"})

    response = await client.get("/v1/sync/pull")
    assert response.status_code == 200
    data = response.json()

    upserts = data["products"]["upserts"]
    ids = [u["id"] for u in upserts]
    assert product_id in ids


@pytest.mark.asyncio
async def test_pull_since_version_filters(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Pulling with since_version filters out older items."""
    client, _ = authenticated_client

    # Create first product
    p1_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": p1_id, "name": "PullFirst"})

    # Get cursor from first pull
    pull1 = await client.get("/v1/sync/pull")
    cursor = pull1.json()["sync_cursor"]
    assert cursor is not None
    since_version = int(cursor.split("|")[0])

    # Create second product
    p2_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": p2_id, "name": "PullSecond"})

    # Pull since first cursor should only return second product
    pull2 = await client.get("/v1/sync/pull", params={"since_version": since_version})
    data = pull2.json()
    product_ids = [u["id"] for u in data["products"]["upserts"]]
    assert p2_id in product_ids
    assert p1_id not in product_ids


@pytest.mark.asyncio
async def test_pull_includes_soft_deleted_as_deletes(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
) -> None:
    """Soft-deleted items appear in the deletes list, not upserts."""
    client, _ = authenticated_client

    # Create and delete a product
    p_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": p_id, "name": "DeleteMe"})
    await client.delete(f"/v1/products/{p_id}")

    response = await client.get("/v1/sync/pull")
    data = response.json()

    upsert_ids = [u["id"] for u in data["products"]["upserts"]]
    delete_ids = data["products"]["deletes"]
    assert p_id not in upsert_ids
    assert p_id in delete_ids


@pytest.mark.asyncio
async def test_pull_multiple_entity_types(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
) -> None:
    """Pull returns multiple entity types interleaved."""
    client, _ = authenticated_client

    # Create a product
    p_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": p_id, "name": "MultiEntity"})

    # Create a water log
    await client.post(
        "/v1/water-logs",
        json={"day": date.today().isoformat(), "amount_ml": 250},
    )

    response = await client.get("/v1/sync/pull")
    data = response.json()

    assert len(data["products"]["upserts"]) >= 1
    assert len(data["water_logs"]["upserts"]) >= 1


@pytest.mark.asyncio
async def test_pull_pagination_limit(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Pull with limit=1 returns has_more=True if more data exists."""
    client, _ = authenticated_client

    # Create two products
    await client.post("/v1/products", json={"id": str(uuid.uuid4()), "name": "Page1"})
    await client.post("/v1/products", json={"id": str(uuid.uuid4()), "name": "Page2"})

    response = await client.get("/v1/sync/pull", params={"limit": 1})
    data = response.json()

    total_items = sum(
        len(data[key]["upserts"]) + len(data[key]["deletes"])
        for key in ["products", "portions", "food_entries", "goals", "body_weights", "water_logs"]
    )
    # With limit=1, we should get at most 1 item
    assert total_items <= 1
    # has_more should be True since we have at least 2 items total
    assert data["has_more"] is True


@pytest.mark.asyncio
async def test_pull_returns_cursor(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Pull returns a sync_cursor when there are items."""
    client, _ = authenticated_client

    await client.post("/v1/products", json={"id": str(uuid.uuid4()), "name": "CursorTest"})

    response = await client.get("/v1/sync/pull")
    data = response.json()

    assert data["sync_cursor"] is not None
    # Cursor format: "sync_version|iso_timestamp"
    parts = data["sync_cursor"].split("|")
    assert len(parts) == 2
    assert int(parts[0]) > 0


@pytest.mark.asyncio
async def test_pull_requires_auth(app_client: AsyncClient) -> None:
    """Pull without auth returns 401."""
    response = await app_client.get("/v1/sync/pull")
    assert response.status_code == 401
