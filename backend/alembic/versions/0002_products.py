"""Create products table.

Revision ID: 0002_products
Revises: 0001_devices_and_enums
Create Date: 2026-02-05
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0002_products"
down_revision = "0001_devices_and_enums"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "device_id",
            sa.UUID(),
            sa.ForeignKey("devices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.Text(), nullable=False),
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
    )

    op.create_index(
        "ix_products_device_id_name",
        "products",
        ["device_id", "name"],
    )
    op.create_index("ix_products_device_id_deleted_at", "products", ["device_id", "deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_products_device_id_deleted_at", table_name="products")
    op.drop_index("ix_products_device_id_name", table_name="products")
    op.drop_table("products")

