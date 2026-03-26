from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import Select, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.enums import ModerationStatus, Visibility
from app.features.portions.models import ProductPortion
from app.features.products.models import Product
from app.features.shared.models import SharedFood, SharedFoodPortion

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _not_deleted(stmt: Select) -> Select:
    return stmt.where(SharedFood.deleted_at.is_(None))


def _escape_like(value: str) -> str:
    """Escape LIKE special characters (%, _, \\) so they match literally."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _get_default_portion(food: SharedFood) -> SharedFoodPortion | None:
    """Return the default portion for a shared food, or None."""
    return next((p for p in food.portions if p.is_default), None)


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


async def create_shared_food(
    session: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    name: str,
    display_name: str,
    description: str | None = None,
    brand: str | None = None,
    barcode: str | None = None,
    category: str | None = None,
) -> SharedFood:
    """Create a new shared food with default visibility=private, moderation_status=pending."""
    food = SharedFood(
        owner_user_id=owner_user_id,
        name=name,
        display_name=display_name,
        description=description,
        brand=brand,
        barcode=barcode,
        category=category,
    )
    session.add(food)
    await session.commit()
    await session.refresh(food)
    return food


async def list_my_shared_foods(
    session: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
) -> list[SharedFood]:
    """Return all non-deleted shared foods owned by this user (any visibility/status)."""
    stmt = (
        _not_deleted(select(SharedFood))
        .options(selectinload(SharedFood.portions))
        .where(SharedFood.owner_user_id == owner_user_id)
        .order_by(SharedFood.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_shared_food(
    session: AsyncSession,
    *,
    shared_food_id: uuid.UUID,
) -> SharedFood | None:
    """Return a single shared food with portions (no ownership check -- caller decides)."""
    stmt = (
        _not_deleted(select(SharedFood))
        .options(selectinload(SharedFood.portions))
        .where(SharedFood.id == shared_food_id)
        .execution_options(populate_existing=True)
    )
    result = await session.execute(stmt)
    return result.scalars().first()


async def update_shared_food(
    session: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    shared_food_id: uuid.UUID,
    name: str | None = None,
    display_name: str | None = None,
    description: str | None = None,
    brand: str | None = None,
    barcode: str | None = None,
    category: str | None = None,
) -> SharedFood | None:
    """Update a shared food. Returns None if not found or not owned.

    If the food is public+approved and content changes, resets moderation_status to pending.

    NOTE: Nullable fields (description, brand, barcode, category) cannot be cleared
    to None via PATCH because None is used as the "field not provided" sentinel.
    A proper fix requires using Pydantic's ``model_fields_set`` to distinguish
    between "not sent" and "explicitly set to null". Deferred for now.
    """
    food = await get_shared_food(session, shared_food_id=shared_food_id)
    if food is None or food.owner_user_id != owner_user_id:
        return None

    content_changed = False
    if name is not None and name != food.name:
        food.name = name
        content_changed = True
    if display_name is not None and display_name != food.display_name:
        food.display_name = display_name
        content_changed = True
    if description is not None and description != food.description:
        food.description = description
        content_changed = True
    if brand is not None and brand != food.brand:
        food.brand = brand
        content_changed = True
    if barcode is not None and barcode != food.barcode:
        food.barcode = barcode
        content_changed = True
    if category is not None and category != food.category:
        food.category = category
        content_changed = True

    # Reset moderation if content changed on a public+approved item
    if (
        content_changed
        and food.visibility == Visibility.public
        and food.moderation_status == ModerationStatus.approved
    ):
        food.moderation_status = ModerationStatus.pending

    food.updated_at = datetime.now(UTC)
    session.add(food)
    await session.commit()
    await session.refresh(food)
    return food


async def soft_delete_shared_food(
    session: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    shared_food_id: uuid.UUID,
) -> bool:
    """Soft-delete a shared food. Only owner can delete. Returns False if not found/not owned."""
    food = await get_shared_food(session, shared_food_id=shared_food_id)
    if food is None or food.owner_user_id != owner_user_id:
        return False

    food.deleted_at = datetime.now(UTC)
    food.updated_at = datetime.now(UTC)
    session.add(food)
    await session.commit()
    return True


# ---------------------------------------------------------------------------
# Publish / Unpublish
# ---------------------------------------------------------------------------


class AlreadyPublished(Exception):
    """Raised when attempting to publish an already-public shared food."""


async def publish_shared_food(
    session: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    shared_food_id: uuid.UUID,
) -> SharedFood | None:
    """Set visibility=public, moderation_status=pending.

    Returns None if not found or not owned.
    Raises AlreadyPublished if already public.
    """
    food = await get_shared_food(session, shared_food_id=shared_food_id)
    if food is None or food.owner_user_id != owner_user_id:
        return None

    if food.visibility == Visibility.public:
        raise AlreadyPublished

    food.visibility = Visibility.public
    food.moderation_status = ModerationStatus.pending
    food.updated_at = datetime.now(UTC)
    session.add(food)
    await session.commit()
    await session.refresh(food)
    return food


async def unpublish_shared_food(
    session: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    shared_food_id: uuid.UUID,
) -> SharedFood | None:
    """Set visibility=private, keep moderation_status as-is.

    Returns None if not found or not owned.
    """
    food = await get_shared_food(session, shared_food_id=shared_food_id)
    if food is None or food.owner_user_id != owner_user_id:
        return None

    food.visibility = Visibility.private
    food.updated_at = datetime.now(UTC)
    session.add(food)
    await session.commit()
    await session.refresh(food)
    return food


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


async def search_shared_foods(
    session: AsyncSession,
    *,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
    exclude_owner_ids: set[uuid.UUID] | None = None,
) -> list[SharedFood]:
    """Search public+approved shared foods.

    Search strategy (matches catalog pattern):
    - len(q) >= 3: combined tsvector + ILIKE query
    - len(q) < 3: ILIKE on display_name directly
    - No query: order by display_name ascending
    """
    stmt = (
        select(SharedFood)
        .options(selectinload(SharedFood.portions))
        .where(
            SharedFood.deleted_at.is_(None),
            SharedFood.visibility == Visibility.public,
            SharedFood.moderation_status == ModerationStatus.approved,
        )
    )

    if exclude_owner_ids:
        stmt = stmt.where(SharedFood.owner_user_id.not_in(exclude_owner_ids))

    search = q.strip() if q else None

    if search:
        escaped = _escape_like(search)

        if len(search) >= 3:
            ts_query = func.plainto_tsquery("english", search)
            stmt = stmt.where(
                or_(
                    SharedFood.search_vector.op("@@")(ts_query),
                    SharedFood.display_name.ilike(f"%{escaped}%"),
                )
            ).order_by(
                func.ts_rank(SharedFood.search_vector, ts_query).desc(),
            )
        else:
            stmt = stmt.where(SharedFood.display_name.ilike(f"%{escaped}%"))

    if not search or len(search) < 3:
        stmt = stmt.order_by(SharedFood.display_name.asc())

    stmt = stmt.limit(limit).offset(offset)

    result = await session.execute(stmt)
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Portions
# ---------------------------------------------------------------------------


async def add_portion_to_shared_food(
    session: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    shared_food_id: uuid.UUID,
    label: str,
    base_amount: Decimal,
    base_unit: str,
    calories: Decimal,
    gram_weight: Decimal | None = None,
    protein: Decimal | None = None,
    carbs: Decimal | None = None,
    fat: Decimal | None = None,
    is_default: bool = False,
) -> SharedFoodPortion | None:
    """Add a portion to a shared food. Validates ownership.

    Returns None if food not found or not owned.
    Manages is_default constraint: if new portion is_default, clears previous defaults.
    First portion auto-becomes default.
    """
    food = await get_shared_food(session, shared_food_id=shared_food_id)
    if food is None or food.owner_user_id != owner_user_id:
        return None

    # First portion is always default
    should_be_default = is_default if food.portions else True

    portion = SharedFoodPortion(
        shared_food_id=shared_food_id,
        label=label,
        base_amount=base_amount,
        base_unit=base_unit,
        calories=calories,
        gram_weight=gram_weight,
        protein=protein,
        carbs=carbs,
        fat=fat,
        is_default=should_be_default,
    )
    session.add(portion)
    await session.flush()

    if portion.is_default:
        await session.execute(
            update(SharedFoodPortion)
            .where(
                SharedFoodPortion.shared_food_id == shared_food_id,
                SharedFoodPortion.id != portion.id,
            )
            .values(is_default=False, updated_at=func.now())
        )

    await session.commit()
    await session.refresh(portion)
    return portion


# ---------------------------------------------------------------------------
# Import to private
# ---------------------------------------------------------------------------


async def import_shared_food_to_private(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    shared_food_id: uuid.UUID,
) -> tuple[Product, list[ProductPortion]] | None:
    """Copy a shared food + portions into the user's private products.

    The shared food must be visible to the user:
    - Public + approved (any user)
    - Owned by the user (any visibility)

    Returns None if the food is not accessible.
    """
    food = await get_shared_food(session, shared_food_id=shared_food_id)
    if food is None:
        return None

    # Access check: owner can always import; others need public+approved
    is_owner = food.owner_user_id == user_id
    is_visible = (
        food.visibility == Visibility.public
        and food.moderation_status == ModerationStatus.approved
    )
    if not is_owner and not is_visible:
        return None

    # Wrap product + portions creation in a savepoint for atomicity
    async with session.begin_nested():
        # Create private product
        product = Product(
            user_id=user_id,
            name=food.name,
            barcode=food.barcode,
        )
        session.add(product)
        await session.flush()

        # Copy portions
        created_portions: list[ProductPortion] = []
        for sp in food.portions:
            pp = ProductPortion(
                user_id=user_id,
                product_id=product.id,
                label=sp.label,
                base_amount=sp.base_amount,
                base_unit=sp.base_unit,
                calories=sp.calories,
                protein=sp.protein,
                carbs=sp.carbs,
                fat=sp.fat,
                is_default=sp.is_default,
            )
            session.add(pp)
            created_portions.append(pp)

    await session.commit()
    await session.refresh(product)
    for pp in created_portions:
        await session.refresh(pp)

    return product, created_portions
