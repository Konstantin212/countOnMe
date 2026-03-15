from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.catalog.models import CatalogPortion, CatalogProduct
from app.features.products.models import Product
from app.features.products.schemas import ProductSearchResultItem


def _not_deleted(stmt: Select) -> Select:
    return stmt.where(Product.deleted_at.is_(None))


async def get_product_by_barcode(
    session: AsyncSession, *, device_id: uuid.UUID, barcode: str
) -> Product | None:
    stmt = _not_deleted(select(Product)).where(
        Product.device_id == device_id,
        Product.barcode == barcode,
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def create_product(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    name: str,
    product_id: uuid.UUID | None = None,
    barcode: str | None = None,
) -> Product:
    # Barcode dedup: if barcode provided, check for existing product on this device
    if barcode is not None:
        existing = await get_product_by_barcode(session, device_id=device_id, barcode=barcode)
        if existing is not None:
            return existing

    product = Product(
        device_id=device_id,
        name=name,
        barcode=barcode,
        **({"id": product_id} if product_id else {}),
    )
    session.add(product)
    await session.commit()
    await session.refresh(product)
    return product


async def list_products(session: AsyncSession, *, device_id: uuid.UUID) -> list[Product]:
    stmt = (
        _not_deleted(select(Product))
        .where(Product.device_id == device_id)
        .order_by(Product.name.asc())
    )
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def get_product(
    session: AsyncSession, *, device_id: uuid.UUID, product_id: uuid.UUID
) -> Product | None:
    stmt = _not_deleted(select(Product)).where(
        Product.device_id == device_id, Product.id == product_id
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def update_product(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    product_id: uuid.UUID,
    name: str | None,
    barcode: str | None = None,
) -> Product | None:
    product = await get_product(session, device_id=device_id, product_id=product_id)
    if product is None:
        return None

    if name is not None:
        product.name = name
    if barcode is not None:
        product.barcode = barcode
    product.updated_at = datetime.now(UTC)
    session.add(product)

    await session.commit()
    await session.refresh(product)
    return product


async def check_product_name_available(
    session: AsyncSession, *, device_id: uuid.UUID, name: str
) -> bool:
    stmt = (
        select(func.count())
        .select_from(Product)
        .where(
            Product.device_id == device_id,
            func.lower(Product.name) == func.lower(name),
            Product.deleted_at.is_(None),
        )
    )
    result = await session.execute(stmt)
    count = result.scalar_one()
    return count == 0


def _compute_calories_per_100g(calories: Decimal, base_amount: Decimal) -> float | None:
    if base_amount == 0:
        return None
    return round(float(calories) / float(base_amount) * 100, 2)


def _compute_macro_per_100g(macro: Decimal | None, base_amount: Decimal) -> float | None:
    if macro is None or base_amount == 0:
        return None
    return round(float(macro) / float(base_amount) * 100, 2)


def _relevance_rank(name: str, query: str) -> int:
    """Return 0 for starts-with match, 1 for contains match."""
    return 0 if name.lower().startswith(query.lower()) else 1


async def search_products(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    q: str,
    limit: int = 35,
) -> list[ProductSearchResultItem]:
    escaped_q = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    # Query 1: user products — fetch up to limit candidates from each source
    user_stmt = (
        _not_deleted(select(Product))
        .where(Product.device_id == device_id, Product.name.ilike(f"%{escaped_q}%"))
        .order_by(Product.name.asc())
        .limit(limit)
    )
    user_res = await session.execute(user_stmt)
    user_products = list(user_res.scalars().all())

    user_results = [
        ProductSearchResultItem(
            id=p.id,
            name=p.name,
            source="user",
            calories_per_100g=None,
            catalog_id=None,
        )
        for p in user_products
    ]

    # Query 2: catalog products with optional default portion
    catalog_stmt = (
        select(CatalogProduct)
        .where(
            or_(
                CatalogProduct.display_name.ilike(f"%{escaped_q}%"),
                CatalogProduct.brand.ilike(f"%{escaped_q}%"),
            )
        )
        .order_by(CatalogProduct.display_name.asc())
        .limit(limit)
    )
    catalog_res = await session.execute(catalog_stmt)
    catalog_products = list(catalog_res.scalars().all())

    catalog_results = []
    for cp in catalog_products:
        default_portion: CatalogPortion | None = next(
            (port for port in cp.portions if port.is_default), None
        )
        calories_per_100g: float | None = None
        protein_per_100g: float | None = None
        carbs_per_100g: float | None = None
        fat_per_100g: float | None = None
        if default_portion is not None and default_portion.base_amount:
            calories_per_100g = _compute_calories_per_100g(
                default_portion.calories, default_portion.base_amount
            )
            protein_per_100g = _compute_macro_per_100g(default_portion.protein, default_portion.base_amount)
            carbs_per_100g = _compute_macro_per_100g(default_portion.carbs, default_portion.base_amount)
            fat_per_100g = _compute_macro_per_100g(default_portion.fat, default_portion.base_amount)
        catalog_results.append(
            ProductSearchResultItem(
                id=cp.id,
                name=cp.name,
                source="catalog",
                calories_per_100g=calories_per_100g,
                protein_per_100g=protein_per_100g,
                carbs_per_100g=carbs_per_100g,
                fat_per_100g=fat_per_100g,
                catalog_id=cp.id,
                display_name=cp.display_name,
                brand=cp.brand,
            )
        )

    # Merge and sort by (relevance_rank, name.lower()), then truncate to limit
    def _sort_key(item: ProductSearchResultItem) -> tuple[int, str]:
        search_name = item.display_name or item.name
        return (_relevance_rank(search_name, q), search_name.lower())

    merged = user_results + catalog_results
    merged.sort(key=_sort_key)
    return merged[:limit]


async def soft_delete_product(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    product_id: uuid.UUID,
) -> bool:
    product = await get_product(session, device_id=device_id, product_id=product_id)
    if product is None:
        return False

    product.deleted_at = datetime.now(UTC)
    product.updated_at = datetime.now(UTC)
    session.add(product)
    await session.commit()
    return True
