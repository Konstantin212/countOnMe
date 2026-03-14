from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_device_id
from app.features.products.schemas import (
    ProductCreateRequest,
    ProductNameCheckResponse,
    ProductResponse,
    ProductSearchResultItem,
    ProductUpdateRequest,
)
from app.features.products.service import (
    check_product_name_available,
    create_product,
    get_product,
    list_products,
    search_products,
    soft_delete_product,
    update_product,
)

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductResponse])
async def products_list(
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> list[ProductResponse]:
    return await list_products(session, device_id=device_id)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def products_create(
    body: ProductCreateRequest,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> ProductResponse:
    return await create_product(session, device_id=device_id, name=body.name, product_id=body.id)


@router.get("/check-name", response_model=ProductNameCheckResponse)
async def products_check_name(
    name: str = Query(min_length=1, max_length=200),
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> ProductNameCheckResponse:
    available = await check_product_name_available(session, device_id=device_id, name=name)
    return ProductNameCheckResponse(available=available)


@router.get("/search", response_model=list[ProductSearchResultItem])
async def products_search(
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(default=35, ge=1, le=60),
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> list[ProductSearchResultItem]:
    return await search_products(session, device_id=device_id, q=q, limit=limit)


@router.get("/{product_id}", response_model=ProductResponse)
async def products_get(
    product_id: uuid.UUID,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> ProductResponse:
    product = await get_product(session, device_id=device_id, product_id=product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return product


@router.patch("/{product_id}", response_model=ProductResponse)
async def products_update(
    product_id: uuid.UUID,
    body: ProductUpdateRequest,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> ProductResponse:
    product = await update_product(
        session, device_id=device_id, product_id=product_id, name=body.name
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def products_delete(
    product_id: uuid.UUID,
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> None:
    ok = await soft_delete_product(session, device_id=device_id, product_id=product_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
