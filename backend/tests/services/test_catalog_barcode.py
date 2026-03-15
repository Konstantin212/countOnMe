"""Tests for catalog barcode lookup service function."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.catalog.service import get_catalog_product_by_barcode
from tests.factories import create_catalog_portion, create_catalog_product


def _unique_barcode() -> str:
    """Return a unique barcode string for test isolation."""
    return f"BC-{uuid.uuid4().hex[:12]}"


@pytest.mark.asyncio
async def test_get_by_barcode_found(db_session: AsyncSession) -> None:
    """Looks up a catalog product by barcode and returns it."""
    barcode = _unique_barcode()
    product = await create_catalog_product(
        db_session,
        name=f"BarcodeProduct-{barcode}",
        barcode=barcode,
    )
    await db_session.commit()

    result = await get_catalog_product_by_barcode(db_session, barcode=barcode)

    assert result is not None
    assert result.id == product.id
    assert result.barcode == barcode


@pytest.mark.asyncio
async def test_get_by_barcode_not_found(db_session: AsyncSession) -> None:
    """Returns None for a barcode that does not exist in the catalog."""
    result = await get_catalog_product_by_barcode(
        db_session, barcode="NONEXISTENT-999999"
    )

    assert result is None


@pytest.mark.asyncio
async def test_get_by_barcode_null_barcode_products_ignored(
    db_session: AsyncSession,
) -> None:
    """Products with NULL barcode are never matched, even when searching empty string."""
    marker = uuid.uuid4().hex[:8]
    await create_catalog_product(
        db_session,
        name=f"NullBarcode-{marker}",
        barcode=None,
    )
    await db_session.commit()

    # Searching for empty string should not match NULL barcode products
    result = await get_catalog_product_by_barcode(db_session, barcode="")

    assert result is None


@pytest.mark.asyncio
async def test_get_by_barcode_returns_with_portions(
    db_session: AsyncSession,
) -> None:
    """Verify that portions are eager-loaded on the returned product."""
    barcode = _unique_barcode()
    product = await create_catalog_product(
        db_session,
        name=f"PortionCheck-{barcode}",
        barcode=barcode,
    )
    portion = await create_catalog_portion(
        db_session,
        catalog_product_id=product.id,
        label="100 g",
        calories=150,
        is_default=True,
    )
    await db_session.commit()

    result = await get_catalog_product_by_barcode(db_session, barcode=barcode)

    assert result is not None
    assert len(result.portions) == 1
    assert result.portions[0].id == portion.id
    assert result.portions[0].label == "100 g"
