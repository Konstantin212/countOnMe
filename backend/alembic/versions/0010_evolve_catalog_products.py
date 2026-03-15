"""Evolve catalog_products: replace fdc_id with source/source_id/display_name,
add brand, barcode, and search_vector generated column.

Revision ID: 0010_evolve_catalog_products
Revises: 0009_extend_unit_enum
Create Date: 2026-03-14

Note: search_vector is a GENERATED ALWAYS AS ... STORED column,
which Alembic cannot manage natively. We use raw SQL for that step.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0010_evolve_catalog_products"
down_revision = "0009_extend_unit_enum"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add source with server_default for existing rows
    op.add_column(
        "catalog_products",
        sa.Column("source", sa.Text(), nullable=False, server_default="usda"),
    )

    # 2. Add source_id as nullable first
    op.add_column(
        "catalog_products",
        sa.Column("source_id", sa.Text(), nullable=True),
    )

    # 3. Backfill source_id from fdc_id
    op.execute("UPDATE catalog_products SET source_id = fdc_id::text")

    # 4. Make source_id NOT NULL
    op.alter_column("catalog_products", "source_id", nullable=False)

    # 5. Add display_name as nullable first
    op.add_column(
        "catalog_products",
        sa.Column("display_name", sa.Text(), nullable=True),
    )

    # 6. Backfill display_name from name
    op.execute("UPDATE catalog_products SET display_name = name")

    # 7. Make display_name NOT NULL
    op.alter_column("catalog_products", "display_name", nullable=False)

    # 8. Add brand (nullable)
    op.add_column(
        "catalog_products",
        sa.Column("brand", sa.Text(), nullable=True),
    )

    # 9. Add barcode (nullable)
    op.add_column(
        "catalog_products",
        sa.Column("barcode", sa.Text(), nullable=True),
    )

    # 10. Create unique constraint on (source, source_id)
    op.create_unique_constraint(
        "uq_catalog_products_source_source_id",
        "catalog_products",
        ["source", "source_id"],
    )

    # 11. Create index on barcode
    op.create_index(
        "ix_catalog_products_barcode",
        "catalog_products",
        ["barcode"],
    )

    # 12. Drop old unique index on fdc_id
    op.drop_index("ix_catalog_products_fdc_id", table_name="catalog_products")

    # 13. Drop fdc_id column
    op.drop_column("catalog_products", "fdc_id")

    # 14. Remove server_default from source (was only needed for backfill)
    op.alter_column("catalog_products", "source", server_default=None)

    # 15. Add search_vector as GENERATED ALWAYS STORED column (raw SQL required)
    op.execute(
        """
        ALTER TABLE catalog_products
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
            to_tsvector(
                'english',
                coalesce(display_name, '') || ' '
                || coalesce(brand, '') || ' '
                || coalesce(category, '')
            )
        ) STORED
        """
    )

    # 16. Create GIN index on search_vector
    op.create_index(
        "ix_catalog_products_search_vector",
        "catalog_products",
        ["search_vector"],
        postgresql_using="gin",
    )


def downgrade() -> None:
    # Reverse in opposite order

    # 16. Drop GIN index on search_vector
    op.drop_index(
        "ix_catalog_products_search_vector",
        table_name="catalog_products",
    )

    # 15. Drop search_vector column
    op.drop_column("catalog_products", "search_vector")

    # 14. (no-op: server_default removal doesn't need reversal here)

    # 13. Re-add fdc_id column as nullable first
    op.add_column(
        "catalog_products",
        sa.Column("fdc_id", sa.Integer(), nullable=True),
    )

    # 12. Backfill fdc_id from source_id
    op.execute("UPDATE catalog_products SET fdc_id = source_id::integer WHERE source = 'usda'")

    # Make fdc_id NOT NULL (rows without valid fdc_id will fail — acceptable for downgrade)
    op.alter_column("catalog_products", "fdc_id", nullable=False)

    # Re-create unique index on fdc_id
    op.create_index(
        "ix_catalog_products_fdc_id",
        "catalog_products",
        ["fdc_id"],
        unique=True,
    )

    # 11. Drop barcode index
    op.drop_index("ix_catalog_products_barcode", table_name="catalog_products")

    # 10. Drop unique constraint on (source, source_id)
    op.drop_constraint(
        "uq_catalog_products_source_source_id",
        "catalog_products",
        type_="unique",
    )

    # 9. Drop barcode column
    op.drop_column("catalog_products", "barcode")

    # 8. Drop brand column
    op.drop_column("catalog_products", "brand")

    # 7-5. Drop display_name column
    op.drop_column("catalog_products", "display_name")

    # 4-2. Drop source_id column
    op.drop_column("catalog_products", "source_id")

    # 1. Drop source column
    op.drop_column("catalog_products", "source")
