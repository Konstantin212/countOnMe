"""User-based ownership filter for data queries.

All data is scoped by ``user_id``.  The legacy ``device_id`` ownership path
has been removed.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ColumnElement


def get_owner_filter(
    model: type,
    *,
    user_id: uuid.UUID,
) -> ColumnElement[bool]:
    """Return a SQLAlchemy filter clause scoping rows to the given user."""
    return model.user_id == user_id
