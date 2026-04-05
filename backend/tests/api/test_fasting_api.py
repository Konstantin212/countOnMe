"""Integration tests for fasting-sessions router."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_start_fasting(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client
    now = datetime.now(UTC).isoformat()

    response = await client.post(
        "/v1/fasting-sessions",
        json={"technique": "16:8", "fasting_hours": 16, "started_at": now},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["technique"] == "16:8"
    assert data["fasting_hours"] == 16
    assert data["ended_at"] is None
    assert data["completed"] is False
    assert "id" in data
    assert "target_end_at" in data


@pytest.mark.asyncio
async def test_start_fasting_conflict(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Starting a second session while one is active returns 409."""
    client, _ = authenticated_client
    now = datetime.now(UTC).isoformat()

    resp1 = await client.post(
        "/v1/fasting-sessions",
        json={"technique": "16:8", "fasting_hours": 16, "started_at": now},
    )
    assert resp1.status_code == 201

    resp2 = await client.post(
        "/v1/fasting-sessions",
        json={"technique": "18:6", "fasting_hours": 18, "started_at": now},
    )
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_end_fasting(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client
    now = datetime.now(UTC)

    create_resp = await client.post(
        "/v1/fasting-sessions",
        json={"technique": "16:8", "fasting_hours": 16, "started_at": now.isoformat()},
    )
    session_id = create_resp.json()["id"]

    ended = (now + timedelta(hours=17)).isoformat()
    end_resp = await client.post(
        f"/v1/fasting-sessions/{session_id}/end",
        json={"ended_at": ended},
    )
    assert end_resp.status_code == 200
    data = end_resp.json()
    assert data["completed"] is True
    assert data["ended_at"] is not None


@pytest.mark.asyncio
async def test_end_fasting_idempotent(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Ending an already-ended session returns the original ended_at unchanged."""
    client, _ = authenticated_client
    now = datetime.now(UTC)

    create_resp = await client.post(
        "/v1/fasting-sessions",
        json={"technique": "16:8", "fasting_hours": 16, "started_at": now.isoformat()},
    )
    session_id = create_resp.json()["id"]

    first_ended = (now + timedelta(hours=17)).isoformat()
    end_resp1 = await client.post(
        f"/v1/fasting-sessions/{session_id}/end",
        json={"ended_at": first_ended},
    )
    assert end_resp1.status_code == 200
    original_ended_at = end_resp1.json()["ended_at"]
    assert end_resp1.json()["completed"] is True

    # Try to end again with a different time
    second_ended = (now + timedelta(hours=10)).isoformat()
    end_resp2 = await client.post(
        f"/v1/fasting-sessions/{session_id}/end",
        json={"ended_at": second_ended},
    )
    assert end_resp2.status_code == 200
    # Original ended_at must be preserved
    assert end_resp2.json()["ended_at"] == original_ended_at
    assert end_resp2.json()["completed"] is True


@pytest.mark.asyncio
async def test_update_fasting(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client
    now = datetime.now(UTC)

    create_resp = await client.post(
        "/v1/fasting-sessions",
        json={"technique": "16:8", "fasting_hours": 16, "started_at": now.isoformat()},
    )
    session_id = create_resp.json()["id"]

    # End it first
    ended = (now + timedelta(hours=17)).isoformat()
    await client.post(f"/v1/fasting-sessions/{session_id}/end", json={"ended_at": ended})

    # Update
    patch_resp = await client.patch(
        f"/v1/fasting-sessions/{session_id}",
        json={"technique": "20:4", "fasting_hours": 20},
    )
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert data["technique"] == "20:4"
    assert data["fasting_hours"] == 20


@pytest.mark.asyncio
async def test_list_fasting(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client
    now = datetime.now(UTC)

    # Create and end a session so we can create a second one
    resp1 = await client.post(
        "/v1/fasting-sessions",
        json={"technique": "16:8", "fasting_hours": 16, "started_at": (now - timedelta(hours=48)).isoformat()},
    )
    sid1 = resp1.json()["id"]
    await client.post(
        f"/v1/fasting-sessions/{sid1}/end",
        json={"ended_at": (now - timedelta(hours=32)).isoformat()},
    )

    await client.post(
        "/v1/fasting-sessions",
        json={"technique": "18:6", "fasting_hours": 18, "started_at": now.isoformat()},
    )

    response = await client.get("/v1/fasting-sessions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_get_active(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client
    now = datetime.now(UTC).isoformat()

    await client.post(
        "/v1/fasting-sessions",
        json={"technique": "16:8", "fasting_hours": 16, "started_at": now},
    )

    response = await client.get("/v1/fasting-sessions/active")
    assert response.status_code == 200
    assert response.json()["technique"] == "16:8"


@pytest.mark.asyncio
async def test_get_active_not_found(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    """Returns 404 when no active session exists."""
    client, _ = authenticated_client
    response = await client.get("/v1/fasting-sessions/active")
    # May be 200 if a previous test left an active session, or 404 if not.
    # Since we use a shared DB, we accept both as valid — but test the 404 path
    # by ending any active session first.
    if response.status_code == 200:
        sid = response.json()["id"]
        await client.post(
            f"/v1/fasting-sessions/{sid}/end",
            json={"ended_at": datetime.now(UTC).isoformat()},
        )

    response2 = await client.get("/v1/fasting-sessions/active")
    assert response2.status_code == 404


@pytest.mark.asyncio
async def test_get_by_id(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client
    now = datetime.now(UTC).isoformat()

    create_resp = await client.post(
        "/v1/fasting-sessions",
        json={"technique": "16:8", "fasting_hours": 16, "started_at": now},
    )
    session_id = create_resp.json()["id"]

    response = await client.get(f"/v1/fasting-sessions/{session_id}")
    assert response.status_code == 200
    assert response.json()["id"] == session_id


@pytest.mark.asyncio
async def test_get_by_id_not_found(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client
    response = await client.get(f"/v1/fasting-sessions/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_fasting(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client
    now = datetime.now(UTC)

    create_resp = await client.post(
        "/v1/fasting-sessions",
        json={"technique": "16:8", "fasting_hours": 16, "started_at": now.isoformat()},
    )
    session_id = create_resp.json()["id"]

    # End it first so it doesn't conflict with other tests
    await client.post(
        f"/v1/fasting-sessions/{session_id}/end",
        json={"ended_at": (now + timedelta(hours=1)).isoformat()},
    )

    delete_resp = await client.delete(f"/v1/fasting-sessions/{session_id}")
    assert delete_resp.status_code == 204

    get_resp = await client.get(f"/v1/fasting-sessions/{session_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_not_found(authenticated_client: tuple[AsyncClient, uuid.UUID]) -> None:
    client, _ = authenticated_client
    response = await client.delete(f"/v1/fasting-sessions/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_auth_required(app_client: AsyncClient) -> None:
    """All endpoints return 401 without token."""
    endpoints = [
        ("GET", "/v1/fasting-sessions"),
        ("POST", "/v1/fasting-sessions"),
        ("GET", "/v1/fasting-sessions/active"),
        ("GET", f"/v1/fasting-sessions/{uuid.uuid4()}"),
        ("POST", f"/v1/fasting-sessions/{uuid.uuid4()}/end"),
        ("PATCH", f"/v1/fasting-sessions/{uuid.uuid4()}"),
        ("DELETE", f"/v1/fasting-sessions/{uuid.uuid4()}"),
    ]

    for method, url in endpoints:
        if method == "GET":
            resp = await app_client.get(url)
        elif method == "POST":
            resp = await app_client.post(url, json={})
        elif method == "PATCH":
            resp = await app_client.patch(url, json={})
        elif method == "DELETE":
            resp = await app_client.delete(url)
        else:
            continue
        assert resp.status_code == 401, f"{method} {url} returned {resp.status_code}, expected 401"
