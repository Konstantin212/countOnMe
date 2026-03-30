"""Router for shared/community food endpoints."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user_id
from app.core.enums import Visibility
from app.core.rate_limit import publish_rate_limiter
from app.features.moderation.service import get_blocked_user_ids
from app.features.shared.schemas import (
    SharedFoodCreateRequest,
    SharedFoodImportResponse,
    SharedFoodListItem,
    SharedFoodPortionCreateRequest,
    SharedFoodPortionResponse,
    SharedFoodResponse,
    SharedFoodUpdateRequest,
)
from app.features.shared.service import (
    AlreadyPublished,
    _get_default_portion,
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shared", tags=["shared"])


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.post("/foods", response_model=SharedFoodResponse, status_code=status.HTTP_201_CREATED)
async def create_food(
    body: SharedFoodCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> SharedFoodResponse:
    """Create a new shared food (owned by the authenticated user)."""
    food = await create_shared_food(
        session,
        owner_user_id=user_id,
        name=body.name,
        display_name=body.display_name,
        description=body.description,
        brand=body.brand,
        barcode=body.barcode,
        category=body.category,
    )
    return SharedFoodResponse.model_validate(food)


@router.get("/foods/mine", response_model=list[SharedFoodListItem])
async def list_my_foods(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> list[SharedFoodListItem]:
    """List the authenticated user's shared foods (any visibility/status)."""
    foods = await list_my_shared_foods(
        session, owner_user_id=user_id, limit=limit, offset=offset,
    )
    return [
        SharedFoodListItem(
            id=f.id,
            owner_user_id=f.owner_user_id,
            name=f.name,
            display_name=f.display_name,
            brand=f.brand,
            barcode=f.barcode,
            category=f.category,
            visibility=f.visibility,
            moderation_status=f.moderation_status,
            default_portion=(
                SharedFoodPortionResponse.model_validate(dp)
                if (dp := _get_default_portion(f))
                else None
            ),
        )
        for f in foods
    ]


@router.get("/foods/search", response_model=list[SharedFoodListItem])
async def search_foods(
    q: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> list[SharedFoodListItem]:
    """Search public+approved shared foods (excludes blocked users' content)."""
    blocked_ids = await get_blocked_user_ids(session, user_id=user_id)
    foods = await search_shared_foods(
        session,
        q=q,
        limit=limit,
        offset=offset,
        exclude_owner_ids=blocked_ids if blocked_ids else None,
    )
    return [
        SharedFoodListItem(
            id=f.id,
            owner_user_id=f.owner_user_id,
            name=f.name,
            display_name=f.display_name,
            brand=f.brand,
            barcode=f.barcode,
            category=f.category,
            visibility=f.visibility,
            moderation_status=f.moderation_status,
            default_portion=(
                SharedFoodPortionResponse.model_validate(dp)
                if (dp := _get_default_portion(f))
                else None
            ),
        )
        for f in foods
    ]


@router.get("/foods/{shared_food_id}", response_model=SharedFoodResponse)
async def get_food(
    shared_food_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> SharedFoodResponse:
    """Get a shared food by ID.

    Owner can see any of their items. Non-owners can only see
    public+approved or unlisted items. Private items from other
    users return 404. Blocked users' content returns 404.
    """
    food = await get_shared_food(session, shared_food_id=shared_food_id)
    if food is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    is_owner = food.owner_user_id == user_id

    # Block check: if the food owner is blocked by the requester, return 404
    if not is_owner:
        blocked_ids = await get_blocked_user_ids(session, user_id=user_id)
        if food.owner_user_id in blocked_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    is_unlisted = food.visibility == Visibility.unlisted
    is_public_approved = (
        food.visibility == Visibility.public
        and food.moderation_status.value == "approved"
    )

    if not is_owner and not is_unlisted and not is_public_approved:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    return SharedFoodResponse.model_validate(food)


@router.patch("/foods/{shared_food_id}", response_model=SharedFoodResponse)
async def update_food(
    shared_food_id: uuid.UUID,
    body: SharedFoodUpdateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> SharedFoodResponse:
    """Update a shared food (owner only)."""
    # Check existence first for proper error code
    food = await get_shared_food(session, shared_food_id=shared_food_id)
    if food is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if food.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    updated = await update_shared_food(
        session,
        owner_user_id=user_id,
        shared_food_id=shared_food_id,
        name=body.name,
        display_name=body.display_name,
        description=body.description,
        brand=body.brand,
        barcode=body.barcode,
        category=body.category,
    )
    # updated should not be None since we checked ownership above
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    return SharedFoodResponse.model_validate(updated)


@router.delete("/foods/{shared_food_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_food(
    shared_food_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Soft-delete a shared food (owner only)."""
    food = await get_shared_food(session, shared_food_id=shared_food_id)
    if food is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if food.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    await soft_delete_shared_food(
        session, owner_user_id=user_id, shared_food_id=shared_food_id,
    )


# ---------------------------------------------------------------------------
# Publish / Unpublish
# ---------------------------------------------------------------------------


@router.post("/foods/{shared_food_id}/publish", response_model=SharedFoodResponse)
async def publish_food(
    shared_food_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> SharedFoodResponse:
    """Publish a shared food to the community (owner only). Rate limited."""
    publish_rate_limiter.check(str(user_id))
    try:
        result = await publish_shared_food(
            session, owner_user_id=user_id, shared_food_id=shared_food_id,
        )
    except AlreadyPublished:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Already published",
        ) from None

    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    return SharedFoodResponse.model_validate(result)


@router.post("/foods/{shared_food_id}/unpublish", response_model=SharedFoodResponse)
async def unpublish_food(
    shared_food_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> SharedFoodResponse:
    """Unpublish a shared food (owner only)."""
    result = await unpublish_shared_food(
        session, owner_user_id=user_id, shared_food_id=shared_food_id,
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    return SharedFoodResponse.model_validate(result)


# ---------------------------------------------------------------------------
# Portions
# ---------------------------------------------------------------------------


@router.post(
    "/foods/{shared_food_id}/portions",
    response_model=SharedFoodPortionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_portion(
    shared_food_id: uuid.UUID,
    body: SharedFoodPortionCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> SharedFoodPortionResponse:
    """Add a portion to a shared food (owner only)."""
    food = await get_shared_food(session, shared_food_id=shared_food_id)
    if food is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if food.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    portion = await add_portion_to_shared_food(
        session,
        owner_user_id=user_id,
        shared_food_id=shared_food_id,
        label=body.label,
        base_amount=body.base_amount,
        base_unit=body.base_unit,
        calories=body.calories,
        gram_weight=body.gram_weight,
        protein=body.protein,
        carbs=body.carbs,
        fat=body.fat,
        is_default=body.is_default,
    )
    # Should not be None since we checked ownership above
    if portion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    return SharedFoodPortionResponse.model_validate(portion)


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------


@router.post(
    "/foods/{shared_food_id}/import",
    response_model=SharedFoodImportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_food(
    shared_food_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> SharedFoodImportResponse:
    """Import a shared food into the user's private collection."""
    # Block check: if the food owner is blocked by the requester, return 404
    food = await get_shared_food(session, shared_food_id=shared_food_id)
    if food is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    blocked_ids = await get_blocked_user_ids(session, user_id=user_id)
    if food.owner_user_id in blocked_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    result = await import_shared_food_to_private(
        session, user_id=user_id, shared_food_id=shared_food_id,
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    product, portions = result
    return SharedFoodImportResponse(
        product_id=product.id,
        portion_count=len(portions),
    )
