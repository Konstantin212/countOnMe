"""Dual-mode ownership filter for device-scoped queries.

During migration from device-only to user-based ownership, queries can
filter by either ``user_id`` (when authenticated via Supabase JWT) or
``device_id`` (legacy device token).  This module provides a single
helper that picks the right filter.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ColumnElement


def get_owner_filter(
    model: type,
    *,
    user_id: uuid.UUID | None = None,
    device_id: uuid.UUID,
) -> ColumnElement[bool]:
    """Return a SQLAlchemy filter clause for the appropriate owner scope.

    If *user_id* is provided, filter by ``model.user_id == user_id``.
    Otherwise fall back to ``model.device_id == device_id`` (legacy path).
    """
    if user_id is not None:
        return model.user_id == user_id
    return model.device_id == device_id
