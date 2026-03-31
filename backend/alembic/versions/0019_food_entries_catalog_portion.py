"""Add catalog_portion_id to food_entries, make product_id/portion_id nullable.

Also adds a UNIQUE constraint on catalog_portions(catalog_product_id, label, base_unit)
to enable UPSERT in seed scripts (ON DELETE RESTRICT prevents DELETE+INSERT).

Revision ID: 0019_food_entries_catalog_portion
Revises: 0018_moderation_tables
Create Date: 2026-03-31
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0019_food_entries_catalog_portion"
down_revision = "0018_moderation_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add catalog_portion_id column (nullable FK)
    op.add_column(
        "food_entries",
        sa.Column(
            "catalog_portion_id",
            UUID(as_uuid=True),
            sa.ForeignKey("catalog_portions.id", ondelete="RESTRICT"),
            nullable=True,
        ),
    )

    # 2. Make product_id nullable (was NOT NULL)
    op.alter_column(
        "food_entries",
        "product_id",
        existing_type=UUID(as_uuid=True),
        nullable=True,
    )

    # 3. Make portion_id nullable (was NOT NULL)
    op.alter_column(
        "food_entries",
        "portion_id",
        existing_type=UUID(as_uuid=True),
        nullable=True,
    )

    # 4. Partial index on catalog_portion_id (only non-null rows)
    op.create_index(
        "ix_food_entries_catalog_portion_id",
        "food_entries",
        ["catalog_portion_id"],
        postgresql_where=sa.text("catalog_portion_id IS NOT NULL"),
    )

    # 5. Unique constraint on catalog_portions for UPSERT support in seeders
    op.create_unique_constraint(
        "uq_catalog_portions_product_label_unit",
        "catalog_portions",
        ["catalog_product_id", "label", "base_unit"],
    )

    # 6. CHECK constraint (deferred -- uncomment after all clients send valid data)
    # op.create_check_constraint(
    #     "ck_food_entries_portion_xor",
    #     "food_entries",
    #     "(portion_id IS NOT NULL AND catalog_portion_id IS NULL) OR "
    #     "(portion_id IS NULL AND catalog_portion_id IS NOT NULL)",
    # )


def downgrade() -> None:
    # Reverse order of upgrade

    # Drop unique constraint on catalog_portions
    op.drop_constraint(
        "uq_catalog_portions_product_label_unit",
        "catalog_portions",
        type_="unique",
    )

    # Drop partial index
    op.drop_index("ix_food_entries_catalog_portion_id", table_name="food_entries")

    # Restore NOT NULL on portion_id
    op.alter_column(
        "food_entries",
        "portion_id",
        existing_type=UUID(as_uuid=True),
        nullable=False,
    )

    # Restore NOT NULL on product_id
    op.alter_column(
        "food_entries",
        "product_id",
        existing_type=UUID(as_uuid=True),
        nullable=False,
    )

    # Drop catalog_portion_id column
    op.drop_column("food_entries", "catalog_portion_id")
