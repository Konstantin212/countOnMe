"""Pytest configuration and fixtures for backend tests."""

from __future__ import annotations

import os
import uuid
from collections.abc import AsyncIterator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.api.deps import get_session
from app.db.base import Base
from app.main import create_app
from app.models.body_weight import BodyWeight
from app.models.catalog_portion import CatalogPortion
from app.models.catalog_product import CatalogProduct
from app.models.device import Device
from app.models.food_entry import FoodEntry
from app.models.product import Product
from app.models.product_portion import ProductPortion
from app.models.user_goal import UserGoal
from app.services.auth import issue_device_token

# Ensure test environment variables are set
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://countonme:countonme@localhost:5433/countonme_test",
)
os.environ.setdefault("DEVICE_TOKEN_PEPPER", "test-pepper-for-unit-tests-only")


@pytest_asyncio.fixture
async def test_engine() -> AsyncIterator[AsyncEngine]:
    """Create test engine for each test."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, pool_pre_ping=True)

    # Import all models to ensure they're registered with Base
    _ = (Device, Product, ProductPortion, FoodEntry, UserGoal, BodyWeight, CatalogProduct, CatalogPortion)

    # Create schema (reuse existing enums if they exist)
    async with engine.begin() as conn:
        # Create enums if they don't exist
        await conn.execute(
            text("""
            DO $$ BEGIN
                CREATE TYPE unit_enum AS ENUM ('mg', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup');
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
        # Create tables (will fail if exist, but that's ok for now)
        try:
            await conn.run_sync(Base.metadata.create_all)
        except Exception:  # noqa: S110
            pass  # Tables already exist - expected in test environment

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
    """Create authenticated test client with a registered device.

    Returns:
        tuple[AsyncClient, uuid.UUID]: (client with auth header, device_id)
    """
    # Create a device
    device_id = uuid.uuid4()
    token, token_hash = issue_device_token(device_id)
    device = Device(id=device_id, token_hash=token_hash)
    db_session.add(device)
    await db_session.flush()

    # Add Authorization header to client
    app_client.headers["Authorization"] = f"Bearer {token}"

    yield app_client, device_id

    # Cleanup auth header
    app_client.headers.pop("Authorization", None)
