"""Integration tests for sync push endpoint."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _future_iso(seconds: int = 60) -> str:
    return (datetime.now(UTC) + timedelta(seconds=seconds)).isoformat()


def _past_iso(seconds: int = 3600) -> str:
    return (datetime.now(UTC) - timedelta(seconds=seconds)).isoformat()


@pytest.mark.asyncio
async def test_push_empty_batch(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Empty mutations list returns empty results."""
    client, _ = authenticated_client

    response = await client.post("/v1/sync/push", json={"mutations": []})
    assert response.status_code == 200
    data = response.json()
    assert data["results"] == []


@pytest.mark.asyncio
async def test_push_upsert_new_product(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Push a new product via upsert, then verify it exists."""
    client, _ = authenticated_client

    product_id = str(uuid.uuid4())
    response = await client.post(
        "/v1/sync/push",
        json={
            "mutations": [
                {
                    "entity_type": "products",
                    "action": "upsert",
                    "id": product_id,
                    "data": {"name": "Pushed Product"},
                    "client_updated_at": _now_iso(),
                },
            ],
        },
    )
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 1
    assert results[0]["status"] == "applied"
    assert results[0]["id"] == product_id

    # Verify via regular GET
    get_resp = await client.get(f"/v1/products/{product_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Pushed Product"


@pytest.mark.asyncio
async def test_push_upsert_update_existing(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Push upsert updates an existing product when client timestamp is newer."""
    client, _ = authenticated_client

    product_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": product_id, "name": "Original"})

    response = await client.post(
        "/v1/sync/push",
        json={
            "mutations": [
                {
                    "entity_type": "products",
                    "action": "upsert",
                    "id": product_id,
                    "data": {"name": "Updated via push"},
                    "client_updated_at": _future_iso(),
                },
            ],
        },
    )
    results = response.json()["results"]
    assert results[0]["status"] == "applied"

    get_resp = await client.get(f"/v1/products/{product_id}")
    assert get_resp.json()["name"] == "Updated via push"


@pytest.mark.asyncio
async def test_push_lww_server_wins_on_older_timestamp(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
) -> None:
    """Push with older client_updated_at results in conflict (server wins)."""
    client, _ = authenticated_client

    product_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": product_id, "name": "ServerWins"})

    response = await client.post(
        "/v1/sync/push",
        json={
            "mutations": [
                {
                    "entity_type": "products",
                    "action": "upsert",
                    "id": product_id,
                    "data": {"name": "ClientTried"},
                    "client_updated_at": _past_iso(),
                },
            ],
        },
    )
    results = response.json()["results"]
    assert results[0]["status"] == "conflict"
    assert results[0]["message"] == "Server version is newer or equal"

    # Name should be unchanged
    get_resp = await client.get(f"/v1/products/{product_id}")
    assert get_resp.json()["name"] == "ServerWins"


@pytest.mark.asyncio
async def test_push_delete_soft_deletes(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Push delete action soft-deletes the record."""
    client, _ = authenticated_client

    product_id = str(uuid.uuid4())
    await client.post("/v1/products", json={"id": product_id, "name": "WillBeDeleted"})

    response = await client.post(
        "/v1/sync/push",
        json={
            "mutations": [
                {
                    "entity_type": "products",
                    "action": "delete",
                    "id": product_id,
                    "client_updated_at": _future_iso(),
                },
            ],
        },
    )
    results = response.json()["results"]
    assert results[0]["status"] == "applied"

    # Product should be gone from regular API
    get_resp = await client.get(f"/v1/products/{product_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_push_delete_nonexistent_succeeds(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
) -> None:
    """Deleting a non-existent item is treated as success (idempotent)."""
    client, _ = authenticated_client

    response = await client.post(
        "/v1/sync/push",
        json={
            "mutations": [
                {
                    "entity_type": "products",
                    "action": "delete",
                    "id": str(uuid.uuid4()),
                    "client_updated_at": _now_iso(),
                },
            ],
        },
    )
    results = response.json()["results"]
    assert results[0]["status"] == "applied"


@pytest.mark.asyncio
async def test_push_unknown_entity_type(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Unknown entity_type returns error status."""
    client, _ = authenticated_client

    response = await client.post(
        "/v1/sync/push",
        json={
            "mutations": [
                {
                    "entity_type": "nonexistent",
                    "action": "upsert",
                    "id": str(uuid.uuid4()),
                    "data": {},
                    "client_updated_at": _now_iso(),
                },
            ],
        },
    )
    # With Literal validation on entity_type, Pydantic rejects unknown types at 422
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_push_batch_ordering(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Product and water_log in same batch both succeed."""
    client, _ = authenticated_client

    product_id = str(uuid.uuid4())
    water_id = str(uuid.uuid4())
    ts = _now_iso()

    response = await client.post(
        "/v1/sync/push",
        json={
            "mutations": [
                {
                    "entity_type": "water_logs",
                    "action": "upsert",
                    "id": water_id,
                    "data": {"day": "2026-03-26", "amount_ml": 250},
                    "client_updated_at": ts,
                },
                {
                    "entity_type": "products",
                    "action": "upsert",
                    "id": product_id,
                    "data": {"name": "BatchProduct"},
                    "client_updated_at": ts,
                },
            ],
        },
    )
    results = response.json()["results"]
    # Both should be applied (product processed before water_log due to ordering)
    statuses = {r["id"]: r["status"] for r in results}
    assert statuses[product_id] == "applied"
    assert statuses[water_id] == "applied"


@pytest.mark.asyncio
async def test_push_water_log_upsert(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Push a new water log via upsert."""
    client, _ = authenticated_client

    water_id = str(uuid.uuid4())
    response = await client.post(
        "/v1/sync/push",
        json={
            "mutations": [
                {
                    "entity_type": "water_logs",
                    "action": "upsert",
                    "id": water_id,
                    "data": {"day": "2026-03-26", "amount_ml": 500},
                    "client_updated_at": _now_iso(),
                },
            ],
        },
    )
    results = response.json()["results"]
    assert results[0]["status"] == "applied"

    # Verify via GET
    get_resp = await client.get(f"/v1/water-logs/{water_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["amount_ml"] == 500


@pytest.mark.asyncio
async def test_push_max_batch_size(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Pushing more than 50 mutations returns 422."""
    client, _ = authenticated_client

    mutations = [
        {
            "entity_type": "products",
            "action": "upsert",
            "id": str(uuid.uuid4()),
            "data": {"name": f"P{i}"},
            "client_updated_at": _now_iso(),
        }
        for i in range(51)
    ]

    response = await client.post("/v1/sync/push", json={"mutations": mutations})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_push_requires_auth(app_client: AsyncClient) -> None:
    """Push without auth returns 401."""
    response = await app_client.post("/v1/sync/push", json={"mutations": []})
    assert response.status_code == 401
