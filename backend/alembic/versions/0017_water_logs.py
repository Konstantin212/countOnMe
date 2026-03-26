"""Create water_logs table.

Revision ID: 0017_water_logs
Revises: 0016_add_sync_columns
Create Date: 2026-03-26
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0017_water_logs"
down_revision = "0016_add_sync_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "water_logs",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("device_id", sa.UUID(), nullable=True),
        sa.Column("created_on_device_id", sa.UUID(), nullable=True),
        sa.Column("updated_on_device_id", sa.UUID(), nullable=True),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("amount_ml", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("server_updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("sync_version", sa.BigInteger(), nullable=False, server_default=sa.text("nextval('sync_version_seq')")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Indexes
    op.create_index("ix_water_logs_user_id", "water_logs", ["user_id"])
    op.create_index("ix_water_logs_user_id_deleted_at", "water_logs", ["user_id", "deleted_at"])
    op.create_index("ix_water_logs_user_id_day", "water_logs", ["user_id", "day"])
    op.create_index("ix_water_logs_user_id_server_updated_at", "water_logs", ["user_id", "server_updated_at"])
    op.create_index("ix_water_logs_sync_version", "water_logs", ["sync_version"])

    # Attach the sync trigger
    op.execute(
        """
        CREATE TRIGGER water_logs_bump_sync_version
        BEFORE INSERT OR UPDATE ON water_logs
        FOR EACH ROW EXECUTE FUNCTION trg_bump_sync_version();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS water_logs_bump_sync_version ON water_logs")
    op.drop_table("water_logs")
