"""Add server_updated_at and sync_version columns to all syncable tables.

Creates a shared sequence ``sync_version_seq`` and a trigger function that
auto-bumps ``sync_version`` and ``server_updated_at`` on every INSERT/UPDATE.

Revision ID: 0016_add_sync_columns
Revises: 0015_shared_foods
Create Date: 2026-03-26
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0016_add_sync_columns"
down_revision = "0015_shared_foods"
branch_labels = None
depends_on = None

_TABLES = ["products", "product_portions", "food_entries", "user_goals", "body_weights"]


def upgrade() -> None:
    # 1. Create shared sequence
    op.execute("CREATE SEQUENCE IF NOT EXISTS sync_version_seq")

    # 2. Add columns to each table.
    #    PostgreSQL 11+ applies the DEFAULT to existing rows on ADD COLUMN,
    #    so existing data is backfilled automatically.
    for table in _TABLES:
        op.add_column(
            table,
            sa.Column(
                "server_updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
        )
        op.add_column(
            table,
            sa.Column(
                "sync_version",
                sa.BigInteger(),
                nullable=False,
                server_default=sa.text("nextval('sync_version_seq')"),
            ),
        )

        # Composite index for delta sync queries
        op.create_index(
            f"ix_{table}_user_id_server_updated_at",
            table,
            ["user_id", "server_updated_at"],
        )
        op.create_index(
            f"ix_{table}_sync_version",
            table,
            ["sync_version"],
        )

    # 3. Trigger function: bump sync_version and server_updated_at on every write
    op.execute(
        """
        CREATE OR REPLACE FUNCTION trg_bump_sync_version()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.sync_version := nextval('sync_version_seq');
            NEW.server_updated_at := now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # 4. Attach trigger to each table
    for table in _TABLES:
        op.execute(
            f"""
            CREATE TRIGGER {table}_bump_sync_version
            BEFORE INSERT OR UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION trg_bump_sync_version();
            """
        )


def downgrade() -> None:
    for table in reversed(_TABLES):
        op.execute(f"DROP TRIGGER IF EXISTS {table}_bump_sync_version ON {table}")

    op.execute("DROP FUNCTION IF EXISTS trg_bump_sync_version()")

    for table in reversed(_TABLES):
        op.drop_index(f"ix_{table}_sync_version", table_name=table)
        op.drop_index(f"ix_{table}_user_id_server_updated_at", table_name=table)
        op.drop_column(table, "sync_version")
        op.drop_column(table, "server_updated_at")

    op.execute("DROP SEQUENCE IF EXISTS sync_version_seq")
