from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Index, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.mixins import SyncMixin, TimestampMixin


class WaterLog(Base, TimestampMixin, SyncMixin):
    __tablename__ = "water_logs"

    __table_args__ = (
        Index("ix_water_logs_user_id_deleted_at", "user_id", "deleted_at"),
        Index("ix_water_logs_user_id_day", "user_id", "day"),
        Index("ix_water_logs_user_id_server_updated_at", "user_id", "server_updated_at"),
        Index("ix_water_logs_sync_version", "sync_version"),
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

    device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    created_on_device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    updated_on_device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    day: Mapped[date] = mapped_column(Date, nullable=False)
    amount_ml: Mapped[int] = mapped_column(Integer, nullable=False)
