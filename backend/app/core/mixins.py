from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Sequence, func
from sqlalchemy.orm import Mapped, mapped_column

# Shared sequence across all syncable tables so sync_version is globally ordered.
sync_version_seq = Sequence("sync_version_seq")


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SyncMixin:
    """Adds server_updated_at and sync_version for delta-based sync.

    server_updated_at is a server-authoritative timestamp set on every write.
    sync_version is a monotonically increasing bigint from a shared sequence,
    enabling efficient cross-table delta pagination.
    """

    server_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    sync_version: Mapped[int] = mapped_column(
        BigInteger,
        sync_version_seq,
        nullable=False,
        server_default=sync_version_seq.next_value(),
    )
