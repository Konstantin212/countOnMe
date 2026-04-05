"""Sync router — delta-based pull and batch push endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user_id, get_optional_device_id
from app.features.sync.schemas import (
    BodyWeightChanges,
    FastingSessionChanges,
    FoodEntryChanges,
    GoalChanges,
    PortionChanges,
    ProductChanges,
    SyncBodyWeight,
    SyncFastingSession,
    SyncFoodEntry,
    SyncPortion,
    SyncProduct,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
    SyncUserGoal,
    SyncWaterLog,
    WaterLogChanges,
)
from app.features.sync.service import compute_sync_cursor, get_deltas, process_push

router = APIRouter(prefix="/sync", tags=["sync"])

# Mapping from entity key to (changes schema class, item schema class)
_ENTITY_SCHEMA_MAP: dict[str, tuple[type, type]] = {
    "products": (ProductChanges, SyncProduct),
    "portions": (PortionChanges, SyncPortion),
    "food_entries": (FoodEntryChanges, SyncFoodEntry),
    "goals": (GoalChanges, SyncUserGoal),
    "body_weights": (BodyWeightChanges, SyncBodyWeight),
    "water_logs": (WaterLogChanges, SyncWaterLog),
    "fasting_sessions": (FastingSessionChanges, SyncFastingSession),
}


def _build_pull_response(
    changes: dict[str, list],
    has_more: bool,
) -> SyncPullResponse:
    """Convert raw ORM rows grouped by entity key into a SyncPullResponse."""
    cursor = compute_sync_cursor(changes)

    result: dict[str, object] = {}
    for entity_key, rows in changes.items():
        changes_cls, item_cls = _ENTITY_SCHEMA_MAP[entity_key]
        upserts = []
        deletes = []
        for row in rows:
            if row.deleted_at is not None:
                deletes.append(row.id)
            else:
                upserts.append(item_cls.model_validate(row))
        result[entity_key] = changes_cls(upserts=upserts, deletes=deletes)

    return SyncPullResponse(
        products=result.get("products", ProductChanges()),
        portions=result.get("portions", PortionChanges()),
        food_entries=result.get("food_entries", FoodEntryChanges()),
        goals=result.get("goals", GoalChanges()),
        body_weights=result.get("body_weights", BodyWeightChanges()),
        water_logs=result.get("water_logs", WaterLogChanges()),
        fasting_sessions=result.get("fasting_sessions", FastingSessionChanges()),
        sync_cursor=cursor,
        has_more=has_more,
    )


@router.get("/pull", response_model=SyncPullResponse)
async def sync_pull(
    since_version: int = Query(default=0, ge=0),
    limit: int = Query(default=500, ge=1, le=500),
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> SyncPullResponse:
    """Return delta changes across all syncable entities since a given sync_version."""
    changes, has_more = await get_deltas(session, user_id, since_version, limit)
    return _build_pull_response(changes, has_more)


@router.post("/push", response_model=SyncPushResponse)
async def sync_push(
    body: SyncPushRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    device_id: uuid.UUID | None = Depends(get_optional_device_id),
    session: AsyncSession = Depends(get_session),
) -> SyncPushResponse:
    """Accept a batch of mutations with LWW conflict resolution."""
    # Use device_id from header, fall back to body.device_id
    effective_device_id = device_id or body.device_id
    results = await process_push(
        session,
        user_id=user_id,
        mutations=body.mutations,
        device_id=effective_device_id,
    )
    return SyncPushResponse(results=results)
