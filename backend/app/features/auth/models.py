from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.mixins import TimestampMixin


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )

    # Hash of the *secret part* of a device token (we never store the raw token).
    token_hash: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )

    # Supabase auth.users.id — NOT a direct FK (Supabase manages that schema).
    supabase_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
    )

    email: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_admin: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    # Relationships
    user_devices: Mapped[list[UserDevice]] = relationship(
        "UserDevice",
        back_populates="user",
    )


class UserDevice(Base):
    __tablename__ = "user_devices"

    __table_args__ = (
        UniqueConstraint("user_id", "device_id", name="uq_user_devices_user_device"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    device_name: Mapped[str | None] = mapped_column(Text, nullable=True)

    linked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="user_devices")
    device: Mapped[Device] = relationship("Device")
