from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_device_id
from app.db.session import get_session
from app.schemas.catalog import (
    CatalogPortionResponse,
    CatalogProductListItem,
    CatalogProductResponse,
)
from app.services.catalog import get_catalog_product, get_default_portion, list_catalog_products

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/products", response_model=list[CatalogProductListItem])
async def catalog_products_list(
    search: str | None = Query(default=None, max_length=200, description="Filter by name substring"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> list[CatalogProductListItem]:
    products = await list_catalog_products(
        session, search=search, limit=limit, offset=offset
    )
    return [
        CatalogProductListItem(
            id=p.id,
            fdc_id=p.fdc_id,
            name=p.name,
            category=p.category,
            default_portion=CatalogPortionResponse.model_validate(dp) if (dp := get_default_portion(p)) else None,
        )
        for p in products
    ]


@router.get("/products/{catalog_product_id}", response_model=CatalogProductResponse)
async def catalog_products_get(
    catalog_product_id: uuid.UUID,
    _device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> CatalogProductResponse:
    product = await get_catalog_product(session, catalog_product_id=catalog_product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    dp = get_default_portion(product)
    return CatalogProductResponse(
        id=product.id,
        fdc_id=product.fdc_id,
        name=product.name,
        category=product.category,
        default_portion=CatalogPortionResponse.model_validate(dp) if dp else None,
        portions=[CatalogPortionResponse.model_validate(p) for p in product.portions],
    )
