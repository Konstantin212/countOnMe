"""Create product_portions table.

Revision ID: 0003_product_portions
Revises: 0002_products
Create Date: 2026-02-05
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM


revision = "0003_product_portions"
down_revision = "0002_products"
branch_labels = None
depends_on = None

# Reference existing enums (created in 0001)
unit_enum = ENUM("mg", "g", "kg", "ml", "l", "tsp", "tbsp", "cup", name="unit_enum", create_type=False)


def upgrade() -> None:
    op.create_table(
        "product_portions",
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
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("base_amount", sa.Numeric(12, 3), nullable=False),
        sa.Column("base_unit", unit_enum, nullable=False),
        sa.Column("calories", sa.Numeric(12, 3), nullable=False),
        sa.Column("protein", sa.Numeric(12, 3), nullable=True),
        sa.Column("carbs", sa.Numeric(12, 3), nullable=True),
        sa.Column("fat", sa.Numeric(12, 3), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
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
        sa.CheckConstraint("base_amount > 0", name="ck_product_portions_base_amount_positive"),
        sa.CheckConstraint("calories >= 0", name="ck_product_portions_calories_nonnegative"),
    )

    op.create_index("ix_product_portions_device_id", "product_portions", ["device_id"])
    op.create_index("ix_product_portions_product_id", "product_portions", ["product_id"])
    op.create_index(
        "ix_product_portions_product_id_deleted_at",
        "product_portions",
        ["product_id", "deleted_at"],
    )

    # Exactly one default portion per product (among non-deleted rows).
    op.create_index(
        "ux_product_portions_default_per_product",
        "product_portions",
        ["product_id"],
        unique=True,
        postgresql_where=sa.text("is_default AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ux_product_portions_default_per_product", table_name="product_portions")
    op.drop_index("ix_product_portions_product_id_deleted_at", table_name="product_portions")
    op.drop_index("ix_product_portions_product_id", table_name="product_portions")
    op.drop_index("ix_product_portions_device_id", table_name="product_portions")
    op.drop_table("product_portions")

