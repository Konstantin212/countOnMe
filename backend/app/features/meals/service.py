from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import Select, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ownership import get_owner_filter
from app.features.catalog.models import CatalogPortion, CatalogProduct
from app.features.meals.models import FoodEntry
from app.features.portions.models import ProductPortion
from app.features.products.models import Product
from app.features.products.service import get_product


def _not_deleted(stmt: Select) -> Select:
    return stmt.where(FoodEntry.deleted_at.is_(None))


async def _get_portion(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    portion_id: uuid.UUID,
    device_id: uuid.UUID | None = None,
) -> ProductPortion | None:
    stmt = (
        select(ProductPortion)
        .where(
            ProductPortion.deleted_at.is_(None),
            get_owner_filter(ProductPortion, user_id=user_id),
            ProductPortion.id == portion_id,
        )
        .limit(1)
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def _get_catalog_portion(
    session: AsyncSession,
    catalog_portion_id: uuid.UUID,
) -> CatalogPortion | None:
    """Validate that a catalog portion exists (global, no device scoping)."""
    stmt = (
        select(CatalogPortion)
        .where(CatalogPortion.id == catalog_portion_id)
        .limit(1)
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def create_food_entry(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    product_id: uuid.UUID | None = None,
    portion_id: uuid.UUID | None = None,
    catalog_portion_id: uuid.UUID | None = None,
    day: date,
    meal_type: str,
    amount: str | int | float,
    unit: str,
    device_id: uuid.UUID | None = None,
) -> FoodEntry | None:
    if catalog_portion_id is not None:
        # Catalog path: validate portion exists (global, no device scoping)
        cat_portion = await _get_catalog_portion(session, catalog_portion_id)
        if cat_portion is None:
            return None

        entry = FoodEntry(
            user_id=user_id,
            device_id=device_id,
            created_on_device_id=device_id,
            catalog_portion_id=catalog_portion_id,
            day=day,
            meal_type=meal_type,
            amount=amount,
            unit=unit,
        )
        session.add(entry)
        await session.commit()
        await session.refresh(entry)
        return entry

    # Private product path (existing)
    if product_id is None or portion_id is None:
        return None

    product = await get_product(session, user_id=user_id, product_id=product_id)
    if product is None:
        return None

    portion = await _get_portion(session, user_id=user_id, portion_id=portion_id)
    if portion is None or portion.product_id != product_id:
        return None

    entry = FoodEntry(
        device_id=device_id,
        user_id=user_id,
        created_on_device_id=device_id,
        product_id=product_id,
        portion_id=portion_id,
        day=day,
        meal_type=meal_type,
        amount=amount,
        unit=unit,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry


async def list_food_entries(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    day: date | None = None,
    from_day: date | None = None,
    to_day: date | None = None,
    device_id: uuid.UUID | None = None,
) -> list[FoodEntry]:
    stmt = _not_deleted(select(FoodEntry)).where(
        get_owner_filter(FoodEntry, user_id=user_id),
    )
    if day is not None:
        stmt = stmt.where(FoodEntry.day == day)
    if from_day is not None:
        stmt = stmt.where(FoodEntry.day >= from_day)
    if to_day is not None:
        stmt = stmt.where(FoodEntry.day <= to_day)
    stmt = stmt.order_by(FoodEntry.day.desc(), FoodEntry.created_at.desc())
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def get_food_entry(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    entry_id: uuid.UUID,
    device_id: uuid.UUID | None = None,
) -> FoodEntry | None:
    stmt = _not_deleted(select(FoodEntry)).where(
        get_owner_filter(FoodEntry, user_id=user_id),
        FoodEntry.id == entry_id,
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def update_food_entry(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    entry_id: uuid.UUID,
    patch: dict,
    device_id: uuid.UUID | None = None,
) -> FoodEntry | None:
    entry = await get_food_entry(session, user_id=user_id, entry_id=entry_id)
    if entry is None:
        return None

    # Catalog entries only allow amount/unit updates (reject portion_id patches)
    if entry.catalog_portion_id is not None:
        disallowed = {"portion_id", "product_id", "catalog_portion_id"}
        if disallowed & set(patch.keys()):
            return None

    if "portion_id" in patch:
        # Private entry: validate portion belongs to same product
        if entry.product_id is None:
            return None
        portion = await _get_portion(session, user_id=user_id, portion_id=patch["portion_id"])
        if portion is None or portion.product_id != entry.product_id:
            return None

    for k, v in patch.items():
        setattr(entry, k, v)
    entry.updated_at = datetime.now(UTC)
    if device_id is not None:
        entry.updated_on_device_id = device_id
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry


async def soft_delete_food_entry(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    entry_id: uuid.UUID,
    device_id: uuid.UUID | None = None,
) -> bool:
    entry = await get_food_entry(session, user_id=user_id, entry_id=entry_id)
    if entry is None:
        return False

    entry.deleted_at = datetime.now(UTC)
    entry.updated_at = datetime.now(UTC)
    session.add(entry)
    await session.commit()
    return True


async def enrich_food_entry_response(
    session: AsyncSession,
    entry: FoodEntry,
) -> dict:
    """Resolve product name and calories for a food entry.

    Returns a dict with resolved_product_name and resolved_calories.
    Works for both private product entries and catalog entries.
    """
    resolved_product_name: str | None = None
    resolved_calories: Decimal | None = None

    if entry.catalog_portion_id is not None:
        # Catalog path: join catalog_portion -> catalog_product
        stmt = (
            select(CatalogPortion, CatalogProduct)
            .join(CatalogProduct, CatalogProduct.id == CatalogPortion.catalog_product_id)
            .where(CatalogPortion.id == entry.catalog_portion_id)
        )
        res = await session.execute(stmt)
        row = res.one_or_none()
        if row is not None:
            portion, product = row
            resolved_product_name = product.display_name
            resolved_calories = portion.calories
    elif entry.product_id is not None and entry.portion_id is not None:
        # Private product path
        stmt = (
            select(Product, ProductPortion)
            .join(ProductPortion, ProductPortion.product_id == Product.id)
            .where(
                Product.id == entry.product_id,
                ProductPortion.id == entry.portion_id,
                Product.deleted_at.is_(None),
                ProductPortion.deleted_at.is_(None),
            )
        )
        res = await session.execute(stmt)
        row = res.one_or_none()
        if row is not None:
            product, portion = row
            resolved_product_name = product.name
            resolved_calories = portion.calories

    return {
        "resolved_product_name": resolved_product_name,
        "resolved_calories": resolved_calories,
    }


async def batch_enrich_food_entries(
    session: AsyncSession,
    entries: list[FoodEntry],
) -> dict[uuid.UUID, dict[str, str | Decimal | None]]:
    """Batch-resolve product names and calories for multiple food entries.

    Runs at most 2 queries (one for catalog portions, one for private portions)
    instead of N per-entry queries.

    Returns a dict keyed by entry.id -> enrichment dict.
    """
    # Collect unique IDs
    catalog_portion_ids: set[uuid.UUID] = set()
    private_pairs: set[tuple[uuid.UUID, uuid.UUID]] = set()
    for entry in entries:
        if entry.catalog_portion_id is not None:
            catalog_portion_ids.add(entry.catalog_portion_id)
        elif entry.product_id is not None and entry.portion_id is not None:
            private_pairs.add((entry.product_id, entry.portion_id))

    # Query catalog portions in batch
    catalog_map: dict[uuid.UUID, tuple[str, Decimal]] = {}
    if catalog_portion_ids:
        stmt = (
            select(CatalogPortion, CatalogProduct)
            .join(CatalogProduct, CatalogProduct.id == CatalogPortion.catalog_product_id)
            .where(CatalogPortion.id.in_(catalog_portion_ids))
        )
        res = await session.execute(stmt)
        for portion, product in res.all():
            catalog_map[portion.id] = (product.display_name, portion.calories)

    # Query private product+portion pairs in batch
    private_map: dict[tuple[uuid.UUID, uuid.UUID], tuple[str, Decimal]] = {}
    if private_pairs:
        stmt = (
            select(Product, ProductPortion)
            .join(ProductPortion, ProductPortion.product_id == Product.id)
            .where(
                tuple_(Product.id, ProductPortion.id).in_(private_pairs),
                Product.deleted_at.is_(None),
                ProductPortion.deleted_at.is_(None),
            )
        )
        res = await session.execute(stmt)
        for product, portion in res.all():
            private_map[(product.id, portion.id)] = (product.name, portion.calories)

    # Build result dict
    result: dict[uuid.UUID, dict[str, str | Decimal | None]] = {}
    for entry in entries:
        resolved_product_name: str | None = None
        resolved_calories: Decimal | None = None

        if entry.catalog_portion_id is not None:
            hit = catalog_map.get(entry.catalog_portion_id)
            if hit is not None:
                resolved_product_name, resolved_calories = hit
        elif entry.product_id is not None and entry.portion_id is not None:
            hit = private_map.get((entry.product_id, entry.portion_id))
            if hit is not None:
                resolved_product_name, resolved_calories = hit

        result[entry.id] = {
            "resolved_product_name": resolved_product_name,
            "resolved_calories": resolved_calories,
        }

    return result
