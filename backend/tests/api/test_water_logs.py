"""Integration tests for water-logs router."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_water_logs_empty(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client
    response = await client.get("/v1/water-logs")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_water_log(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client
    today = date.today().isoformat()

    response = await client.post("/v1/water-logs", json={"day": today, "amount_ml": 250})
    assert response.status_code == 201
    data = response.json()
    assert data["day"] == today
    assert data["amount_ml"] == 250
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_create_water_log_negative_amount(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Negative amount_ml is allowed (water removal)."""
    client, _ = authenticated_client
    response = await client.post(
        "/v1/water-logs",
        json={"day": date.today().isoformat(), "amount_ml": -100},
    )
    assert response.status_code == 201
    assert response.json()["amount_ml"] == -100


@pytest.mark.asyncio
async def test_get_water_log(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client
    today = date.today().isoformat()

    create_resp = await client.post("/v1/water-logs", json={"day": today, "amount_ml": 300})
    log_id = create_resp.json()["id"]

    response = await client.get(f"/v1/water-logs/{log_id}")
    assert response.status_code == 200
    assert response.json()["id"] == log_id
    assert response.json()["amount_ml"] == 300


@pytest.mark.asyncio
async def test_get_water_log_not_found(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client
    response = await client.get(f"/v1/water-logs/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_water_log(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client

    create_resp = await client.post(
        "/v1/water-logs",
        json={"day": date.today().isoformat(), "amount_ml": 250},
    )
    log_id = create_resp.json()["id"]

    response = await client.patch(f"/v1/water-logs/{log_id}", json={"amount_ml": 500})
    assert response.status_code == 200
    assert response.json()["amount_ml"] == 500


@pytest.mark.asyncio
async def test_delete_water_log(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client

    create_resp = await client.post(
        "/v1/water-logs",
        json={"day": date.today().isoformat(), "amount_ml": 250},
    )
    log_id = create_resp.json()["id"]

    delete_resp = await client.delete(f"/v1/water-logs/{log_id}")
    assert delete_resp.status_code == 204

    # Should be gone from list
    get_resp = await client.get(f"/v1/water-logs/{log_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_water_log_not_found(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client
    response = await client.delete(f"/v1/water-logs/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_water_logs_date_filter(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client
    today = date.today()
    yesterday = today - timedelta(days=1)

    await client.post("/v1/water-logs", json={"day": today.isoformat(), "amount_ml": 250})
    await client.post("/v1/water-logs", json={"day": yesterday.isoformat(), "amount_ml": 300})

    # Filter to today only
    response = await client.get(
        "/v1/water-logs",
        params={"from": today.isoformat(), "to": today.isoformat()},
    )
    assert response.status_code == 200
    logs = response.json()
    days = {lg["day"] for lg in logs}
    assert today.isoformat() in days
    assert yesterday.isoformat() not in days


@pytest.mark.asyncio
async def test_multiple_logs_per_day(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Multiple water logs on the same day are allowed."""
    client, _ = authenticated_client
    today = date.today().isoformat()

    resp1 = await client.post("/v1/water-logs", json={"day": today, "amount_ml": 250})
    resp2 = await client.post("/v1/water-logs", json={"day": today, "amount_ml": 300})
    assert resp1.status_code == 201
    assert resp2.status_code == 201
    assert resp1.json()["id"] != resp2.json()["id"]
