"""Create enums + devices table.

Revision ID: 0001_devices_and_enums
Revises: None
Create Date: 2026-02-05
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "0001_devices_and_enums"
down_revision = None
branch_labels = None
depends_on = None


UNIT_ENUM_NAME = "unit_enum"
MEAL_TYPE_ENUM_NAME = "meal_type_enum"


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    unit_enum = sa.Enum(
        "mg",
        "g",
        "kg",
        "ml",
        "l",
        "tsp",
        "tbsp",
        "cup",
        name=UNIT_ENUM_NAME,
    )
    meal_type_enum = sa.Enum(
        "breakfast",
        "lunch",
        "dinner",
        "snacks",
        "water",
        name=MEAL_TYPE_ENUM_NAME,
    )
    unit_enum.create(op.get_bind(), checkfirst=True)
    meal_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "devices",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("devices")

    sa.Enum(name=MEAL_TYPE_ENUM_NAME).drop(op.get_bind(), checkfirst=True)
    sa.Enum(name=UNIT_ENUM_NAME).drop(op.get_bind(), checkfirst=True)

