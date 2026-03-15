from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.features.catalog.models import CatalogPortion, CatalogProduct


def _escape_like(value: str) -> str:
    """Escape LIKE special characters (%, _, \\) so they match literally."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


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
    """Return catalog products, optionally filtered by search query.

    Search strategy:
    - len(search) >= 3: combined tsvector + ILIKE query (tsvector matches rank higher)
    - len(search) < 3: use ILIKE on display_name directly
    - No search: order by display_name ascending

    No device scoping — catalog is global.
    """
    stmt = select(CatalogProduct).options(selectinload(CatalogProduct.portions))

    if search:
        search = search.strip()

    if search:
        escaped = _escape_like(search)

        if len(search) >= 3:
            # Combined tsvector + ILIKE: tsvector matches rank higher,
            # ILIKE catches terms that don't stem well.
            ts_query = func.plainto_tsquery("english", search)
            stmt = stmt.where(
                or_(
                    CatalogProduct.search_vector.op("@@")(ts_query),
                    CatalogProduct.display_name.ilike(f"%{escaped}%"),
                )
            ).order_by(
                func.ts_rank(CatalogProduct.search_vector, ts_query).desc(),
            )
        else:
            # Short query: ILIKE on display_name directly
            stmt = stmt.where(CatalogProduct.display_name.ilike(f"%{escaped}%"))

    if not search or len(search) < 3:
        stmt = stmt.order_by(CatalogProduct.display_name.asc())

    stmt = stmt.limit(limit).offset(offset)

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
