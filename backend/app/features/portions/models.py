from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import Boolean, Enum, ForeignKey, Index, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.enums import Unit
from app.core.mixins import TimestampMixin


class ProductPortion(Base, TimestampMixin):
    __tablename__ = "product_portions"

    __table_args__ = (
        Index("ix_product_portions_user_id_deleted_at", "user_id", "deleted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )

    device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_on_device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    updated_on_device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    label: Mapped[str] = mapped_column(Text, nullable=False)

    base_amount: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    base_unit: Mapped[Unit] = mapped_column(
        Enum(Unit, name="unit_enum", create_type=False),
        nullable=False,
    )

    calories: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    protein: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    carbs: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    fat: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)

    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
