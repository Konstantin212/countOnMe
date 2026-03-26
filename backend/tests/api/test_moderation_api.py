"""Integration tests for moderation router endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt as pyjwt
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ModerationStatus, ReportReason, Visibility
from app.core.rate_limit import publish_rate_limiter
from app.features.auth.models import Device, User, UserDevice
from app.features.auth.service import SUPABASE_MANAGED_HASH
from tests.conftest import _TEST_EC_PRIVATE_KEY
from tests.factories import (
    create_content_report,
    create_shared_food,
    create_user,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_jwt(sub: str, email: str = "test@test.com") -> str:
    """Create a signed Supabase-style JWT for a given sub."""
    payload = {
        "sub": sub,
        "email": email,
        "aud": "authenticated",
        "exp": datetime.now(UTC) + timedelta(hours=1),
        "iat": datetime.now(UTC),
    }
    return pyjwt.encode(payload, _TEST_EC_PRIVATE_KEY, algorithm="ES256")


async def _create_authenticated_user(
    db_session: AsyncSession,
) -> tuple[str, uuid.UUID]:
    """Create a user+device and return (jwt_token, user_id)."""
    sub = uuid.uuid4()
    user = User(supabase_id=sub, email=f"user-{sub.hex[:8]}@test.com")
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)

    device = Device(id=uuid.uuid4(), token_hash=SUPABASE_MANAGED_HASH)
    db_session.add(device)
    await db_session.flush()

    db_session.add(UserDevice(user_id=user.id, device_id=device.id))
    await db_session.flush()

    jwt_token = _make_jwt(sub=str(sub), email=user.email)
    return jwt_token, user.id


async def _create_admin_user(
    db_session: AsyncSession,
) -> tuple[str, uuid.UUID]:
    """Create an admin user+device and return (jwt_token, user_id)."""
    sub = uuid.uuid4()
    user = User(supabase_id=sub, email=f"admin-{sub.hex[:8]}@test.com", is_admin=True)
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)

    device = Device(id=uuid.uuid4(), token_hash=SUPABASE_MANAGED_HASH)
    db_session.add(device)
    await db_session.flush()

    db_session.add(UserDevice(user_id=user.id, device_id=device.id))
    await db_session.flush()

    jwt_token = _make_jwt(sub=str(sub), email=user.email)
    return jwt_token, user.id


# ---------------------------------------------------------------------------
# Report endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_report_requires_auth(app_client: AsyncClient) -> None:
    """POST /v1/moderation/reports without token returns 401."""
    response = await app_client.post(
        "/v1/moderation/reports",
        json={
            "target_shared_food_id": str(uuid.uuid4()),
            "reason": "spam",
        },
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_report_success(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """POST /v1/moderation/reports returns 201."""
    client, user_id = authenticated_client

    # Create another user's food to report
    owner = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    response = await client.post(
        "/v1/moderation/reports",
        json={
            "target_shared_food_id": str(food.id),
            "reason": "spam",
            "detail": "This is spam",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["reporter_user_id"] == str(user_id)
    assert data["target_shared_food_id"] == str(food.id)
    assert data["reason"] == "spam"


@pytest.mark.asyncio
async def test_create_report_idempotent(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """Second report by same user for same target returns existing (200-level)."""
    client, _user_id = authenticated_client

    owner = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    r1 = await client.post(
        "/v1/moderation/reports",
        json={"target_shared_food_id": str(food.id), "reason": "spam"},
    )
    r2 = await client.post(
        "/v1/moderation/reports",
        json={"target_shared_food_id": str(food.id), "reason": "offensive"},
    )

    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["id"] == r2.json()["id"]


@pytest.mark.asyncio
async def test_create_report_self_report_400(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """Cannot report your own food -> 400."""
    client, user_id = authenticated_client

    food = await create_shared_food(
        db_session,
        owner_user_id=user_id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    response = await client.post(
        "/v1/moderation/reports",
        json={"target_shared_food_id": str(food.id), "reason": "inaccurate"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_create_report_nonexistent_food_404(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
) -> None:
    """Reporting a nonexistent food returns 404."""
    client, _ = authenticated_client

    response = await client.post(
        "/v1/moderation/reports",
        json={"target_shared_food_id": str(uuid.uuid4()), "reason": "spam"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_my_reports(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """GET /v1/moderation/reports/mine returns my reports only."""
    client, user_id = authenticated_client

    owner = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    await client.post(
        "/v1/moderation/reports",
        json={"target_shared_food_id": str(food.id), "reason": "spam"},
    )

    response = await client.get("/v1/moderation/reports/mine")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert all(r["reporter_user_id"] == str(user_id) for r in data)


# ---------------------------------------------------------------------------
# Block endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_block_user_success(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """POST /v1/moderation/blocks returns 201."""
    client, user_id = authenticated_client

    target = await create_user(db_session)
    await db_session.commit()

    response = await client.post(
        "/v1/moderation/blocks",
        json={"blocked_user_id": str(target.id)},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["blocker_user_id"] == str(user_id)
    assert data["blocked_user_id"] == str(target.id)


@pytest.mark.asyncio
async def test_block_user_self_block_400(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
) -> None:
    """Cannot block yourself -> 400."""
    client, user_id = authenticated_client

    response = await client.post(
        "/v1/moderation/blocks",
        json={"blocked_user_id": str(user_id)},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_unblock_user_success(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """DELETE /v1/moderation/blocks/{id} returns 204."""
    client, _user_id = authenticated_client

    target = await create_user(db_session)
    await db_session.commit()

    # Block first
    await client.post(
        "/v1/moderation/blocks",
        json={"blocked_user_id": str(target.id)},
    )

    response = await client.delete(f"/v1/moderation/blocks/{target.id}")
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_unblock_user_not_found_404(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
) -> None:
    """DELETE non-existent block returns 404."""
    client, _ = authenticated_client

    response = await client.delete(f"/v1/moderation/blocks/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_blocks(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """GET /v1/moderation/blocks returns blocked users."""
    client, _user_id = authenticated_client

    target = await create_user(db_session)
    await db_session.commit()

    await client.post(
        "/v1/moderation/blocks",
        json={"blocked_user_id": str(target.id)},
    )

    response = await client.get("/v1/moderation/blocks")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert any(b["blocked_user_id"] == str(target.id) for b in data)


@pytest.mark.asyncio
async def test_search_excludes_blocked_users_food(
    app_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Blocked user's shared foods don't appear in search results."""
    # Create blocker (user A)
    jwt_a, _user_a_id = await _create_authenticated_user(db_session)

    # Create blocked (user B) with a public+approved food
    user_b = await create_user(db_session)
    marker = uuid.uuid4().hex[:8]
    food = await create_shared_food(
        db_session,
        owner_user_id=user_b.id,
        name=f"BlockTest-{marker}",
        display_name=f"BlockTest-{marker}",
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    # Search before blocking - food should be visible
    app_client.headers["Authorization"] = f"Bearer {jwt_a}"
    search_before = await app_client.get(f"/v1/shared/foods/search?q=BlockTest-{marker}")
    assert any(f["id"] == str(food.id) for f in search_before.json())

    # Block user B
    await app_client.post(
        "/v1/moderation/blocks",
        json={"blocked_user_id": str(user_b.id)},
    )

    # Search after blocking - food should be hidden
    search_after = await app_client.get(f"/v1/shared/foods/search?q=BlockTest-{marker}")
    assert not any(f["id"] == str(food.id) for f in search_after.json())

    # Get-by-ID should also return 404
    get_resp = await app_client.get(f"/v1/shared/foods/{food.id}")
    assert get_resp.status_code == 404

    app_client.headers.pop("Authorization", None)


# ---------------------------------------------------------------------------
# Rate limiting on publish
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_publish_rate_limited(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """Publishing more than the limit within the window returns 429."""
    client, user_id = authenticated_client

    # Reset the rate limiter to start clean
    publish_rate_limiter._hits.clear()

    # Create 11 foods and try to publish them all
    for i in range(11):
        food = await create_shared_food(
            db_session,
            owner_user_id=user_id,
            visibility=Visibility.private,
        )
        await db_session.commit()

        response = await client.post(f"/v1/shared/foods/{food.id}/publish")
        if i < 10:
            assert response.status_code == 200, f"Publish {i} failed: {response.json()}"
        else:
            assert response.status_code == 429

    # Clean up rate limiter
    publish_rate_limiter._hits.clear()


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_list_reports_requires_admin(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
) -> None:
    """Non-admin gets 403 on admin endpoints."""
    client, _ = authenticated_client

    response = await client.get("/v1/admin/moderation/reports")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_list_reports_success(
    app_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Admin can list pending reports."""
    jwt_admin, _admin_id = await _create_admin_user(db_session)

    # Create a report
    owner = await create_user(db_session)
    reporter = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    await create_content_report(
        db_session,
        reporter_user_id=reporter.id,
        target_shared_food_id=food.id,
        reason=ReportReason.spam,
    )
    await db_session.commit()

    app_client.headers["Authorization"] = f"Bearer {jwt_admin}"
    response = await app_client.get("/v1/admin/moderation/reports")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    app_client.headers.pop("Authorization", None)


@pytest.mark.asyncio
async def test_admin_resolve_report(
    app_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Admin can resolve a report."""
    jwt_admin, admin_id = await _create_admin_user(db_session)

    owner = await create_user(db_session)
    reporter = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    report = await create_content_report(
        db_session,
        reporter_user_id=reporter.id,
        target_shared_food_id=food.id,
        reason=ReportReason.offensive,
    )
    await db_session.commit()

    app_client.headers["Authorization"] = f"Bearer {jwt_admin}"
    response = await app_client.post(
        f"/v1/admin/moderation/reports/{report.id}/resolve",
        json={"resolution_note": "Reviewed and dismissed"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["resolved_at"] is not None
    assert data["resolved_by_user_id"] == str(admin_id)
    assert data["resolution_note"] == "Reviewed and dismissed"

    app_client.headers.pop("Authorization", None)


@pytest.mark.asyncio
async def test_admin_approve_food(
    app_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Admin can approve a shared food."""
    jwt_admin, _admin_id = await _create_admin_user(db_session)

    owner = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.pending,
    )
    await db_session.commit()

    app_client.headers["Authorization"] = f"Bearer {jwt_admin}"
    response = await app_client.post(
        f"/v1/admin/moderation/foods/{food.id}/approve",
    )
    assert response.status_code == 200
    assert response.json()["moderation_status"] == "approved"

    app_client.headers.pop("Authorization", None)


@pytest.mark.asyncio
async def test_admin_reject_food(
    app_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Admin can reject a shared food."""
    jwt_admin, _admin_id = await _create_admin_user(db_session)

    owner = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.pending,
    )
    await db_session.commit()

    app_client.headers["Authorization"] = f"Bearer {jwt_admin}"
    response = await app_client.post(
        f"/v1/admin/moderation/foods/{food.id}/reject",
        json={"reason": "Bad data"},
    )
    assert response.status_code == 200
    assert response.json()["moderation_status"] == "rejected"

    app_client.headers.pop("Authorization", None)


@pytest.mark.asyncio
async def test_admin_stats(
    app_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Admin can see moderation stats."""
    jwt_admin, _admin_id = await _create_admin_user(db_session)

    app_client.headers["Authorization"] = f"Bearer {jwt_admin}"
    response = await app_client.get("/v1/admin/moderation/stats")
    assert response.status_code == 200
    data = response.json()
    assert "pending_reports" in data
    assert "pending_foods" in data

    app_client.headers.pop("Authorization", None)
