from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.catalog_portion import CatalogPortion


class CatalogProduct(Base):
    """Global (device-independent) product catalog sourced from USDA FDC."""

    __tablename__ = "catalog_products"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )

    fdc_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True, index=True)

    name: Mapped[str] = mapped_column(Text, nullable=False, index=True)

    category: Mapped[str | None] = mapped_column(Text, nullable=True)

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
