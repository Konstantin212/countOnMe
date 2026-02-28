"""Create catalog_products table.

Revision ID: 0007_catalog_products
Revises: 0006_user_goals
Create Date: 2026-02-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0007_catalog_products"
down_revision = "0006_user_goals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "catalog_products",
        sa.Column(
            "id",
            sa.UUID(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("fdc_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=True),
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
        "ix_catalog_products_fdc_id",
        "catalog_products",
        ["fdc_id"],
        unique=True,
    )
    op.create_index(
        "ix_catalog_products_name",
        "catalog_products",
        ["name"],
    )


def downgrade() -> None:
    op.drop_index("ix_catalog_products_name", table_name="catalog_products")
    op.drop_index("ix_catalog_products_fdc_id", table_name="catalog_products")
    op.drop_table("catalog_products")
