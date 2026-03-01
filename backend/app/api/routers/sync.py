from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_device_id
from app.db.session import get_session
from app.models.food_entry import FoodEntry
from app.models.product import Product
from app.models.product_portion import ProductPortion
from app.schemas.sync import SyncSinceResponse

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


def _cursor_filter(model, since: tuple[datetime, uuid.UUID] | None):
    if since is None:
        return True
    ts, last_id = since
    return or_(
        model.updated_at > ts,
        and_(model.updated_at == ts, model.id > last_id),
    )


@router.get("/since", response_model=SyncSinceResponse)
async def sync_since(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> SyncSinceResponse:
    since = _parse_cursor(cursor)

    prod_stmt = (
        select(Product)
        .where(Product.device_id == device_id)
        .where(_cursor_filter(Product, since))
        .order_by(Product.updated_at.asc(), Product.id.asc())
        .limit(limit)
    )
    portion_stmt = (
        select(ProductPortion)
        .where(ProductPortion.device_id == device_id)
        .where(_cursor_filter(ProductPortion, since))
        .order_by(ProductPortion.updated_at.asc(), ProductPortion.id.asc())
        .limit(limit)
    )
    entry_stmt = (
        select(FoodEntry)
        .where(FoodEntry.device_id == device_id)
        .where(_cursor_filter(FoodEntry, since))
        .order_by(FoodEntry.updated_at.asc(), FoodEntry.id.asc())
        .limit(limit)
    )

    prods = list((await session.execute(prod_stmt)).scalars().all())
    portions = list((await session.execute(portion_stmt)).scalars().all())
    entries = list((await session.execute(entry_stmt)).scalars().all())

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

