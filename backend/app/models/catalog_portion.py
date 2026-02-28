from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.schemas.enums import Unit

if TYPE_CHECKING:
    from app.models.catalog_product import CatalogProduct


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
