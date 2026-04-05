"""Create fasting_sessions table.

Revision ID: 0021_fasting_sessions
Revises: 0020_enable_rls_all_tables
Create Date: 2026-04-04
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0021_fasting_sessions"
down_revision = "0020_enable_rls_all_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fasting_sessions",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("device_id", sa.UUID(), nullable=True),
        sa.Column("created_on_device_id", sa.UUID(), nullable=True),
        sa.Column("updated_on_device_id", sa.UUID(), nullable=True),
        sa.Column("technique", sa.String(10), nullable=False),
        sa.Column("fasting_hours", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("target_end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("server_updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("sync_version", sa.BigInteger(), nullable=False, server_default=sa.text("nextval('sync_version_seq')")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Indexes
    op.create_index("ix_fasting_sessions_user_id", "fasting_sessions", ["user_id"])
    op.create_index("ix_fasting_sessions_user_id_deleted_at", "fasting_sessions", ["user_id", "deleted_at"])
    op.create_index("ix_fasting_sessions_user_id_started_at", "fasting_sessions", ["user_id", "started_at"])

    # Partial unique index: only one active (non-ended, non-deleted) session per user
    op.create_index(
        "uq_fasting_sessions_one_active_per_user",
        "fasting_sessions",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL AND deleted_at IS NULL"),
    )

    # Sync trigger
    op.execute(
        """
        CREATE TRIGGER fasting_sessions_bump_sync_version
        BEFORE INSERT OR UPDATE ON fasting_sessions
        FOR EACH ROW EXECUTE FUNCTION trg_bump_sync_version();
        """
    )

    # Row Level Security
    op.execute("ALTER TABLE fasting_sessions ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS fasting_sessions_bump_sync_version ON fasting_sessions")
    op.drop_table("fasting_sessions")
