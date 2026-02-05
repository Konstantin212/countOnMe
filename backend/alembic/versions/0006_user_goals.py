"""Create user_goals table.

Revision ID: 0006_user_goals
Revises: 0005_body_weights
Create Date: 2026-02-05
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0006_user_goals"
down_revision = "0005_body_weights"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_goals",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "device_id",
            sa.UUID(),
            sa.ForeignKey("devices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Goal type
        sa.Column("goal_type", sa.String(20), nullable=False),
        # Body metrics (for calculated goals)
        sa.Column("gender", sa.String(10), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("height_cm", sa.Numeric(5, 2), nullable=True),
        sa.Column("current_weight_kg", sa.Numeric(5, 2), nullable=True),
        sa.Column("activity_level", sa.String(20), nullable=True),
        # Weight goal (for calculated)
        sa.Column("weight_goal_type", sa.String(20), nullable=True),
        sa.Column("target_weight_kg", sa.Numeric(5, 2), nullable=True),
        sa.Column("weight_change_pace", sa.String(20), nullable=True),
        # Calculated values
        sa.Column("bmr_kcal", sa.Integer(), nullable=True),
        sa.Column("tdee_kcal", sa.Integer(), nullable=True),
        # Targets (always present)
        sa.Column("daily_calories_kcal", sa.Integer(), nullable=False),
        sa.Column("protein_percent", sa.Integer(), nullable=False),
        sa.Column("carbs_percent", sa.Integer(), nullable=False),
        sa.Column("fat_percent", sa.Integer(), nullable=False),
        sa.Column("protein_grams", sa.Integer(), nullable=False),
        sa.Column("carbs_grams", sa.Integer(), nullable=False),
        sa.Column("fat_grams", sa.Integer(), nullable=False),
        sa.Column("water_ml", sa.Integer(), nullable=False),
        # Healthy weight range
        sa.Column("healthy_weight_min_kg", sa.Numeric(5, 2), nullable=True),
        sa.Column("healthy_weight_max_kg", sa.Numeric(5, 2), nullable=True),
        sa.Column("current_bmi", sa.Numeric(4, 1), nullable=True),
        sa.Column("bmi_category", sa.String(20), nullable=True),
        # Timestamps
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
        # Constraints
        sa.CheckConstraint("daily_calories_kcal > 0", name="ck_user_goals_calories_positive"),
        sa.CheckConstraint(
            "protein_percent >= 0 AND protein_percent <= 100",
            name="ck_user_goals_protein_pct_range",
        ),
        sa.CheckConstraint(
            "carbs_percent >= 0 AND carbs_percent <= 100",
            name="ck_user_goals_carbs_pct_range",
        ),
        sa.CheckConstraint(
            "fat_percent >= 0 AND fat_percent <= 100",
            name="ck_user_goals_fat_pct_range",
        ),
        sa.CheckConstraint(
            "protein_percent + carbs_percent + fat_percent = 100",
            name="ck_user_goals_macros_sum_100",
        ),
        sa.CheckConstraint("water_ml >= 0", name="ck_user_goals_water_non_negative"),
    )

    # Indexes
    op.create_index("ix_user_goals_device_id", "user_goals", ["device_id"])
    op.create_index("ix_user_goals_created_at", "user_goals", ["created_at"])
    # Partial index for active goals (one active per device)
    op.create_index(
        "ix_user_goals_device_active",
        "user_goals",
        ["device_id", "created_at"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_user_goals_device_active", table_name="user_goals")
    op.drop_index("ix_user_goals_created_at", table_name="user_goals")
    op.drop_index("ix_user_goals_device_id", table_name="user_goals")
    op.drop_table("user_goals")
