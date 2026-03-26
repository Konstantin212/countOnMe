"""Add moderation tables (content_reports, user_blocks) and is_admin on users.

Revision ID: 0018_moderation_tables
Revises: 0017_water_logs
Create Date: 2026-03-26
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0018_moderation_tables"
down_revision = "0017_water_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create report_reason enum
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE report_reason_enum AS ENUM ('inaccurate', 'spam', 'offensive', 'other');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # 2. Add is_admin column to users table
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
    )

    # 3. Create content_reports table
    op.create_table(
        "content_reports",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("reporter_user_id", sa.UUID(), nullable=False),
        sa.Column("target_shared_food_id", sa.UUID(), nullable=False),
        sa.Column(
            "reason",
            sa.Enum("inaccurate", "spam", "offensive", "other", name="report_reason_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by_user_id", sa.UUID(), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["reporter_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_shared_food_id"], ["shared_foods.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resolved_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("reporter_user_id", "target_shared_food_id", name="uq_report_per_user_per_target"),
    )
    op.create_index("ix_content_reports_reporter", "content_reports", ["reporter_user_id"])
    op.create_index("ix_content_reports_target", "content_reports", ["target_shared_food_id"])
    op.create_index("ix_content_reports_resolved_at", "content_reports", ["resolved_at"])

    # 4. Create user_blocks table
    op.create_table(
        "user_blocks",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("blocker_user_id", sa.UUID(), nullable=False),
        sa.Column("blocked_user_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["blocker_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["blocked_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("blocker_user_id", "blocked_user_id", name="uq_block_pair"),
        sa.CheckConstraint("blocker_user_id != blocked_user_id", name="ck_no_self_block"),
    )
    op.create_index("ix_user_blocks_blocker", "user_blocks", ["blocker_user_id"])
    op.create_index("ix_user_blocks_blocked", "user_blocks", ["blocked_user_id"])


def downgrade() -> None:
    op.drop_table("user_blocks")
    op.drop_table("content_reports")
    op.drop_column("users", "is_admin")
    op.execute("DROP TYPE IF EXISTS report_reason_enum")
