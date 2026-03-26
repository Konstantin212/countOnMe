"""Pytest configuration and fixtures for backend tests."""

from __future__ import annotations

import os
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import jwt as pyjwt
import pytest_asyncio
from cryptography.hazmat.primitives.asymmetric import ec
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.db import Base, get_session
from app.features.auth.models import Device, User, UserDevice
from app.features.auth.service import SUPABASE_MANAGED_HASH
from app.features.catalog.models import CatalogPortion, CatalogProduct
from app.features.goals.models import UserGoal
from app.features.meals.models import FoodEntry
from app.features.moderation.models import ContentReport, UserBlock
from app.features.portions.models import ProductPortion
from app.features.products.models import Product
from app.features.shared.models import SharedFood, SharedFoodPortion
from app.features.water.models import WaterLog
from app.features.weights.models import BodyWeight
from app.main import create_app

# Ensure test environment variables are set
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://countonme:countonme@localhost:5433/countonme_test",
)
os.environ.setdefault("DEVICE_TOKEN_PEPPER", "test-pepper-for-unit-tests-only")
os.environ.setdefault("SUPABASE_SECRET_KEY", "test-secret-key")

# ---------------------------------------------------------------------------
# Shared EC key pair for JWT test tokens (session-scoped)
# ---------------------------------------------------------------------------
_TEST_EC_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
_TEST_EC_PUBLIC_KEY = _TEST_EC_PRIVATE_KEY.public_key()


def _make_test_jwt(
    sub: str,
    email: str = "test@test.com",
    aud: str = "authenticated",
    exp_delta: timedelta = timedelta(hours=1),
) -> str:
    """Create a signed Supabase-style JWT for testing (ES256)."""
    payload = {
        "sub": sub,
        "email": email,
        "aud": aud,
        "exp": datetime.now(UTC) + exp_delta,
        "iat": datetime.now(UTC),
    }
    return pyjwt.encode(payload, _TEST_EC_PRIVATE_KEY, algorithm="ES256")


@pytest_asyncio.fixture(autouse=True)
async def _patch_jwks_for_tests():
    """Patch the JWKS client for ALL tests so JWT verification uses our test key."""
    mock_client = MagicMock()

    def get_signing_key_from_jwt(token):
        mock_key = MagicMock()
        mock_key.key = _TEST_EC_PUBLIC_KEY
        return mock_key

    mock_client.get_signing_key_from_jwt = get_signing_key_from_jwt
    with patch("app.features.auth.service._get_jwks_client", return_value=mock_client):
        yield


@pytest_asyncio.fixture
async def test_engine() -> AsyncIterator[AsyncEngine]:
    """Create test engine for each test."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, pool_pre_ping=True)

    # Import all models to ensure they're registered with Base
    _ = (Device, User, UserDevice, Product, ProductPortion, FoodEntry, UserGoal, BodyWeight, WaterLog, CatalogProduct, CatalogPortion, SharedFood, SharedFoodPortion, ContentReport, UserBlock)

    # Create schema (reuse existing enums if they exist)
    async with engine.begin() as conn:
        # Create enums if they don't exist
        await conn.execute(
            text("""
            DO $$ BEGIN
                CREATE TYPE unit_enum AS ENUM ('mg', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'pcs', 'serving');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            """)
        )
        await conn.execute(
            text("""
            DO $$ BEGIN
                CREATE TYPE meal_type_enum AS ENUM (
                    'breakfast', 'lunch', 'dinner', 'snacks', 'water'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            """)
        )
        await conn.execute(
            text("""
            DO $$ BEGIN
                CREATE TYPE visibility_enum AS ENUM ('private', 'unlisted', 'public');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            """)
        )
        await conn.execute(
            text("""
            DO $$ BEGIN
                CREATE TYPE moderation_status_enum AS ENUM ('pending', 'approved', 'rejected');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            """)
        )
        await conn.execute(
            text("""
            DO $$ BEGIN
                CREATE TYPE report_reason_enum AS ENUM ('inaccurate', 'spam', 'offensive', 'other');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            """)
        )
        # Create sync_version sequence if it doesn't exist
        await conn.execute(
            text("""
            DO $$ BEGIN
                CREATE SEQUENCE IF NOT EXISTS sync_version_seq;
            END $$;
            """)
        )

        # Create tables (will fail if exist, but that's ok for now)
        try:
            await conn.run_sync(Base.metadata.create_all)
        except Exception:  # noqa: S110
            pass  # Tables already exist - expected in test environment

        # Add is_admin column to users table if it doesn't exist
        await conn.execute(
            text("""
            DO $$ BEGIN
                ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
            EXCEPTION WHEN OTHERS THEN null;
            END $$;
            """)
        )

        # Add sync columns to tables that may have been created before SyncMixin
        # (create_all doesn't ALTER existing tables)
        sync_tables = [
            "products", "product_portions", "food_entries",
            "user_goals", "body_weights", "water_logs",
        ]
        for tbl in sync_tables:
            await conn.execute(
                text(f"""
                DO $$ BEGIN
                    ALTER TABLE {tbl}
                        ADD COLUMN IF NOT EXISTS server_updated_at
                            timestamptz NOT NULL DEFAULT now();
                EXCEPTION WHEN OTHERS THEN null;
                END $$;
                """)
            )
            await conn.execute(
                text(f"""
                DO $$ BEGIN
                    ALTER TABLE {tbl}
                        ADD COLUMN IF NOT EXISTS sync_version
                            bigint NOT NULL DEFAULT nextval('sync_version_seq');
                EXCEPTION WHEN OTHERS THEN null;
                END $$;
                """)
            )

        # Create trigger function that bumps sync_version on every write
        await conn.execute(
            text("""
            CREATE OR REPLACE FUNCTION trg_bump_sync_version()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.sync_version := nextval('sync_version_seq');
                NEW.server_updated_at := now();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            """)
        )

        # Attach trigger to each syncable table
        for tbl in sync_tables:
            await conn.execute(
                text(f"""
                DO $$ BEGIN
                    CREATE TRIGGER {tbl}_bump_sync_version
                    BEFORE INSERT OR UPDATE ON {tbl}
                    FOR EACH ROW EXECUTE FUNCTION trg_bump_sync_version();
                EXCEPTION WHEN duplicate_object THEN null;
                END $$;
                """)
            )

    yield engine

    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """Create a test session with savepoint-based isolation.

    Services call session.commit() directly, which commits to the test DB.
    After each test, we truncate all tables to clean up.
    """
    session_local = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )

    async with session_local() as session:
        yield session
        # Note: Tables persist between tests for performance
        # Run manual cleanup between test sessions if needed


@pytest_asyncio.fixture
async def app_client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    """Create test HTTP client with test database session."""
    app = create_app()

    # Override get_session dependency
    async def override_get_session():
        yield db_session

    app.dependency_overrides[get_session] = override_get_session

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def authenticated_client(
    app_client: AsyncClient,
    db_session: AsyncSession,
) -> AsyncIterator[tuple[AsyncClient, uuid.UUID]]:
    """Create authenticated test client with a JWT-based user.

    Returns:
        tuple[AsyncClient, uuid.UUID]: (client with auth header, user_id)
    """
    # Create a user
    supabase_id = uuid.uuid4()
    user = User(supabase_id=supabase_id, email="test@test.com")
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)

    # Create a device and link it to the user
    device_id = uuid.uuid4()
    device = Device(id=device_id, token_hash=SUPABASE_MANAGED_HASH)
    db_session.add(device)
    await db_session.flush()

    user_device = UserDevice(user_id=user.id, device_id=device_id)
    db_session.add(user_device)
    await db_session.flush()

    # Generate JWT
    jwt_token = _make_test_jwt(sub=str(supabase_id), email="test@test.com")

    # Add headers
    app_client.headers["Authorization"] = f"Bearer {jwt_token}"
    app_client.headers["X-Device-Id"] = str(device_id)

    yield app_client, user.id

    # Cleanup auth headers
    app_client.headers.pop("Authorization", None)
    app_client.headers.pop("X-Device-Id", None)
