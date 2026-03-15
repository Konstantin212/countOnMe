from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    Computed,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.enums import Unit


class CatalogProduct(Base):
    """Global (device-independent) product catalog sourced from multiple data sources."""

    __tablename__ = "catalog_products"
    __table_args__ = (
        UniqueConstraint("source", "source_id", name="uq_catalog_products_source_source_id"),
        Index("ix_catalog_products_barcode", "barcode"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )

    source: Mapped[str] = mapped_column(Text, nullable=False)
    source_id: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    brand: Mapped[str | None] = mapped_column(Text, nullable=True)
    barcode: Mapped[str | None] = mapped_column(Text, nullable=True)

    name: Mapped[str] = mapped_column(Text, nullable=False, index=True)

    category: Mapped[str | None] = mapped_column(Text, nullable=True)

    search_vector: Mapped[Any] = mapped_column(  # PostgreSQL tsvector type
        TSVECTOR,
        Computed(
            "to_tsvector('english', coalesce(display_name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(category, ''))",
        ),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        "created_at",
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updated_at",
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    portions: Mapped[list[CatalogPortion]] = relationship(
        "CatalogPortion",
        back_populates="product",
        lazy="selectin",
    )


class CatalogPortion(Base):
    """A serving/portion definition for a catalog product."""

    __tablename__ = "catalog_portions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )

    catalog_product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("catalog_products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    label: Mapped[str] = mapped_column(Text, nullable=False)

    base_amount: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    base_unit: Mapped[Unit] = mapped_column(
        Enum(Unit, name="unit_enum", create_type=False),
        nullable=False,
    )

    # Gram weight for unit conversion (nullable for dimensionless units)
    gram_weight: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)

    calories: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    protein: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    carbs: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    fat: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)

    is_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    created_at: Mapped[datetime] = mapped_column(
        "created_at",
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updated_at",
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    product: Mapped[CatalogProduct] = relationship(
        "CatalogProduct",
        back_populates="portions",
    )
