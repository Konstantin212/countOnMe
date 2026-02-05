from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product


def _not_deleted(stmt: Select):
    return stmt.where(Product.deleted_at.is_(None))


async def create_product(
    session: AsyncSession, *, device_id: uuid.UUID, name: str, product_id: uuid.UUID | None = None
) -> Product:
    product = Product(id=product_id, device_id=device_id, name=name) if product_id else Product(device_id=device_id, name=name)
    session.add(product)
    await session.commit()
    await session.refresh(product)
    return product


async def list_products(session: AsyncSession, *, device_id: uuid.UUID) -> list[Product]:
    stmt = _not_deleted(select(Product)).where(Product.device_id == device_id).order_by(Product.name.asc())
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def get_product(session: AsyncSession, *, device_id: uuid.UUID, product_id: uuid.UUID) -> Product | None:
    stmt = _not_deleted(select(Product)).where(Product.device_id == device_id, Product.id == product_id)
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def update_product(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    product_id: uuid.UUID,
    name: str | None,
) -> Product | None:
    product = await get_product(session, device_id=device_id, product_id=product_id)
    if product is None:
        return None

    if name is not None:
        product.name = name
    product.updated_at = datetime.now(timezone.utc)
    session.add(product)

    await session.commit()
    await session.refresh(product)
    return product


async def soft_delete_product(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    product_id: uuid.UUID,
) -> bool:
    product = await get_product(session, device_id=device_id, product_id=product_id)
    if product is None:
        return False

    product.deleted_at = datetime.now(timezone.utc)
    product.updated_at = datetime.now(timezone.utc)
    session.add(product)
    await session.commit()
    return True

