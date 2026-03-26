"""Sync service — query helpers for incremental sync.

NOTE: Sync intentionally returns soft-deleted rows (no ``deleted_at.is_(None)``
filter).  The client needs to see deletions so it can reconcile its local cache
and remove items that were soft-deleted on the server.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ownership import get_owner_filter
from app.features.meals.models import FoodEntry
from app.features.portions.models import ProductPortion
from app.features.products.models import Product


def _cursor_filter(model: type, since: tuple[datetime, uuid.UUID] | None):
    """Build a keyset-pagination filter for ``(updated_at, id)``."""
    if since is None:
        return True
    ts, last_id = since
    return or_(
        model.updated_at > ts,
        and_(model.updated_at == ts, model.id > last_id),
    )


async def get_changed_products(
    session: AsyncSession,
    user_id: uuid.UUID,
    since: tuple[datetime, uuid.UUID] | None,
    limit: int,
) -> list[Product]:
    """Return products changed after *since* cursor (includes soft-deleted rows)."""
    stmt = (
        select(Product)
        .where(get_owner_filter(Product, user_id=user_id))
        .where(_cursor_filter(Product, since))
        .order_by(Product.updated_at.asc(), Product.id.asc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_changed_portions(
    session: AsyncSession,
    user_id: uuid.UUID,
    since: tuple[datetime, uuid.UUID] | None,
    limit: int,
) -> list[ProductPortion]:
    """Return portions changed after *since* cursor (includes soft-deleted rows)."""
    stmt = (
        select(ProductPortion)
        .where(get_owner_filter(ProductPortion, user_id=user_id))
        .where(_cursor_filter(ProductPortion, since))
        .order_by(ProductPortion.updated_at.asc(), ProductPortion.id.asc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_changed_food_entries(
    session: AsyncSession,
    user_id: uuid.UUID,
    since: tuple[datetime, uuid.UUID] | None,
    limit: int,
) -> list[FoodEntry]:
    """Return food entries changed after *since* cursor (includes soft-deleted rows)."""
    stmt = (
        select(FoodEntry)
        .where(get_owner_filter(FoodEntry, user_id=user_id))
        .where(_cursor_filter(FoodEntry, since))
        .order_by(FoodEntry.updated_at.asc(), FoodEntry.id.asc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
