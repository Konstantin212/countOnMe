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
    func,
)
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.enums import ModerationStatus, Unit, Visibility
from app.core.mixins import TimestampMixin


class SharedFood(Base, TimestampMixin):
    """A community-shared food item with owner, visibility, and moderation."""

    __tablename__ = "shared_foods"
    __table_args__ = (
        Index("ix_shared_foods_owner_user_id", "owner_user_id"),
        Index("ix_shared_foods_visibility_moderation", "visibility", "moderation_status"),
        Index("ix_shared_foods_search_vector", "search_vector", postgresql_using="gin"),
        Index("ix_shared_foods_barcode", "barcode"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )

    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    brand: Mapped[str | None] = mapped_column(Text, nullable=True)
    barcode: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)

    visibility: Mapped[Visibility] = mapped_column(
        Enum(Visibility, name="visibility_enum", create_type=False),
        nullable=False,
        server_default=Visibility.private.value,
    )

    moderation_status: Mapped[ModerationStatus] = mapped_column(
        Enum(ModerationStatus, name="moderation_status_enum", create_type=False),
        nullable=False,
        server_default=ModerationStatus.pending.value,
    )

    search_vector: Mapped[Any] = mapped_column(
        TSVECTOR,
        Computed(
            "to_tsvector('english', coalesce(display_name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(category, ''))",
        ),
        nullable=True,
    )

    portions: Mapped[list[SharedFoodPortion]] = relationship(
        "SharedFoodPortion",
        back_populates="shared_food",
        lazy="selectin",
    )


class SharedFoodPortion(Base):
    """A serving/portion definition for a shared food item."""

    __tablename__ = "shared_food_portions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )

    shared_food_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("shared_foods.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    label: Mapped[str] = mapped_column(Text, nullable=False)

    base_amount: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    base_unit: Mapped[Unit] = mapped_column(
        Enum(Unit, name="unit_enum", create_type=False),
        nullable=False,
    )

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

    shared_food: Mapped[SharedFood] = relationship(
        "SharedFood",
        back_populates="portions",
    )
