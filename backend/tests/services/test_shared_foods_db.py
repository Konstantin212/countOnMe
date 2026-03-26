"""Test shared foods service database operations."""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ModerationStatus, Unit, Visibility
from app.features.shared.service import (
    AlreadyPublished,
    add_portion_to_shared_food,
    create_shared_food,
    get_shared_food,
    import_shared_food_to_private,
    list_my_shared_foods,
    publish_shared_food,
    search_shared_foods,
    soft_delete_shared_food,
    unpublish_shared_food,
    update_shared_food,
)
from tests.factories import (
    create_shared_food as factory_create_shared_food,
)
from tests.factories import (
    create_shared_food_portion,
    create_user,
)

# ---------------------------------------------------------------------------
# create
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_shared_food(db_session: AsyncSession) -> None:
    """Creates with correct defaults (private, pending)."""
    user = await create_user(db_session)
    await db_session.commit()

    food = await create_shared_food(
        db_session,
        owner_user_id=user.id,
        name="Chicken Breast",
        display_name="Chicken Breast Grilled",
    )

    assert food.id is not None
    assert food.owner_user_id == user.id
    assert food.name == "Chicken Breast"
    assert food.display_name == "Chicken Breast Grilled"
    assert food.visibility == Visibility.private
    assert food.moderation_status == ModerationStatus.pending


# ---------------------------------------------------------------------------
# list_my_shared_foods
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_my_shared_foods_only_returns_owned(db_session: AsyncSession) -> None:
    """User B cannot see user A's items."""
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)
    await db_session.commit()

    await factory_create_shared_food(db_session, owner_user_id=user_a.id)
    await factory_create_shared_food(db_session, owner_user_id=user_b.id)
    await db_session.commit()

    results_a = await list_my_shared_foods(db_session, owner_user_id=user_a.id)
    results_b = await list_my_shared_foods(db_session, owner_user_id=user_b.id)

    assert all(f.owner_user_id == user_a.id for f in results_a)
    assert all(f.owner_user_id == user_b.id for f in results_b)


@pytest.mark.asyncio
async def test_list_my_shared_foods_includes_all_statuses(db_session: AsyncSession) -> None:
    """Owner sees private, public, rejected items."""
    user = await create_user(db_session)
    await db_session.commit()

    marker = uuid.uuid4().hex[:8]
    await factory_create_shared_food(
        db_session, owner_user_id=user.id, name=f"Private-{marker}",
        visibility=Visibility.private,
    )
    await factory_create_shared_food(
        db_session, owner_user_id=user.id, name=f"Public-{marker}",
        visibility=Visibility.public, moderation_status=ModerationStatus.approved,
    )
    await factory_create_shared_food(
        db_session, owner_user_id=user.id, name=f"Rejected-{marker}",
        visibility=Visibility.public, moderation_status=ModerationStatus.rejected,
    )
    await db_session.commit()

    results = await list_my_shared_foods(db_session, owner_user_id=user.id)
    names = [f.name for f in results]

    assert any(f"Private-{marker}" in n for n in names)
    assert any(f"Public-{marker}" in n for n in names)
    assert any(f"Rejected-{marker}" in n for n in names)


@pytest.mark.asyncio
async def test_list_my_shared_foods_excludes_deleted(db_session: AsyncSession) -> None:
    """Soft-deleted items not returned."""
    user = await create_user(db_session)
    await db_session.commit()

    food = await factory_create_shared_food(db_session, owner_user_id=user.id)
    await db_session.commit()

    await soft_delete_shared_food(db_session, owner_user_id=user.id, shared_food_id=food.id)

    results = await list_my_shared_foods(db_session, owner_user_id=user.id)
    assert food.id not in {f.id for f in results}


# ---------------------------------------------------------------------------
# get
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_shared_food_returns_with_portions(db_session: AsyncSession) -> None:
    """Eagerly loads portions."""
    user = await create_user(db_session)
    await db_session.commit()

    food = await factory_create_shared_food(db_session, owner_user_id=user.id)
    await db_session.commit()

    portion = await create_shared_food_portion(db_session, shared_food_id=food.id)
    await db_session.commit()

    result = await get_shared_food(db_session, shared_food_id=food.id)
    assert result is not None
    assert len(result.portions) >= 1
    assert any(p.id == portion.id for p in result.portions)


@pytest.mark.asyncio
async def test_get_shared_food_not_found(db_session: AsyncSession) -> None:
    """Returns None for unknown ID."""
    result = await get_shared_food(db_session, shared_food_id=uuid.uuid4())
    assert result is None


# ---------------------------------------------------------------------------
# update
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_shared_food_only_owner(db_session: AsyncSession) -> None:
    """Non-owner gets None."""
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)
    await db_session.commit()

    food = await factory_create_shared_food(db_session, owner_user_id=user_a.id)
    await db_session.commit()

    result = await update_shared_food(
        db_session, owner_user_id=user_b.id, shared_food_id=food.id, name="Hacked",
    )
    assert result is None


@pytest.mark.asyncio
async def test_update_shared_food_resets_moderation(db_session: AsyncSession) -> None:
    """Editing approved+public item resets to pending."""
    user = await create_user(db_session)
    await db_session.commit()

    food = await factory_create_shared_food(
        db_session, owner_user_id=user.id,
        visibility=Visibility.public, moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    updated = await update_shared_food(
        db_session, owner_user_id=user.id, shared_food_id=food.id,
        display_name="Updated Name",
    )
    assert updated is not None
    assert updated.moderation_status == ModerationStatus.pending


# ---------------------------------------------------------------------------
# soft_delete
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_soft_delete_only_owner(db_session: AsyncSession) -> None:
    """Non-owner returns False."""
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)
    await db_session.commit()

    food = await factory_create_shared_food(db_session, owner_user_id=user_a.id)
    await db_session.commit()

    result = await soft_delete_shared_food(
        db_session, owner_user_id=user_b.id, shared_food_id=food.id,
    )
    assert result is False


# ---------------------------------------------------------------------------
# publish / unpublish
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_publish_sets_visibility_public(db_session: AsyncSession) -> None:
    """Visibility becomes public."""
    user = await create_user(db_session)
    await db_session.commit()

    food = await factory_create_shared_food(db_session, owner_user_id=user.id)
    await db_session.commit()

    published = await publish_shared_food(
        db_session, owner_user_id=user.id, shared_food_id=food.id,
    )
    assert published is not None
    assert published.visibility == Visibility.public
    assert published.moderation_status == ModerationStatus.pending


@pytest.mark.asyncio
async def test_publish_already_public_raises(db_session: AsyncSession) -> None:
    """Publishing an already-public item raises AlreadyPublished."""
    user = await create_user(db_session)
    await db_session.commit()

    food = await factory_create_shared_food(
        db_session, owner_user_id=user.id, visibility=Visibility.public,
    )
    await db_session.commit()

    with pytest.raises(AlreadyPublished):
        await publish_shared_food(
            db_session, owner_user_id=user.id, shared_food_id=food.id,
        )


@pytest.mark.asyncio
async def test_publish_not_found_returns_none(db_session: AsyncSession) -> None:
    """Publishing a non-existent food returns None."""
    user = await create_user(db_session)
    await db_session.commit()

    result = await publish_shared_food(
        db_session, owner_user_id=user.id, shared_food_id=uuid.uuid4(),
    )
    assert result is None


@pytest.mark.asyncio
async def test_unpublish_sets_visibility_private(db_session: AsyncSession) -> None:
    """Unpublishing sets visibility back to private."""
    user = await create_user(db_session)
    await db_session.commit()

    food = await factory_create_shared_food(
        db_session, owner_user_id=user.id, visibility=Visibility.public,
    )
    await db_session.commit()

    unpublished = await unpublish_shared_food(
        db_session, owner_user_id=user.id, shared_food_id=food.id,
    )
    assert unpublished is not None
    assert unpublished.visibility == Visibility.private


# ---------------------------------------------------------------------------
# search
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_search_only_finds_public_approved(db_session: AsyncSession) -> None:
    """Private/pending/rejected items excluded from search."""
    user = await create_user(db_session)
    await db_session.commit()

    marker = uuid.uuid4().hex[:8]

    # Create foods with different visibility/moderation combinations
    visible = await factory_create_shared_food(
        db_session, owner_user_id=user.id, name=f"Visible-{marker}",
        display_name=f"Visible-{marker}",
        visibility=Visibility.public, moderation_status=ModerationStatus.approved,
    )
    await factory_create_shared_food(
        db_session, owner_user_id=user.id, name=f"Private-{marker}",
        display_name=f"Private-{marker}",
        visibility=Visibility.private,
    )
    await factory_create_shared_food(
        db_session, owner_user_id=user.id, name=f"Pending-{marker}",
        display_name=f"Pending-{marker}",
        visibility=Visibility.public, moderation_status=ModerationStatus.pending,
    )
    await factory_create_shared_food(
        db_session, owner_user_id=user.id, name=f"Rejected-{marker}",
        display_name=f"Rejected-{marker}",
        visibility=Visibility.public, moderation_status=ModerationStatus.rejected,
    )
    await db_session.commit()

    results = await search_shared_foods(db_session, q=marker)
    ids = {f.id for f in results}

    assert visible.id in ids
    assert len(ids) == 1


@pytest.mark.asyncio
async def test_search_tsvector_finds_by_display_name(db_session: AsyncSession) -> None:
    """FTS works on display_name."""
    user = await create_user(db_session)
    await db_session.commit()

    marker = uuid.uuid4().hex[:8]
    food = await factory_create_shared_food(
        db_session, owner_user_id=user.id,
        name=f"Grilled Chicken {marker}",
        display_name=f"Grilled Chicken Breast {marker}",
        visibility=Visibility.public, moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    results = await search_shared_foods(db_session, q=f"chicken {marker}")
    assert any(r.id == food.id for r in results)


@pytest.mark.asyncio
async def test_search_ilike_fallback(db_session: AsyncSession) -> None:
    """Short queries use ILIKE."""
    user = await create_user(db_session)
    await db_session.commit()

    marker = uuid.uuid4().hex[:8]
    food = await factory_create_shared_food(
        db_session, owner_user_id=user.id,
        name=f"QZ{marker} Snack",
        display_name=f"QZ{marker} Snack",
        visibility=Visibility.public, moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    results = await search_shared_foods(db_session, q="QZ")
    found = [r for r in results if r.id == food.id]
    assert len(found) >= 1


@pytest.mark.asyncio
async def test_search_excludes_deleted(db_session: AsyncSession) -> None:
    """Deleted items excluded from search."""
    user = await create_user(db_session)
    await db_session.commit()

    marker = uuid.uuid4().hex[:8]
    food = await factory_create_shared_food(
        db_session, owner_user_id=user.id,
        name=f"Deleted-{marker}",
        display_name=f"Deleted-{marker}",
        visibility=Visibility.public, moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    await soft_delete_shared_food(db_session, owner_user_id=user.id, shared_food_id=food.id)

    results = await search_shared_foods(db_session, q=f"Deleted-{marker}")
    assert food.id not in {r.id for r in results}


# ---------------------------------------------------------------------------
# portions
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_portion_validates_ownership(db_session: AsyncSession) -> None:
    """Non-owner cannot add a portion."""
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)
    await db_session.commit()

    food = await factory_create_shared_food(db_session, owner_user_id=user_a.id)
    await db_session.commit()

    result = await add_portion_to_shared_food(
        db_session, owner_user_id=user_b.id, shared_food_id=food.id,
        label="100 g", base_amount=Decimal("100"), base_unit=Unit.g,
        calories=Decimal("200"),
    )
    assert result is None


@pytest.mark.asyncio
async def test_add_portion_manages_default_flag(db_session: AsyncSession) -> None:
    """First portion auto-default; second with is_default clears first."""
    user = await create_user(db_session)
    await db_session.commit()

    food = await factory_create_shared_food(db_session, owner_user_id=user.id)
    await db_session.commit()

    # First portion: auto-becomes default
    p1 = await add_portion_to_shared_food(
        db_session, owner_user_id=user.id, shared_food_id=food.id,
        label="100 g", base_amount=Decimal("100"), base_unit=Unit.g,
        calories=Decimal("200"), is_default=False,
    )
    assert p1 is not None
    assert p1.is_default is True

    # Second portion with is_default=True: clears first
    p2 = await add_portion_to_shared_food(
        db_session, owner_user_id=user.id, shared_food_id=food.id,
        label="1 serving", base_amount=Decimal("150"), base_unit=Unit.g,
        calories=Decimal("300"), is_default=True,
    )
    assert p2 is not None
    assert p2.is_default is True

    # Reload p1 to check default was cleared
    await db_session.refresh(p1)
    assert p1.is_default is False


# ---------------------------------------------------------------------------
# import to private
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_import_to_private_creates_product_and_portions(db_session: AsyncSession) -> None:
    """Full copy flow: shared food -> private product + portions."""
    user = await create_user(db_session)
    await db_session.commit()

    food = await factory_create_shared_food(
        db_session, owner_user_id=user.id,
        name="Oat Milk",
        visibility=Visibility.public, moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    await create_shared_food_portion(
        db_session, shared_food_id=food.id, label="100 ml",
        base_amount=Decimal("100"), base_unit=Unit.ml, calories=Decimal("50"),
        is_default=True,
    )
    await create_shared_food_portion(
        db_session, shared_food_id=food.id, label="1 cup",
        base_amount=Decimal("240"), base_unit=Unit.ml, calories=Decimal("120"),
        is_default=False,
    )
    await db_session.commit()

    result = await import_shared_food_to_private(
        db_session, user_id=user.id, shared_food_id=food.id,
    )
    assert result is not None
    product, portions = result

    assert product.name == "Oat Milk"
    assert product.user_id == user.id
    assert len(portions) == 2
    assert any(p.label == "100 ml" for p in portions)
    assert any(p.label == "1 cup" for p in portions)


@pytest.mark.asyncio
async def test_import_to_private_only_visible_items(db_session: AsyncSession) -> None:
    """Cannot import private item from another user."""
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)
    await db_session.commit()

    food = await factory_create_shared_food(
        db_session, owner_user_id=user_a.id,
        visibility=Visibility.private,
    )
    await db_session.commit()

    result = await import_shared_food_to_private(
        db_session, user_id=user_b.id, shared_food_id=food.id,
    )
    assert result is None


@pytest.mark.asyncio
async def test_import_to_private_owner_can_import_own_private(db_session: AsyncSession) -> None:
    """Owner can import their own private food."""
    user = await create_user(db_session)
    await db_session.commit()

    food = await factory_create_shared_food(
        db_session, owner_user_id=user.id,
        name="My Private Recipe",
        visibility=Visibility.private,
    )
    await db_session.commit()

    result = await import_shared_food_to_private(
        db_session, user_id=user.id, shared_food_id=food.id,
    )
    assert result is not None
    product, _portions = result
    assert product.name == "My Private Recipe"
