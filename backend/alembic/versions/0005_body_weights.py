"""Create body_weights table.

Revision ID: 0005_body_weights
Revises: 0004_food_entries
Create Date: 2026-02-05
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0005_body_weights"
down_revision = "0004_food_entries"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "body_weights",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "device_id",
            sa.UUID(),
            sa.ForeignKey("devices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("weight_kg", sa.Numeric(12, 3), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("weight_kg > 0", name="ck_body_weights_weight_positive"),
    )

    op.create_index("ix_body_weights_device_id", "body_weights", ["device_id"])
    op.create_index("ix_body_weights_day", "body_weights", ["day"])
    op.create_index("ix_body_weights_device_id_day", "body_weights", ["device_id", "day"])
    op.create_index(
        "ux_body_weights_device_day_unique",
        "body_weights",
        ["device_id", "day"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ux_body_weights_device_day_unique", table_name="body_weights")
    op.drop_index("ix_body_weights_device_id_day", table_name="body_weights")
    op.drop_index("ix_body_weights_day", table_name="body_weights")
    op.drop_index("ix_body_weights_device_id", table_name="body_weights")
    op.drop_table("body_weights")

