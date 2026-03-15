"""Extend unit_enum with 'pcs' and 'serving' values.

Revision ID: 0009_extend_unit_enum
Revises: 0008_catalog_portions
Create Date: 2026-03-14

Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
We use op.execute() with autocommit_block() to handle this.
This migration is irreversible — enum values cannot be removed in PostgreSQL.
"""

from __future__ import annotations

from alembic import op

revision = "0009_extend_unit_enum"
down_revision = "0008_catalog_portions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE unit_enum ADD VALUE IF NOT EXISTS 'pcs'")
        op.execute("ALTER TYPE unit_enum ADD VALUE IF NOT EXISTS 'serving'")


def downgrade() -> None:
    # ALTER TYPE ... ADD VALUE is irreversible in PostgreSQL
    pass
