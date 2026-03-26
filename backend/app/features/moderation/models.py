from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.enums import ReportReason


class ContentReport(Base):
    """A user-submitted report against a shared food item."""

    __tablename__ = "content_reports"
    __table_args__ = (
        UniqueConstraint(
            "reporter_user_id",
            "target_shared_food_id",
            name="uq_report_per_user_per_target",
        ),
        Index("ix_content_reports_reporter", "reporter_user_id"),
        Index("ix_content_reports_target", "target_shared_food_id"),
        Index("ix_content_reports_resolved_at", "resolved_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )

    reporter_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    target_shared_food_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("shared_foods.id", ondelete="CASCADE"),
        nullable=False,
    )

    reason: Mapped[ReportReason] = mapped_column(
        Enum(ReportReason, name="report_reason_enum", create_type=False),
        nullable=False,
    )

    detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    resolved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)


class UserBlock(Base):
    """A directional block from one user to another."""

    __tablename__ = "user_blocks"
    __table_args__ = (
        UniqueConstraint(
            "blocker_user_id",
            "blocked_user_id",
            name="uq_block_pair",
        ),
        CheckConstraint(
            "blocker_user_id != blocked_user_id",
            name="ck_no_self_block",
        ),
        Index("ix_user_blocks_blocker", "blocker_user_id"),
        Index("ix_user_blocks_blocked", "blocked_user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )

    blocker_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    blocked_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
