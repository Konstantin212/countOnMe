---
name: backend-patterns
description: Backend architecture patterns, API design, database optimization, and server-side best practices for Python, FastAPI, and SQLAlchemy.
---

# Backend Development Patterns

Backend architecture patterns and best practices for CountOnMe's FastAPI backend.

## Tech Stack

- **Framework**: FastAPI 0.115 + Uvicorn
- **ORM**: SQLAlchemy 2.0 (async)
- **Database**: PostgreSQL (via Docker Compose locally)
- **Migrations**: Alembic
- **Auth**: Anonymous device authentication (bcrypt token hashing)
- **Config**: Pydantic Settings
- **Testing**: pytest + pytest-asyncio
- **Linting**: Ruff

## API Design Patterns

### RESTful API Structure

```python
# ✅ Resource-based URLs
# GET    /v1/products              # List resources
# GET    /v1/products/{id}         # Get single resource
# POST   /v1/products              # Create resource
# PUT    /v1/products/{id}         # Update resource
# DELETE /v1/products/{id}         # Soft delete resource

# Query parameters for filtering, pagination
# GET /v1/products?limit=20&offset=0
# GET /v1/food-entries?date=2025-02-05
```

### Router Pattern (FastAPI)

```python
# backend/app/api/routers/products.py
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, get_current_device_id
from app.schemas.product import ProductCreate, ProductUpdate, ProductRead
from app.services.products import ProductService

router = APIRouter(prefix="/v1/products", tags=["products"])


@router.get("", response_model=list[ProductRead])
async def list_products(
    device_id: UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
    limit: int = 50,
    offset: int = 0,
):
    """List all products for the current device."""
    service = ProductService(session)
    return await service.list(device_id, limit=limit, offset=offset)


@router.get("/{product_id}", response_model=ProductRead)
async def get_product(
    product_id: UUID,
    device_id: UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
):
    """Get a single product by ID."""
    service = ProductService(session)
    product = await service.get(device_id, product_id)
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return product


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    device_id: UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
):
    """Create a new product."""
    service = ProductService(session)
    return await service.create(device_id, data)


@router.put("/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: UUID,
    data: ProductUpdate,
    device_id: UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
):
    """Update an existing product."""
    service = ProductService(session)
    product = await service.update(device_id, product_id, data)
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    device_id: UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
):
    """Soft delete a product."""
    service = ProductService(session)
    success = await service.delete(device_id, product_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Product not found")
```

### Service Layer Pattern

```python
# backend/app/services/products.py
from uuid import UUID
from datetime import datetime, UTC
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate


class ProductService:
    """Business logic for product operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def list(
        self,
        device_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> list[Product]:
        """List products for a device (excludes soft-deleted)."""
        stmt = (
            select(Product)
            .where(
                Product.device_id == device_id,
                Product.deleted_at.is_(None)
            )
            .order_by(Product.name)
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
    
    async def get(self, device_id: UUID, product_id: UUID) -> Product | None:
        """Get a single product (device-scoped)."""
        stmt = select(Product).where(
            Product.id == product_id,
            Product.device_id == device_id,
            Product.deleted_at.is_(None)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def create(self, device_id: UUID, data: ProductCreate) -> Product:
        """Create a new product for a device."""
        product = Product(
            device_id=device_id,
            **data.model_dump()
        )
        self.session.add(product)
        await self.session.commit()
        await self.session.refresh(product)
        return product
    
    async def update(
        self,
        device_id: UUID,
        product_id: UUID,
        data: ProductUpdate
    ) -> Product | None:
        """Update an existing product."""
        product = await self.get(device_id, product_id)
        
        if not product:
            return None
        
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(product, key, value)
        
        product.updated_at = datetime.now(UTC)
        await self.session.commit()
        await self.session.refresh(product)
        return product
    
    async def delete(self, device_id: UUID, product_id: UUID) -> bool:
        """Soft delete a product."""
        product = await self.get(device_id, product_id)
        
        if not product:
            return False
        
        product.deleted_at = datetime.now(UTC)
        await self.session.commit()
        return True
```

### Dependency Injection Pattern

```python
# backend/app/api/deps.py
from uuid import UUID
from typing import AsyncGenerator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.services.auth import AuthService

security = HTTPBearer()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session for request."""
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_current_device_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> UUID:
    """Extract and verify device ID from bearer token."""
    token = credentials.credentials
    
    auth_service = AuthService(session)
    device = await auth_service.verify_token(token)
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    return device.id
```

## Database Patterns

### SQLAlchemy Model Pattern

```python
# backend/app/models/product.py
from uuid import UUID, uuid4
from datetime import datetime, UTC
from sqlalchemy import String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Product(Base):
    """Product model with calorie information."""
    
    __tablename__ = "products"
    
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4
    )
    device_id: Mapped[UUID] = mapped_column(
        ForeignKey("devices.id"),
        index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    kcal_100g: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    
    # Relationships
    portions: Mapped[list["Portion"]] = relationship(
        back_populates="product",
        lazy="selectin"
    )
```

### Soft Delete Pattern

```python
# backend/app/models/base.py
from datetime import datetime
from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base model with soft delete support."""
    pass


class SoftDeleteMixin:
    """Mixin for soft delete functionality."""
    
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None
    )
    
    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


# Always filter by deleted_at in queries
# ✅ CORRECT: Include soft delete filter
stmt = select(Product).where(
    Product.device_id == device_id,
    Product.deleted_at.is_(None)  # CRITICAL
)

# ❌ WRONG: Missing soft delete filter
stmt = select(Product).where(Product.device_id == device_id)
```

### Device Scoping Pattern (CRITICAL)

```python
# EVERY query MUST filter by device_id to prevent data leaks

# ✅ CORRECT: Device-scoped query
async def get_products(device_id: UUID, session: AsyncSession) -> list[Product]:
    stmt = select(Product).where(
        Product.device_id == device_id,
        Product.deleted_at.is_(None)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


# ❌ WRONG: Missing device scope (SECURITY VULNERABILITY)
async def get_products(session: AsyncSession) -> list[Product]:
    stmt = select(Product)  # DANGER: Returns all devices' products!
    result = await session.execute(stmt)
    return list(result.scalars().all())
```

### N+1 Query Prevention

```python
# ❌ BAD: N+1 query problem
async def get_products_with_portions(device_id: UUID, session: AsyncSession):
    stmt = select(Product).where(Product.device_id == device_id)
    result = await session.execute(stmt)
    products = result.scalars().all()
    
    for product in products:
        # This triggers N additional queries!
        portions = await get_portions(product.id)

# ✅ GOOD: Eager loading with selectinload
from sqlalchemy.orm import selectinload

async def get_products_with_portions(device_id: UUID, session: AsyncSession):
    stmt = (
        select(Product)
        .where(
            Product.device_id == device_id,
            Product.deleted_at.is_(None)
        )
        .options(selectinload(Product.portions))  # Loads portions in one query
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
```

### Transaction Pattern

```python
async def create_product_with_default_portion(
    device_id: UUID,
    product_data: ProductCreate,
    session: AsyncSession
) -> Product:
    """Create product and default portion in single transaction."""
    try:
        # Create product
        product = Product(device_id=device_id, **product_data.model_dump())
        session.add(product)
        await session.flush()  # Get product.id without committing
        
        # Create default portion
        default_portion = Portion(
            product_id=product.id,
            name="100g",
            grams=100,
            is_default=True
        )
        session.add(default_portion)
        
        # Commit both
        await session.commit()
        await session.refresh(product)
        return product
        
    except Exception:
        await session.rollback()
        raise
```

## Pydantic Schema Patterns

### Request/Response Schemas

```python
# backend/app/schemas/product.py
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class ProductCreate(BaseModel):
    """Schema for creating a product."""
    
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Product name"
    )
    kcal_100g: int = Field(
        ...,
        ge=0,
        le=1000,
        description="Calories per 100 grams"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Chicken Breast",
                "kcal_100g": 165
            }
        }
    )


class ProductUpdate(BaseModel):
    """Schema for updating a product."""
    
    name: str | None = Field(None, min_length=1, max_length=100)
    kcal_100g: int | None = Field(None, ge=0, le=1000)


class ProductRead(BaseModel):
    """Schema for reading a product."""
    
    id: UUID
    name: str
    kcal_100g: int
    created_at: datetime
    updated_at: datetime | None
    
    model_config = ConfigDict(from_attributes=True)
```

## Authentication Patterns

### Anonymous Device Auth

```python
# backend/app/services/auth.py
from uuid import UUID, uuid4
import secrets
from passlib.hash import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device


class AuthService:
    """Authentication service for anonymous device auth."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def register_device(self, device_id: UUID) -> str:
        """Register a new device and return bearer token."""
        # Generate secure token
        token = secrets.token_urlsafe(32)
        token_hash = bcrypt.hash(token)
        
        # Create device
        device = Device(
            id=device_id,
            token_hash=token_hash
        )
        self.session.add(device)
        await self.session.commit()
        
        return token
    
    async def verify_token(self, token: str) -> Device | None:
        """Verify bearer token and return device if valid."""
        # Get all devices (not ideal, but tokens aren't indexed)
        stmt = select(Device).where(Device.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        devices = result.scalars().all()
        
        # Check each device's token hash
        for device in devices:
            if bcrypt.verify(token, device.token_hash):
                return device
        
        return None
```

### Auth Router

```python
# backend/app/api/routers/auth.py
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.schemas.auth import RegisterRequest, RegisterResponse
from app.services.auth import AuthService

router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse)
async def register_device(
    data: RegisterRequest,
    session: AsyncSession = Depends(get_session),
):
    """Register a device and receive a bearer token."""
    auth_service = AuthService(session)
    
    try:
        token = await auth_service.register_device(data.device_id)
        return RegisterResponse(token=token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Device already registered"
        )
```

## Error Handling Patterns

### Exception Handlers

```python
# backend/app/main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

app = FastAPI(title="CountOnMe API", version="1.0.0")


@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation error",
            "errors": exc.errors()
        }
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    # Log the error (don't expose details to client)
    import logging
    logging.error(f"Unhandled error: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
```

## Configuration Pattern

```python
# backend/app/settings.py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings from environment variables."""
    
    # Database
    database_url: str
    
    # Server
    debug: bool = False
    
    # CORS (for mobile client)
    cors_origins: list[str] = ["*"]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8"
    )


settings = Settings()
```

## Alembic Migration Pattern

```python
# alembic/versions/001_create_devices.py
"""Create devices table

Revision ID: 001
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None


def upgrade() -> None:
    op.create_table(
        'devices',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('token_hash', sa.String(128), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('devices')
```

## Testing Patterns

### Service Tests

```python
# backend/tests/test_product_service.py
import pytest
from uuid import uuid4
from app.services.products import ProductService
from app.schemas.product import ProductCreate


@pytest.mark.asyncio
async def test_create_product(session, device):
    """Should create a product for device."""
    service = ProductService(session)
    data = ProductCreate(name="Chicken", kcal_100g=165)
    
    product = await service.create(device.id, data)
    
    assert product.name == "Chicken"
    assert product.kcal_100g == 165
    assert product.device_id == device.id


@pytest.mark.asyncio
async def test_list_excludes_deleted(session, device):
    """Should not return soft-deleted products."""
    service = ProductService(session)
    
    # Create and delete a product
    product = await service.create(
        device.id,
        ProductCreate(name="Deleted", kcal_100g=100)
    )
    await service.delete(device.id, product.id)
    
    # List should be empty
    products = await service.list(device.id)
    assert len(products) == 0


@pytest.mark.asyncio
async def test_get_returns_none_for_other_device(session, device):
    """Should return None for products from other devices."""
    service = ProductService(session)
    other_device_id = uuid4()
    
    # Create product for other device
    product = await service.create(
        other_device_id,
        ProductCreate(name="Other", kcal_100g=100)
    )
    
    # Try to get from our device
    result = await service.get(device.id, product.id)
    assert result is None
```

**Remember**: Backend patterns enable scalable, maintainable server-side applications. Always enforce device scoping and soft deletes.
