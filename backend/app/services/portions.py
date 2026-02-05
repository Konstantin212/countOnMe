from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Select, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product_portion import ProductPortion
from app.services.products import get_product


def _not_deleted(stmt: Select):
    return stmt.where(ProductPortion.deleted_at.is_(None))


async def list_portions(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    product_id: uuid.UUID,
) -> list[ProductPortion]:
    stmt = (
        _not_deleted(select(ProductPortion))
        .where(ProductPortion.device_id == device_id, ProductPortion.product_id == product_id)
        .order_by(ProductPortion.is_default.desc(), ProductPortion.label.asc())
    )
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def get_portion(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    portion_id: uuid.UUID,
) -> ProductPortion | None:
    stmt = _not_deleted(select(ProductPortion)).where(
        ProductPortion.device_id == device_id,
        ProductPortion.id == portion_id,
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def create_portion(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    product_id: uuid.UUID,
    label: str,
    base_amount,
    base_unit,
    calories,
    protein,
    carbs,
    fat,
    is_default: bool,
) -> ProductPortion | None:
    product = await get_product(session, device_id=device_id, product_id=product_id)
    if product is None:
        return None

    existing = await list_portions(session, device_id=device_id, product_id=product_id)
    should_be_default = True if len(existing) == 0 else is_default

    portion = ProductPortion(
        device_id=device_id,
        product_id=product_id,
        label=label,
        base_amount=base_amount,
        base_unit=base_unit,
        calories=calories,
        protein=protein,
        carbs=carbs,
        fat=fat,
        is_default=should_be_default,
    )
    session.add(portion)
    await session.flush()

    if portion.is_default:
        await session.execute(
            update(ProductPortion)
            .where(
                ProductPortion.product_id == product_id,
                ProductPortion.device_id == device_id,
                ProductPortion.id != portion.id,
                ProductPortion.deleted_at.is_(None),
            )
            .values(is_default=False, updated_at=datetime.now(timezone.utc))
        )

    await session.commit()
    await session.refresh(portion)
    return portion


class PortionConflict(Exception):
    pass


async def update_portion(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    portion_id: uuid.UUID,
    patch: dict,
) -> ProductPortion | None:
    portion = await get_portion(session, device_id=device_id, portion_id=portion_id)
    if portion is None:
        return None

    if patch.get("is_default") is False and portion.is_default:
        # Must keep exactly one default. Require caller to choose another default first.
        raise PortionConflict("Cannot unset default portion without selecting another default.")

    for k, v in patch.items():
        setattr(portion, k, v)
    portion.updated_at = datetime.now(timezone.utc)
    session.add(portion)
    await session.flush()

    if patch.get("is_default") is True:
        await session.execute(
            update(ProductPortion)
            .where(
                ProductPortion.product_id == portion.product_id,
                ProductPortion.device_id == device_id,
                ProductPortion.id != portion.id,
                ProductPortion.deleted_at.is_(None),
            )
            .values(is_default=False, updated_at=datetime.now(timezone.utc))
        )

    await session.commit()
    await session.refresh(portion)
    return portion


async def soft_delete_portion(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    portion_id: uuid.UUID,
) -> bool:
    portion = await get_portion(session, device_id=device_id, portion_id=portion_id)
    if portion is None:
        return False

    if portion.is_default:
        stmt = (
            _not_deleted(select(ProductPortion))
            .where(
                ProductPortion.device_id == device_id,
                ProductPortion.product_id == portion.product_id,
                ProductPortion.id != portion.id,
            )
            .order_by(ProductPortion.created_at.asc())
            .limit(1)
        )
        res = await session.execute(stmt)
        replacement = res.scalar_one_or_none()
        if replacement is None:
            raise PortionConflict("Cannot delete the only default portion.")
        replacement.is_default = True
        replacement.updated_at = datetime.now(timezone.utc)
        session.add(replacement)

    portion.deleted_at = datetime.now(timezone.utc)
    portion.updated_at = datetime.now(timezone.utc)
    portion.is_default = False
    session.add(portion)
    await session.commit()

    return True

