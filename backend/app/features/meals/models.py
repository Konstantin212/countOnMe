from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Enum, ForeignKey, Index, Numeric, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.enums import MealType, Unit
from app.core.mixins import TimestampMixin


class FoodEntry(Base, TimestampMixin):
    __tablename__ = "food_entries"

    __table_args__ = (
        Index("ix_food_entries_user_id_deleted_at", "user_id", "deleted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )

    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
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

    portion_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_portions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    meal_type: Mapped[MealType] = mapped_column(
        Enum(MealType, name="meal_type_enum", create_type=False),
        nullable=False,
        index=True,
    )

    amount: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit: Mapped[Unit] = mapped_column(
        Enum(Unit, name="unit_enum", create_type=False),
        nullable=False,
    )
