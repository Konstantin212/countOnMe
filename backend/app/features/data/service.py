from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ownership import get_owner_filter
from app.features.meals.models import FoodEntry


async def delete_all_food_entries(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    device_id: uuid.UUID | None = None,
) -> int:
    """Bulk soft-delete all food entries for a user. Returns count of rows updated."""
    now = datetime.now(UTC)
    stmt = (
        update(FoodEntry)
        .where(
            get_owner_filter(FoodEntry, user_id=user_id),
            FoodEntry.deleted_at.is_(None),
        )
        .values(deleted_at=now, updated_at=now)
        .execution_options(synchronize_session=False)
    )
    result = await session.execute(stmt)
    await session.commit()
    return result.rowcount
