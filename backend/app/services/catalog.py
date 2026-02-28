from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.catalog_portion import CatalogPortion
from app.models.catalog_product import CatalogProduct


def get_default_portion(product: CatalogProduct) -> CatalogPortion | None:
    """Return the default portion for a catalog product, or None."""
    return next((p for p in product.portions if p.is_default), None)


async def list_catalog_products(
    session: AsyncSession,
    *,
    search: str | None,
    limit: int,
    offset: int,
) -> list[CatalogProduct]:
    """Return catalog products, optionally filtered by name substring.

    Results are ordered by name ascending. No device scoping — catalog is global.
    """
    stmt = select(CatalogProduct).options(selectinload(CatalogProduct.portions))
    if search:
        stmt = stmt.where(CatalogProduct.name.ilike(f"%{search}%"))
    stmt = stmt.order_by(CatalogProduct.name.asc()).limit(limit).offset(offset)

    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_catalog_product(
    session: AsyncSession,
    *,
    catalog_product_id: uuid.UUID,
) -> CatalogProduct | None:
    """Return a single catalog product with all portions, or None if not found."""
    stmt = (
        select(CatalogProduct)
        .options(selectinload(CatalogProduct.portions))
        .where(CatalogProduct.id == catalog_product_id)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


