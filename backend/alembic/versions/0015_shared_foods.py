"""Add shared_foods and shared_food_portions tables with enums and GIN index.

Revision ID: 0015_shared_foods
Revises: 0014_make_device_id_nullable
Create Date: 2026-03-26

Note: search_vector is a GENERATED ALWAYS AS ... STORED column,
which Alembic cannot manage natively. We use raw SQL for that step.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0015_shared_foods"
down_revision = "0014_make_device_id_nullable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create visibility_enum
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE visibility_enum AS ENUM ('private', 'unlisted', 'public');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    # 2. Create moderation_status_enum
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE moderation_status_enum AS ENUM ('pending', 'approved', 'rejected');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    # 3. Create shared_foods table (without search_vector -- added via raw SQL)
    op.create_table(
        "shared_foods",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("owner_user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("brand", sa.Text(), nullable=True),
        sa.Column("barcode", sa.Text(), nullable=True),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column(
            "visibility",
            sa.Enum("private", "unlisted", "public", name="visibility_enum", create_type=False),
            server_default="private",
            nullable=False,
        ),
        sa.Column(
            "moderation_status",
            sa.Enum("pending", "approved", "rejected", name="moderation_status_enum", create_type=False),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # 4. Add search_vector as GENERATED ALWAYS STORED column (raw SQL required)
    op.execute(
        """
        ALTER TABLE shared_foods
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

    # 5. Create indexes on shared_foods
    op.create_index("ix_shared_foods_owner_user_id", "shared_foods", ["owner_user_id"])
    op.create_index("ix_shared_foods_visibility_moderation", "shared_foods", ["visibility", "moderation_status"])
    op.create_index("ix_shared_foods_search_vector", "shared_foods", ["search_vector"], postgresql_using="gin")
    op.create_index("ix_shared_foods_barcode", "shared_foods", ["barcode"])

    # 6. Create shared_food_portions table
    op.create_table(
        "shared_food_portions",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("shared_food_id", sa.UUID(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("base_amount", sa.Numeric(12, 3), nullable=False),
        sa.Column(
            "base_unit",
            sa.Enum(
                "mg", "g", "kg", "ml", "l", "tsp", "tbsp", "cup", "pcs", "serving",
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
        sa.Column("is_default", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["shared_food_id"], ["shared_foods.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # 7. Create index on shared_food_portions.shared_food_id
    op.create_index("ix_shared_food_portions_shared_food_id", "shared_food_portions", ["shared_food_id"])


def downgrade() -> None:
    # Drop indexes and tables in reverse order
    op.drop_index("ix_shared_food_portions_shared_food_id", table_name="shared_food_portions")
    op.drop_table("shared_food_portions")

    op.drop_index("ix_shared_foods_barcode", table_name="shared_foods")
    op.drop_index("ix_shared_foods_search_vector", table_name="shared_foods")
    op.drop_index("ix_shared_foods_visibility_moderation", table_name="shared_foods")
    op.drop_index("ix_shared_foods_owner_user_id", table_name="shared_foods")
    op.drop_table("shared_foods")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS moderation_status_enum")
    op.execute("DROP TYPE IF EXISTS visibility_enum")
