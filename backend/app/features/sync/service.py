"""Sync service — unified delta queries for sync pull + batch push with LWW.

Pull: Returns changes across all 6 syncable entity types since a given
sync_version, ordered globally by sync_version.  Soft-deleted rows are
included so the client can reconcile deletions.

Push: Processes a batch of mutations (upsert / delete) with Last Writer Wins
conflict resolution.  ``client_updated_at > server.updated_at`` means the
client wins; server wins on tie.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import inspect as sa_inspect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ownership import get_owner_filter
from app.features.goals.models import UserGoal
from app.features.meals.models import FoodEntry
from app.features.portions.models import ProductPortion
from app.features.products.models import Product
from app.features.sync.schemas import (
    MutationAction,
    MutationResult,
    MutationResultStatus,
    SyncMutation,
)
from app.features.water.models import WaterLog
from app.features.weights.models import BodyWeight

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

# entity_type key -> ORM model class
SYNCABLE_MODELS: dict[str, type] = {
    "products": Product,
    "portions": ProductPortion,
    "food_entries": FoodEntry,
    "goals": UserGoal,
    "body_weights": BodyWeight,
    "water_logs": WaterLog,
}

# Fields each entity type accepts from push data dict.
_PUSH_FIELDS: dict[str, set[str]] = {
    "products": {"name", "barcode"},
    "portions": {
        "product_id", "label", "base_amount", "base_unit",
        "calories", "protein", "carbs", "fat", "is_default",
    },
    "food_entries": {
        "product_id", "portion_id", "catalog_portion_id",
        "day", "meal_type", "amount", "unit",
    },
    "body_weights": {"day", "weight_kg"},
    "goals": {
        "goal_type", "gender", "birth_date", "height_cm", "current_weight_kg",
        "activity_level", "weight_goal_type", "target_weight_kg",
        "weight_change_pace", "bmr_kcal", "tdee_kcal",
        "daily_calories_kcal", "protein_percent", "carbs_percent",
        "fat_percent", "protein_grams", "carbs_grams", "fat_grams",
        "water_ml", "healthy_weight_min_kg", "healthy_weight_max_kg",
        "current_bmi", "bmi_category",
    },
    "water_logs": {"day", "amount_ml"},
}

# Dependency order for push — parents first so FK references exist.
_PROCESS_ORDER = [
    "products",
    "portions",
    "food_entries",
    "body_weights",
    "goals",
    "water_logs",
]

# ===================================================================
# PULL
# ===================================================================


async def _query_table_deltas(
    session: AsyncSession,
    model: type,
    user_id: uuid.UUID,
    since_version: int,
    limit: int,
) -> list:
    """Query a single table for rows with sync_version > since_version.

    NOTE: Soft-deleted rows (deleted_at IS NOT NULL) are intentionally included.
    The client needs them to reconcile local deletions during sync pull.
    """
    stmt = (
        select(model)
        .where(
            get_owner_filter(model, user_id=user_id),
            model.sync_version > since_version,
        )
        .order_by(model.sync_version.asc(), model.id.asc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_deltas(
    session: AsyncSession,
    user_id: uuid.UUID,
    since_version: int,
    limit: int = 500,
) -> tuple[dict[str, list], bool]:
    """Return delta changes across all syncable tables since *since_version*.

    Strategy: Query each table independently (limit+1 per table), merge by
    sync_version in Python, truncate to *limit*.

    Returns:
        (changes_by_entity_type, has_more)
        changes_by_entity_type maps entity key -> list of ORM rows
    """
    fetch_limit = limit + 1
    all_rows: list[tuple[str, object]] = []

    for entity_key, model in SYNCABLE_MODELS.items():
        rows = await _query_table_deltas(session, model, user_id, since_version, fetch_limit)
        for row in rows:
            all_rows.append((entity_key, row))

    # Sort globally by sync_version, then id for tiebreaker
    all_rows.sort(key=lambda pair: (pair[1].sync_version, str(pair[1].id)))

    has_more = len(all_rows) > limit
    all_rows = all_rows[:limit]

    # Group by entity type
    changes: dict[str, list] = {key: [] for key in SYNCABLE_MODELS}
    for entity_key, row in all_rows:
        changes[entity_key].append(row)

    return changes, has_more


def compute_sync_cursor(changes: dict[str, list]) -> str | None:
    """Derive the cursor string from the highest sync_version across all returned rows."""
    max_version: int | None = None
    max_ts: datetime | None = None

    for rows in changes.values():
        for row in rows:
            v = row.sync_version
            if max_version is None or v > max_version:
                max_version = v
                max_ts = row.server_updated_at

    if max_version is None:
        return None

    ts_str = max_ts.astimezone(UTC).isoformat().replace("+00:00", "Z") if max_ts else ""
    return f"{max_version}|{ts_str}"


def parse_sync_cursor(cursor: str | None) -> int:
    """Parse cursor string back to since_version int. Returns 0 for empty cursor."""
    if not cursor:
        return 0
    try:
        parts = cursor.split("|", 1)
        return int(parts[0])
    except (ValueError, IndexError):
        return 0


# ===================================================================
# PUSH  —  LWW batch mutations
# ===================================================================


def _coerce_value(value: object, col_type: type) -> object:
    """Coerce a JSON-deserialized value to the expected SQLAlchemy column type.

    Push mutation data comes from JSON so dates arrive as strings,
    UUIDs as strings, decimals as floats, etc.
    """
    if value is None:
        return None
    # Import lazily to keep module-level imports clean
    from sqlalchemy import Date, DateTime, Numeric
    from sqlalchemy.dialects.postgresql import UUID as PG_UUID

    if isinstance(col_type, (Date,)):
        if isinstance(value, str):
            return date.fromisoformat(value)
        return value
    if isinstance(col_type, (DateTime,)):
        if isinstance(value, str):
            return datetime.fromisoformat(value)
        return value
    if isinstance(col_type, (PG_UUID,)):
        if isinstance(value, str):
            return uuid.UUID(value)
        return value
    if isinstance(col_type, (Numeric,)):
        if isinstance(value, (int, float, str)):
            return Decimal(str(value))
        return value
    return value


def _coerce_data_for_model(model: type, data: dict) -> dict:
    """Coerce all values in *data* to match the model's column types."""
    mapper = sa_inspect(model)
    coerced: dict = {}
    for key, value in data.items():
        col = mapper.columns.get(key)
        if col is not None:
            coerced[key] = _coerce_value(value, col.type)
        else:
            continue  # Skip keys not found in model columns
    return coerced


def _sort_mutations(mutations: list[SyncMutation]) -> list[SyncMutation]:
    """Sort mutations by entity dependency order."""
    order_map = {key: idx for idx, key in enumerate(_PROCESS_ORDER)}
    return sorted(mutations, key=lambda m: order_map.get(m.entity_type, 999))


async def _fetch_existing(
    session: AsyncSession,
    model: type,
    row_id: uuid.UUID,
    user_id: uuid.UUID,
) -> object | None:
    """Fetch an existing row by ID scoped to user. Includes soft-deleted rows."""
    stmt = select(model).where(
        get_owner_filter(model, user_id=user_id),
        model.id == row_id,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


def _client_wins_lww(
    existing_updated_at: datetime,
    client_updated_at: datetime,
) -> bool:
    """Return True if the client wins the LWW comparison.

    Client wins only if its timestamp is strictly greater than server's.
    Server wins on tie.
    """
    server_ts = existing_updated_at
    if server_ts.tzinfo is None:
        server_ts = server_ts.replace(tzinfo=UTC)
    client_ts = client_updated_at
    if client_ts.tzinfo is None:
        client_ts = client_ts.replace(tzinfo=UTC)
    return client_ts > server_ts


async def _apply_upsert(
    session: AsyncSession,
    mutation: SyncMutation,
    model: type,
    allowed_fields: set[str],
    user_id: uuid.UUID,
    device_id: uuid.UUID | None,
) -> MutationResult:
    """Apply an upsert mutation."""
    existing = await _fetch_existing(session, model, mutation.id, user_id)

    # Coerce data types from JSON to Python/SQLAlchemy types
    raw_data = mutation.data or {}
    data = _coerce_data_for_model(model, {k: v for k, v in raw_data.items() if k in allowed_fields})

    if existing is not None:
        # LWW check
        if not _client_wins_lww(existing.updated_at, mutation.client_updated_at):
            return MutationResult(
                id=mutation.id,
                status=MutationResultStatus.conflict,
                server_updated_at=existing.server_updated_at,
                message="Server version is newer or equal",
            )

        # Apply update
        for field_name, value in data.items():
            setattr(existing, field_name, value)
        existing.updated_at = mutation.client_updated_at
        if device_id is not None:
            existing.updated_on_device_id = device_id
        # Un-delete if previously soft-deleted and client is upserting
        if existing.deleted_at is not None:
            existing.deleted_at = None
        session.add(existing)
        await session.flush()
        await session.refresh(existing)
        return MutationResult(
            id=mutation.id,
            status=MutationResultStatus.applied,
            server_updated_at=existing.server_updated_at,
        )

    # Before INSERT, check if the PK exists globally (owned by another user).
    # This avoids PK collisions and identity map conflicts.
    pk_check = await session.execute(
        select(model.id).where(model.id == mutation.id)
    )
    if pk_check.scalar_one_or_none() is not None:
        # Row exists but belongs to a different user (our user-scoped
        # lookup above returned None).
        return MutationResult(
            id=mutation.id,
            status=MutationResultStatus.error,
            message="ID conflict with another user's data",
        )

    # INSERT new row
    kwargs: dict[str, object] = {"id": mutation.id, "user_id": user_id}
    kwargs.update(data)
    kwargs["updated_at"] = mutation.client_updated_at
    if device_id is not None:
        kwargs["device_id"] = device_id
        kwargs["created_on_device_id"] = device_id
        kwargs["updated_on_device_id"] = device_id

    row = model(**kwargs)
    session.add(row)
    await session.flush()
    await session.refresh(row)
    return MutationResult(
        id=mutation.id,
        status=MutationResultStatus.applied,
        server_updated_at=row.server_updated_at,
    )


async def _apply_delete(
    session: AsyncSession,
    mutation: SyncMutation,
    model: type,
    user_id: uuid.UUID,
    device_id: uuid.UUID | None,
) -> MutationResult:
    """Apply a soft-delete mutation."""
    existing = await _fetch_existing(session, model, mutation.id, user_id)

    if existing is None:
        return MutationResult(
            id=mutation.id,
            status=MutationResultStatus.applied,
            message="Already deleted or not found",
        )

    # LWW check for delete
    if not _client_wins_lww(existing.updated_at, mutation.client_updated_at):
        return MutationResult(
            id=mutation.id,
            status=MutationResultStatus.conflict,
            server_updated_at=existing.server_updated_at,
            message="Server version is newer or equal",
        )

    existing.deleted_at = datetime.now(UTC)
    existing.updated_at = mutation.client_updated_at
    if device_id is not None:
        existing.updated_on_device_id = device_id
    session.add(existing)
    await session.flush()
    await session.refresh(existing)
    return MutationResult(
        id=mutation.id,
        status=MutationResultStatus.applied,
        server_updated_at=existing.server_updated_at,
    )


async def process_push(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    mutations: list[SyncMutation],
    device_id: uuid.UUID | None = None,
) -> list[MutationResult]:
    """Process a batch of sync mutations with LWW conflict resolution.

    Mutations are sorted by entity dependency order (products first, then
    portions, then food_entries/others) to ensure FK references exist.

    All mutations run in the current session and are committed at the end.
    """
    sorted_mutations = _sort_mutations(mutations)
    results: list[MutationResult] = []

    for mutation in sorted_mutations:
        if mutation.entity_type not in SYNCABLE_MODELS:
            results.append(MutationResult(
                id=mutation.id,
                status=MutationResultStatus.error,
                message=f"Unknown entity type: {mutation.entity_type}",
            ))
            continue

        model = SYNCABLE_MODELS[mutation.entity_type]
        allowed_fields = _PUSH_FIELDS[mutation.entity_type]

        if mutation.action == MutationAction.upsert:
            result = await _apply_upsert(
                session, mutation, model, allowed_fields, user_id, device_id,
            )
        elif mutation.action == MutationAction.delete:
            result = await _apply_delete(
                session, mutation, model, user_id, device_id,
            )
        else:
            result = MutationResult(
                id=mutation.id,
                status=MutationResultStatus.error,
                message=f"Unknown action: {mutation.action}",
            )

        results.append(result)

    await session.commit()
    return results
