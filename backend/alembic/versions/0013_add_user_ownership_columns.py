"""Add user_id, created_on_device_id, updated_on_device_id to data tables.

Revision ID: 0013_add_user_ownership_columns
Revises: 0012_users_and_user_devices
Create Date: 2026-03-26
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0013_add_user_ownership_columns"
down_revision = "0012_users_and_user_devices"
branch_labels = None
depends_on = None

# Tables that receive the three new columns
_TABLES = ["products", "product_portions", "food_entries", "user_goals", "body_weights"]


def upgrade() -> None:
    for table in _TABLES:
        # -- user_id (FK -> users.id, nullable, indexed) --
        op.add_column(
            table,
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.create_foreign_key(
            f"fk_{table}_user_id_users",
            table,
            "users",
            ["user_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_index(f"ix_{table}_user_id", table, ["user_id"])

        # -- created_on_device_id (UUID, nullable) --
        op.add_column(
            table,
            sa.Column("created_on_device_id", postgresql.UUID(as_uuid=True), nullable=True),
        )

        # -- updated_on_device_id (UUID, nullable) --
        op.add_column(
            table,
            sa.Column("updated_on_device_id", postgresql.UUID(as_uuid=True), nullable=True),
        )

        # -- composite index (user_id, deleted_at) for dual-mode queries --
        op.create_index(
            f"ix_{table}_user_id_deleted_at",
            table,
            ["user_id", "deleted_at"],
        )


def downgrade() -> None:
    for table in reversed(_TABLES):
        op.drop_index(f"ix_{table}_user_id_deleted_at", table_name=table)
        op.drop_column(table, "updated_on_device_id")
        op.drop_column(table, "created_on_device_id")
        op.drop_index(f"ix_{table}_user_id", table_name=table)
        op.drop_constraint(f"fk_{table}_user_id_users", table, type_="foreignkey")
        op.drop_column(table, "user_id")
