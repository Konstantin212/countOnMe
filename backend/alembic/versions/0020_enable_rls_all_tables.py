"""Enable Row Level Security on all public tables.

Supabase exposes the public schema via PostgREST. Without RLS, any client
with the anon key can read/write every table directly, bypassing our FastAPI
auth layer. Enabling RLS with no policies blocks all PostgREST access while
leaving SQLAlchemy (service-role) connections unaffected.

Also fixes the "Function Search Path Mutable" advisory on set_sync_version
by pinning its search_path.

Revision ID: 0020_enable_rls_all_tables
Revises: 0019_food_entry_catalog_ptn
Create Date: 2026-04-04
"""

from __future__ import annotations

from alembic import op

revision = "0020_enable_rls_all_tables"
down_revision = "0019_food_entry_catalog_ptn"
branch_labels = None
depends_on = None

_TABLES = [
    "alembic_version",
    "body_weights",
    "catalog_portions",
    "catalog_products",
    "content_reports",
    "devices",
    "food_entries",
    "product_portions",
    "products",
    "shared_food_portions",
    "shared_foods",
    "user_blocks",
    "user_devices",
    "user_goals",
    "users",
    "water_logs",
]


def upgrade() -> None:
    for table in _TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")

    # Fix "Function Search Path Mutable" advisory on set_sync_version.
    # The function may not exist in all environments (Supabase-managed),
    # so we use DO $$ ... $$ to check first.
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_proc
                WHERE proname = 'set_sync_version'
                  AND pronamespace = 'public'::regnamespace
            ) THEN
                ALTER FUNCTION public.set_sync_version
                    SET search_path = '';
            END IF;
        END
        $$;
    """)


def downgrade() -> None:
    for table in _TABLES:
        op.execute(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY")

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_proc
                WHERE proname = 'set_sync_version'
                  AND pronamespace = 'public'::regnamespace
            ) THEN
                ALTER FUNCTION public.set_sync_version
                    RESET search_path;
            END IF;
        END
        $$;
    """)
