from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user_id
from app.features.sync.schemas import SyncSinceResponse
from app.features.sync.service import (
    get_changed_food_entries,
    get_changed_portions,
    get_changed_products,
)

router = APIRouter(prefix="/sync", tags=["sync"])


def _parse_cursor(cursor: str | None) -> tuple[datetime, uuid.UUID] | None:
    if not cursor:
        return None
    try:
        ts_raw, id_raw = cursor.split("|", 1)
        # ISO 8601
        ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=UTC)
        return ts, uuid.UUID(id_raw)
    except Exception:
        return None


def _format_cursor(ts: datetime, id_: uuid.UUID) -> str:
    return f"{ts.astimezone(UTC).isoformat().replace('+00:00', 'Z')}|{id_}"


@router.get("/since", response_model=SyncSinceResponse)
async def sync_since(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> SyncSinceResponse:
    since = _parse_cursor(cursor)

    prods = await get_changed_products(session, user_id, since, limit)
    portions = await get_changed_portions(session, user_id, since, limit)
    entries = await get_changed_food_entries(session, user_id, since, limit)

    # Advance cursor to max(updated_at, id) across all returned rows.
    max_pair: tuple[datetime, uuid.UUID] | None = None
    for row in [*prods, *portions, *entries]:
        pair = (row.updated_at, row.id)
        if max_pair is None or pair > max_pair:
            max_pair = pair

    next_cursor = _format_cursor(max_pair[0], max_pair[1]) if max_pair else cursor

    return SyncSinceResponse(
        cursor=next_cursor,
        products=prods,
        portions=portions,
        food_entries=entries,
    )
