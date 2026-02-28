"""Create catalog_portions table.

Revision ID: 0008_catalog_portions
Revises: 0007_catalog_products
Create Date: 2026-02-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0008_catalog_portions"
down_revision = "0007_catalog_products"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "catalog_portions",
        sa.Column(
            "id",
            sa.UUID(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "catalog_product_id",
            sa.UUID(),
            sa.ForeignKey("catalog_products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("base_amount", sa.Numeric(12, 3), nullable=False),
        sa.Column(
            "base_unit",
            sa.Enum(
                "mg", "g", "kg", "ml", "l", "tsp", "tbsp", "cup",
                name="unit_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("gram_weight", sa.Numeric(12, 3), nullable=True),
        sa.Column("calories", sa.Numeric(12, 3), nullable=False),
        sa.Column("protein", sa.Numeric(12, 3), nullable=True),
        sa.Column("carbs", sa.Numeric(12, 3), nullable=True),
        sa.Column("fat", sa.Numeric(12, 3), nullable=True),
        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
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
    )

    op.create_index(
        "ix_catalog_portions_catalog_product_id",
        "catalog_portions",
        ["catalog_product_id"],
    )

    # Partial unique index: only one is_default=true per catalog_product_id
    op.create_index(
        "uq_catalog_portions_default_per_product",
        "catalog_portions",
        ["catalog_product_id"],
        unique=True,
        postgresql_where=sa.text("is_default = true"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_catalog_portions_default_per_product",
        table_name="catalog_portions",
    )
    op.drop_index(
        "ix_catalog_portions_catalog_product_id",
        table_name="catalog_portions",
    )
    op.drop_table("catalog_portions")
