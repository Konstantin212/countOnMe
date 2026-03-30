"""Integration tests for shared foods router."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import jwt as pyjwt
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ModerationStatus, Unit, Visibility
from app.features.auth.models import Device, User, UserDevice
from app.features.auth.service import SUPABASE_MANAGED_HASH
from tests.conftest import _TEST_EC_PRIVATE_KEY
from tests.factories import (
    create_shared_food,
    create_shared_food_portion,
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


async def _create_second_authenticated_user(
    db_session: AsyncSession,
    app_client: AsyncClient,
) -> tuple[AsyncClient, uuid.UUID]:
    """Create a second user+device and return a client with that user's auth."""
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

    # We reuse the same AsyncClient but swap the headers for calls.
    # Return the token and user_id so the test can set headers as needed.
    return jwt_token, user.id


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_shared_food_requires_auth(app_client: AsyncClient) -> None:
    """POST /v1/shared/foods without token returns 401."""
    response = await app_client.post(
        "/v1/shared/foods",
        json={"name": "Test", "display_name": "Test"},
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_shared_food_success(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
) -> None:
    """POST /v1/shared/foods returns 201 with created item."""
    client, user_id = authenticated_client

    response = await client.post(
        "/v1/shared/foods",
        json={
            "name": "Chicken Breast",
            "display_name": "Grilled Chicken Breast",
            "brand": "FarmFresh",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Chicken Breast"
    assert data["display_name"] == "Grilled Chicken Breast"
    assert data["brand"] == "FarmFresh"
    assert data["visibility"] == "private"
    assert data["moderation_status"] == "pending"
    assert data["owner_user_id"] == str(user_id)
    assert "id" in data
    assert "created_at" in data


# ---------------------------------------------------------------------------
# List mine
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_my_shared_foods_empty(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
) -> None:
    """GET /v1/shared/foods/mine returns 200 with empty list when nothing owned."""
    client, _ = authenticated_client
    response = await client.get("/v1/shared/foods/mine")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_list_my_shared_foods_returns_owned(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
) -> None:
    """GET /v1/shared/foods/mine returns only the authenticated user's items."""
    client, user_id = authenticated_client

    # Create a food via API
    marker = uuid.uuid4().hex[:8]
    await client.post(
        "/v1/shared/foods",
        json={"name": f"MyFood-{marker}", "display_name": f"MyFood-{marker}"},
    )

    response = await client.get("/v1/shared/foods/mine")
    assert response.status_code == 200
    data = response.json()
    assert any(f["name"] == f"MyFood-{marker}" for f in data)
    assert all(f["owner_user_id"] == str(user_id) for f in data)


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_search_shared_foods_returns_public_approved(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """GET /v1/shared/foods/search returns public+approved items."""
    client, user_id = authenticated_client
    marker = uuid.uuid4().hex[:8]

    # Create public+approved food directly in DB
    food = await create_shared_food(
        db_session,
        owner_user_id=user_id,
        name=f"PubApproved-{marker}",
        display_name=f"PubApproved-{marker}",
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    response = await client.get(f"/v1/shared/foods/search?q={marker}")
    assert response.status_code == 200
    data = response.json()
    assert any(f["id"] == str(food.id) for f in data)


@pytest.mark.asyncio
async def test_search_shared_foods_excludes_private(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """GET /v1/shared/foods/search excludes private items."""
    client, user_id = authenticated_client
    marker = uuid.uuid4().hex[:8]

    await create_shared_food(
        db_session,
        owner_user_id=user_id,
        name=f"PrivateOnly-{marker}",
        display_name=f"PrivateOnly-{marker}",
        visibility=Visibility.private,
    )
    await db_session.commit()

    response = await client.get(f"/v1/shared/foods/search?q=PrivateOnly-{marker}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0


# ---------------------------------------------------------------------------
# Get by ID
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_shared_food_owner_can_see_private(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """Owner can access their own private shared food by ID."""
    client, user_id = authenticated_client

    food = await create_shared_food(
        db_session,
        owner_user_id=user_id,
        name="OwnerPrivate",
        display_name="OwnerPrivate",
        visibility=Visibility.private,
    )
    await db_session.commit()

    response = await client.get(f"/v1/shared/foods/{food.id}")
    assert response.status_code == 200
    assert response.json()["id"] == str(food.id)


@pytest.mark.asyncio
async def test_get_shared_food_other_user_public_approved(
    app_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Non-owner can see public+approved shared food."""
    # Create user A (owner)
    user_a = await create_user(db_session)
    await db_session.commit()

    food = await create_shared_food(
        db_session,
        owner_user_id=user_a.id,
        name="PublicApproved",
        display_name="PublicApproved",
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    # Create user B and authenticate as user B
    jwt_b, _user_b_id = await _create_second_authenticated_user(db_session, app_client)
    await db_session.commit()

    app_client.headers["Authorization"] = f"Bearer {jwt_b}"
    response = await app_client.get(f"/v1/shared/foods/{food.id}")
    assert response.status_code == 200
    assert response.json()["id"] == str(food.id)

    app_client.headers.pop("Authorization", None)


@pytest.mark.asyncio
async def test_get_shared_food_other_user_private_404(
    app_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Non-owner cannot see private shared food -> 404."""
    user_a = await create_user(db_session)
    await db_session.commit()

    food = await create_shared_food(
        db_session,
        owner_user_id=user_a.id,
        name="PrivateFromA",
        display_name="PrivateFromA",
        visibility=Visibility.private,
    )
    await db_session.commit()

    jwt_b, _ = await _create_second_authenticated_user(db_session, app_client)
    await db_session.commit()

    app_client.headers["Authorization"] = f"Bearer {jwt_b}"
    response = await app_client.get(f"/v1/shared/foods/{food.id}")
    assert response.status_code == 404

    app_client.headers.pop("Authorization", None)


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_shared_food_success(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """PATCH /v1/shared/foods/{id} updates and returns 200."""
    client, user_id = authenticated_client

    food = await create_shared_food(
        db_session,
        owner_user_id=user_id,
        name="OriginalName",
        display_name="OriginalName",
    )
    await db_session.commit()

    response = await client.patch(
        f"/v1/shared/foods/{food.id}",
        json={"display_name": "UpdatedName"},
    )
    assert response.status_code == 200
    assert response.json()["display_name"] == "UpdatedName"


@pytest.mark.asyncio
async def test_update_shared_food_not_owner_404(
    app_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """PATCH by non-owner returns 404 (don't leak existence)."""
    user_a = await create_user(db_session)
    await db_session.commit()

    food = await create_shared_food(
        db_session,
        owner_user_id=user_a.id,
        name="OwnerOnly",
        display_name="OwnerOnly",
    )
    await db_session.commit()

    jwt_b, _ = await _create_second_authenticated_user(db_session, app_client)
    await db_session.commit()

    app_client.headers["Authorization"] = f"Bearer {jwt_b}"
    response = await app_client.patch(
        f"/v1/shared/foods/{food.id}",
        json={"display_name": "Hacked"},
    )
    assert response.status_code == 404

    app_client.headers.pop("Authorization", None)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_shared_food_success(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """DELETE /v1/shared/foods/{id} returns 204 and soft-deletes."""
    client, user_id = authenticated_client

    food = await create_shared_food(
        db_session,
        owner_user_id=user_id,
        name="ToDelete",
        display_name="ToDelete",
    )
    await db_session.commit()

    response = await client.delete(f"/v1/shared/foods/{food.id}")
    assert response.status_code == 204

    # Should no longer appear in list
    list_resp = await client.get("/v1/shared/foods/mine")
    ids = [f["id"] for f in list_resp.json()]
    assert str(food.id) not in ids


@pytest.mark.asyncio
async def test_delete_shared_food_not_owner_404(
    app_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """DELETE by non-owner returns 404 (don't leak existence)."""
    user_a = await create_user(db_session)
    await db_session.commit()

    food = await create_shared_food(
        db_session,
        owner_user_id=user_a.id,
        name="CannotDelete",
        display_name="CannotDelete",
    )
    await db_session.commit()

    jwt_b, _ = await _create_second_authenticated_user(db_session, app_client)
    await db_session.commit()

    app_client.headers["Authorization"] = f"Bearer {jwt_b}"
    response = await app_client.delete(f"/v1/shared/foods/{food.id}")
    assert response.status_code == 404

    app_client.headers.pop("Authorization", None)


# ---------------------------------------------------------------------------
# Publish / Unpublish
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_publish_shared_food_success(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """POST /v1/shared/foods/{id}/publish sets visibility to public."""
    client, user_id = authenticated_client

    food = await create_shared_food(
        db_session,
        owner_user_id=user_id,
        name="ToPublish",
        display_name="ToPublish",
        visibility=Visibility.private,
    )
    await db_session.commit()

    response = await client.post(f"/v1/shared/foods/{food.id}/publish")
    assert response.status_code == 200
    assert response.json()["visibility"] == "public"
    assert response.json()["moderation_status"] == "pending"


@pytest.mark.asyncio
async def test_publish_already_public_409(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """POST /v1/shared/foods/{id}/publish returns 409 if already public."""
    client, user_id = authenticated_client

    food = await create_shared_food(
        db_session,
        owner_user_id=user_id,
        name="AlreadyPublic",
        display_name="AlreadyPublic",
        visibility=Visibility.public,
    )
    await db_session.commit()

    response = await client.post(f"/v1/shared/foods/{food.id}/publish")
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_unpublish_shared_food_success(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """POST /v1/shared/foods/{id}/unpublish sets visibility back to private."""
    client, user_id = authenticated_client

    food = await create_shared_food(
        db_session,
        owner_user_id=user_id,
        name="ToUnpublish",
        display_name="ToUnpublish",
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    response = await client.post(f"/v1/shared/foods/{food.id}/unpublish")
    assert response.status_code == 200
    assert response.json()["visibility"] == "private"


# ---------------------------------------------------------------------------
# Portions
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_portion_success(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """POST /v1/shared/foods/{id}/portions returns 201."""
    client, user_id = authenticated_client

    food = await create_shared_food(
        db_session,
        owner_user_id=user_id,
        name="WithPortion",
        display_name="WithPortion",
    )
    await db_session.commit()

    response = await client.post(
        f"/v1/shared/foods/{food.id}/portions",
        json={
            "label": "100 g",
            "base_amount": "100",
            "base_unit": "g",
            "calories": "200",
            "protein": "25",
            "is_default": True,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["label"] == "100 g"
    assert data["shared_food_id"] == str(food.id)
    assert data["is_default"] is True


@pytest.mark.asyncio
async def test_add_portion_not_owner_404(
    app_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """POST /v1/shared/foods/{id}/portions by non-owner returns 404 (don't leak existence)."""
    user_a = await create_user(db_session)
    await db_session.commit()

    food = await create_shared_food(
        db_session,
        owner_user_id=user_a.id,
        name="NotMyFood",
        display_name="NotMyFood",
    )
    await db_session.commit()

    jwt_b, _ = await _create_second_authenticated_user(db_session, app_client)
    await db_session.commit()

    app_client.headers["Authorization"] = f"Bearer {jwt_b}"
    response = await app_client.post(
        f"/v1/shared/foods/{food.id}/portions",
        json={
            "label": "1 serving",
            "base_amount": "150",
            "base_unit": "g",
            "calories": "300",
        },
    )
    assert response.status_code == 404

    app_client.headers.pop("Authorization", None)


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_import_shared_food_success(
    authenticated_client: tuple[AsyncClient, uuid.UUID],
    db_session: AsyncSession,
) -> None:
    """POST /v1/shared/foods/{id}/import creates private product + portions."""
    client, user_id = authenticated_client

    food = await create_shared_food(
        db_session,
        owner_user_id=user_id,
        name="ImportMe",
        display_name="ImportMe",
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    await create_shared_food_portion(
        db_session,
        shared_food_id=food.id,
        label="100 g",
        base_amount=Decimal("100"),
        base_unit=Unit.g,
        calories=Decimal("150"),
        is_default=True,
    )
    await db_session.commit()

    response = await client.post(f"/v1/shared/foods/{food.id}/import")
    assert response.status_code == 201
    data = response.json()
    assert "product_id" in data
    assert data["portion_count"] == 1


@pytest.mark.asyncio
async def test_import_private_food_from_other_user_404(
    app_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Importing another user's private food returns 404."""
    user_a = await create_user(db_session)
    await db_session.commit()

    food = await create_shared_food(
        db_session,
        owner_user_id=user_a.id,
        name="PrivateNoImport",
        display_name="PrivateNoImport",
        visibility=Visibility.private,
    )
    await db_session.commit()

    jwt_b, _ = await _create_second_authenticated_user(db_session, app_client)
    await db_session.commit()

    app_client.headers["Authorization"] = f"Bearer {jwt_b}"
    response = await app_client.post(f"/v1/shared/foods/{food.id}/import")
    assert response.status_code == 404

    app_client.headers.pop("Authorization", None)
