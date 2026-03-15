"""Add barcode column to products table.

Revision ID: 0011_add_barcode_to_products
Revises: 0010_evolve_catalog_products
Create Date: 2026-03-15
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0011_add_barcode_to_products"
down_revision = "0010_evolve_catalog_products"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("barcode", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_products_barcode",
        "products",
        ["barcode"],
    )


def downgrade() -> None:
    op.drop_index("ix_products_barcode", table_name="products")
    op.drop_column("products", "barcode")
