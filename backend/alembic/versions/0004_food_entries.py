"""Create food_entries table.

Revision ID: 0004_food_entries
Revises: 0003_product_portions
Create Date: 2026-02-05
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM


revision = "0004_food_entries"
down_revision = "0003_product_portions"
branch_labels = None
depends_on = None

# Reference existing enums (created in 0001)
unit_enum = ENUM("mg", "g", "kg", "ml", "l", "tsp", "tbsp", "cup", name="unit_enum", create_type=False)
meal_type_enum = ENUM("breakfast", "lunch", "dinner", "snacks", "water", name="meal_type_enum", create_type=False)


def upgrade() -> None:
    op.create_table(
        "food_entries",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "device_id",
            sa.UUID(),
            sa.ForeignKey("devices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            sa.UUID(),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "portion_id",
            sa.UUID(),
            sa.ForeignKey("product_portions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("meal_type", meal_type_enum, nullable=False),
        sa.Column("amount", sa.Numeric(12, 3), nullable=False),
        sa.Column("unit", unit_enum, nullable=False),
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
        sa.CheckConstraint("amount > 0", name="ck_food_entries_amount_positive"),
    )

    op.create_index("ix_food_entries_device_id", "food_entries", ["device_id"])
    op.create_index("ix_food_entries_day", "food_entries", ["day"])
    op.create_index("ix_food_entries_device_id_day", "food_entries", ["device_id", "day"])
    op.create_index(
        "ix_food_entries_device_id_day_meal_type",
        "food_entries",
        ["device_id", "day", "meal_type"],
    )
    op.create_index(
        "ix_food_entries_device_id_deleted_at",
        "food_entries",
        ["device_id", "deleted_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_food_entries_device_id_deleted_at", table_name="food_entries")
    op.drop_index("ix_food_entries_device_id_day_meal_type", table_name="food_entries")
    op.drop_index("ix_food_entries_device_id_day", table_name="food_entries")
    op.drop_index("ix_food_entries_day", table_name="food_entries")
    op.drop_index("ix_food_entries_device_id", table_name="food_entries")
    op.drop_table("food_entries")

