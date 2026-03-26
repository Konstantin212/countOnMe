"""Make device_id nullable on all 5 data tables.

Revision ID: 0014_make_device_id_nullable
Revises: 0013_add_user_ownership_columns
Create Date: 2026-03-26
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0014_make_device_id_nullable"
down_revision = "0013_add_user_ownership_columns"
branch_labels = None
depends_on = None

_TABLES = ["products", "product_portions", "food_entries", "user_goals", "body_weights"]


def upgrade() -> None:
    for table in _TABLES:
        op.alter_column(table, "device_id", existing_type=sa.UUID(), nullable=True)


def downgrade() -> None:
    # WARNING: Rolling back this migration requires manual intervention.
    # Any rows where device_id is NULL (e.g., data created via Supabase auth
    # without a device) will violate the NOT NULL constraint and cause this
    # downgrade to fail.  Before running, backfill NULL device_id values:
    #   UPDATE <table> SET device_id = '<fallback-uuid>' WHERE device_id IS NULL;
    for table in reversed(_TABLES):
        op.alter_column(table, "device_id", existing_type=sa.UUID(), nullable=False)
