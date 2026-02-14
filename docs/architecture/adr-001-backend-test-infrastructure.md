# ADR-001: Backend Test Infrastructure

## Status

Proposed

## Context

The CountOnMe backend currently has **unit tests only** -- covering pure functions in `services/auth.py`, `services/calculation.py`, `services/goal_calculation.py`, `schemas/goal.py`, and `api/rate_limit.py`. None of these tests touch the database.

The project has a `pyproject.toml` coverage target of `fail_under = 80`. To reach this threshold, we must test the following untested code:

- **6 service modules with DB access**: `products.py`, `portions.py`, `food_entries.py`, `goals.py`, `weights.py`, `stats.py`
- **8 API routers**: `devices.py`, `products.py`, `portions.py`, `food_entries.py`, `goals.py`, `stats.py`, `sync.py`, `weights.py`
- **Dependency layer**: `api/deps.py` (auth middleware)
- **App wiring**: `main.py` (router mounting, health endpoint)

All service modules call `session.commit()` directly (not via a unit-of-work pattern), meaning they own transaction control. All ORM models use PostgreSQL-specific features: `UUID(as_uuid=True)`, `func.gen_random_uuid()`, native PG enums (`unit_enum`, `meal_type_enum`), `with_for_update()` (row-level locking in `devices.py` router), and `Numeric(12, 3)` precision. The first migration (`0001`) runs `CREATE EXTENSION IF NOT EXISTS pgcrypto`.

The existing Docker Compose file exposes PostgreSQL 16 on host port `5433`. The backend is configured with `pydantic-settings` reading from `.env`, with `DEVICE_TOKEN_PEPPER` as a required secret. The project already has `pytest-asyncio`, `httpx`, and `pytest-cov` in dev dependencies.

### Goals

1. Enable integration tests against a real PostgreSQL database
2. Achieve 80%+ code coverage
3. Tests must be fast enough to run in a tight feedback loop (< 30 seconds)
4. Tests must be isolated from each other (no state leakage)
5. Minimize new dependencies
6. Support both local development (Docker running) and CI

## Decisions

### 1. Test Database: Option D -- Existing Docker Compose PG with Separate Test Database

**Decision**: Create a dedicated `countonme_test` database inside the same PostgreSQL instance already defined in `docker-compose.yml`. Connection string: `postgresql+asyncpg://countonme:countonme@localhost:5433/countonme_test`.

**Rationale**:

- The codebase uses 5 PostgreSQL-specific features that **cannot** be replicated in SQLite:
  1. `UUID(as_uuid=True)` with `func.gen_random_uuid()` server default (requires `pgcrypto`)
  2. Native PG enums (`unit_enum`, `meal_type_enum`) with `create_type=False`
  3. `with_for_update()` row-level locking in device registration
  4. `Numeric(12, 3)` precision semantics
  5. `CREATE EXTENSION IF NOT EXISTS pgcrypto` in migration 0001
- SQLite (Option A) is **eliminated** -- it would require a compatibility layer for every PG-specific feature above, and the tests would not actually validate production behavior.
- Testcontainers (Option C) adds a heavyweight dependency (`testcontainers[postgres]`), requires Docker-in-Docker in CI, and has cold-start latency of 5-10 seconds per session. The codebase already has a running PG instance; spinning up a second is wasteful.
- A dedicated test database (Option D) within the existing PG instance has **zero** new infrastructure: same Docker Compose, same PG version (16), same extensions. The `conftest.py` session fixture creates/drops the database at the start/end of the test session. Developers already have `docker compose up -d db` running for local development.

**Trade-offs**:

- (+) Zero new dependencies, same PG version as production
- (+) Fast: no container cold-start; tables created via `metadata.create_all()` in < 1s
- (+) PG-specific features tested identically to production
- (-) Requires Docker Compose PG to be running before tests (already true for development)
- (-) CI must either use a PG service container or Docker Compose
- (-) Two databases share the same PG instance (acceptable for test environments)

### 2. Test Isolation: Option B -- Savepoint/Nested Transactions

**Decision**: Use the well-established SQLAlchemy nested transaction pattern: begin an outer transaction before each test, replace `session.commit()` with savepoint commits, then roll back the outer transaction after the test.

**Rationale**:

Every service module in this codebase calls `await session.commit()` directly:

- `products.py`: `create_product`, `update_product`, `soft_delete_product` all call `session.commit()`
- `portions.py`: `create_portion`, `update_portion`, `soft_delete_portion` call `session.commit()` (with `session.flush()` before clearing defaults)
- `food_entries.py`: `create_food_entry`, `update_food_entry`, `soft_delete_food_entry` call `session.commit()`
- `goals.py`: `create_calculated_goal`, `create_manual_goal`, `update_goal`, `soft_delete_goal` call `session.commit()` (with `session.flush()` in `_soft_delete_existing_goals`)
- `weights.py`: `create_body_weight`, `update_body_weight`, `soft_delete_body_weight` call `session.commit()`

The savepoint pattern intercepts `session.commit()` so it commits only the inner savepoint, while the outer transaction can still roll back all changes. This is the standard FastAPI + SQLAlchemy testing approach.

Implementation: Override `get_session` to yield a session bound to a nested transaction. Listen for `after_transaction_end` events to restart the savepoint after each `commit()`.

**Trade-offs**:

- (+) Each test is fully isolated with no leftover data
- (+) Very fast -- no table truncation or recreation between tests
- (+) Services can call `session.commit()` and `session.flush()` without modification
- (-) Slightly complex fixture setup (well-documented pattern, though)
- (-) Subtle differences: `session.rollback()` inside a test rolls back to savepoint, not outer txn -- this is acceptable since only `devices.py` router calls `session.rollback()` in the `IntegrityError` catch, and that path is tested separately
- (-) Row-level locking (`with_for_update()`) behavior differs within a single transaction -- acceptable because device registration concurrency is an edge case best tested in a dedicated integration test without savepoints

### 3. API Client: Option A -- httpx AsyncClient with ASGITransport

**Decision**: Use `httpx.AsyncClient` with `ASGITransport(app=app)` for API-level tests. Override the `get_session` dependency to inject the test session (with savepoint isolation).

**Rationale**:

- All routers depend on `get_session` (via `Depends`) and `get_current_device_id` (via `Depends`). Both are easily overridden with `app.dependency_overrides`.
- `httpx.AsyncClient` is already in `pyproject.toml` dev dependencies.
- Using ASGITransport tests the full stack: Pydantic validation, dependency injection, middleware, status codes, response serialization -- without network overhead.
- FastAPI's `TestClient` (Option B) wraps sync calls around the async app using `anyio`, which adds complexity and can mask async-specific bugs.
- Direct service calls (Option C) skip the HTTP layer entirely and would leave routers untested.

**Trade-offs**:

- (+) Full-stack testing: middleware, deps, routing, serialization
- (+) No network, fast execution
- (+) Already a dependency
- (+) Async-native, matching the production runtime
- (-) Tests are somewhat coupled to the HTTP contract (acceptable -- we want to test the contract)

### 4. Data Factories: Option A -- Plain Factory Functions

**Decision**: Use plain `async` factory functions in a `tests/factories.py` module. No `factory_boy` or similar library.

**Rationale**:

- The domain has only 6 entity types (Device, Product, ProductPortion, FoodEntry, UserGoal, BodyWeight) with straightforward creation patterns.
- Each factory function takes a session and optional overrides, returns a fully persisted ORM instance. Example: `make_device(session) -> Device`, `make_product(session, device_id=...) -> Product`.
- Factory functions are explicit, type-safe, and easy to read. No "magic" attribute generation. Every test knows exactly what data it created.
- `factory_boy` (Option B) adds a dependency for a problem that does not exist at this scale. The codebase has < 10 model types; sequences and traits are overkill.
- Pytest fixtures with parametrize (Option C) are used for test variations, but not as a replacement for data creation utilities.

**Trade-offs**:

- (+) Zero new dependencies
- (+) Explicit, readable, type-safe
- (+) Easy to maintain for 6 entity types
- (-) More boilerplate than factory_boy for complex object graphs (acceptable at this scale)
- (-) Must manually handle defaults for each field

### 5. Auth Strategy: Option C -- Both (Override for Most, Real Tokens for Auth Tests)

**Decision**: Override `get_current_device_id` dependency for the majority of tests. Use real token flow only in tests specifically targeting the `devices/register` endpoint and the auth pipeline in `deps.py`.

**Rationale**:

- Most routers only need a valid `device_id` UUID. They do not care about how it was obtained. Overriding `get_current_device_id` to return a known UUID removes auth boilerplate from 90% of tests.
- The `devices/register` endpoint does not use `get_current_device_id` -- it has its own auth flow (issue token, hash, store). This must be tested with real HTTP calls.
- The `get_current_device` dependency in `deps.py` (token parsing, hash verification, last_seen update) is critical security code that must be tested end-to-end with real tokens.
- A helper function `register_device(client) -> (device_id, token)` calls the register endpoint and returns credentials for auth-specific tests.

**Trade-offs**:

- (+) 90% of tests are simpler (no token juggling)
- (+) Auth-specific tests still validate the real security pipeline
- (+) Device scoping tests can easily use two different device_id overrides to verify isolation
- (-) Two different patterns in tests (override vs. real token) -- mitigated by clear naming conventions

### 6. Environment Config: Option C -- Environment Variables with Fallbacks in conftest

**Decision**: Set test environment variables directly in `conftest.py` using `os.environ` before importing the app. Provide a dedicated test database URL and a test pepper value.

**Rationale**:

- `Settings` (pydantic-settings) reads from env vars and `.env` file. Setting `DATABASE_URL` and `DEVICE_TOKEN_PEPPER` in `conftest.py` before the app is imported ensures test config is used.
- A `.env.test` file (Option B) requires loading logic and risks being accidentally committed with real secrets or forgotten.
- A `Settings` subclass (Option D) requires refactoring `app/settings.py` to support injection, which is over-engineering for this use case.
- Hardcoded values (Option A) are effectively what we do, but by going through `os.environ`, we maintain the same config pathway as production.

Implementation:

```python
# conftest.py (top of file, before any app imports)
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://countonme:countonme@localhost:5433/countonme_test")
os.environ.setdefault("DEVICE_TOKEN_PEPPER", "test-pepper-not-for-production-use-32chars")
os.environ.setdefault("ENV", "test")
```

Using `setdefault` allows CI to override via real env vars if needed.

**Trade-offs**:

- (+) Simple, no new files or abstractions
- (+) CI can override via environment
- (+) Uses the same config path as production (pydantic-settings reads env vars)
- (-) Must be at the very top of conftest before any `app` imports (enforced by code structure)
- (-) `os.environ` mutation is a minor code smell -- acceptable in test setup

## Implementation Architecture

### File Structure

```
backend/tests/
    conftest.py             # Root conftest: env setup, engine, session, app fixtures
    factories.py            # Plain factory functions for all 6 entity types
    __init__.py             # (existing)
    api/
        __init__.py         # (existing)
        conftest.py         # API-specific fixtures: async_client, auth overrides
        test_rate_limit.py  # (existing)
        test_health.py      # Health endpoint test
        test_devices.py     # Device registration (real tokens)
        test_products.py    # Products CRUD via HTTP
        test_portions.py    # Portions CRUD via HTTP
        test_food_entries.py# Food entries CRUD via HTTP
        test_goals.py       # Goals CRUD via HTTP
        test_weights.py     # Body weights CRUD via HTTP
        test_stats.py       # Stats endpoints via HTTP
        test_sync.py        # Sync endpoint via HTTP
    services/
        __init__.py         # (existing)
        conftest.py         # Service-specific fixtures (if needed)
        test_auth.py        # (existing - unit tests)
        test_calculation.py # (existing - unit tests)
        test_goal_calculation.py  # (existing - unit tests)
        test_products.py    # Products service with DB
        test_portions.py    # Portions service with DB
        test_food_entries.py# Food entries service with DB
        test_goals.py       # Goals service with DB
        test_weights.py     # Weights service with DB
        test_stats.py       # Stats service with DB
    schemas/
        __init__.py         # (existing)
        test_goal.py        # (existing - unit tests)
```

### Fixture Dependency Graph

```
conftest.py (root)
│
├── test_engine (session scope)
│   Creates AsyncEngine pointed at countonme_test.
│   Creates all tables via Base.metadata.create_all() at session start.
│   Drops all tables at session end.
│   │
│   ├── test_session (function scope)
│   │   Opens connection, begins outer transaction,
│   │   creates session bound to that connection.
│   │   Intercepts commit() via savepoint.
│   │   Rolls back outer transaction after test.
│   │   │
│   │   ├── [services/conftest.py uses test_session directly]
│   │   │   Service tests call service functions with test_session.
│   │   │
│   │   └── [api/conftest.py overrides get_session dependency]
│   │       │
│   │       ├── async_client (function scope)
│   │       │   httpx.AsyncClient with ASGITransport(app=app).
│   │       │   Overrides get_session to yield test_session.
│   │       │   │
│   │       │   ├── authed_client (function scope)
│   │       │   │   Additionally overrides get_current_device_id
│   │       │   │   to return a known device_id.
│   │       │   │   Used by most API tests.
│   │       │   │
│   │       │   └── [test_devices.py uses async_client directly]
│   │       │       Tests real token flow without auth override.
│   │       │
│   │       └── device_id (function scope)
│   │           UUID of a pre-created Device in the test DB.
│   │           Used by authed_client override.
│   │
│   └── create_test_database (session scope, autouse)
│       Uses psycopg (sync) to CREATE DATABASE countonme_test.
│       Runs Alembic or metadata.create_all() + enum creation.
│       Drops database at session end.

factories.py
│
├── make_device(session, **overrides) -> Device
├── make_product(session, device_id, **overrides) -> Product
├── make_portion(session, device_id, product_id, **overrides) -> ProductPortion
├── make_food_entry(session, device_id, product_id, portion_id, **overrides) -> FoodEntry
├── make_user_goal(session, device_id, **overrides) -> UserGoal
└── make_body_weight(session, device_id, **overrides) -> BodyWeight
```

### Session Fixture (Core Pattern)

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

@pytest.fixture(scope="session")
async def test_engine():
    """Create engine for test database, create tables, tear down after."""
    engine = create_async_engine(
        "postgresql+asyncpg://countonme:countonme@localhost:5433/countonme_test",
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture()
async def test_session(test_engine):
    """Per-test session with savepoint isolation."""
    async with test_engine.connect() as conn:
        txn = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)

        # Intercept commit to use savepoint instead
        @event.listens_for(session.sync_session, "after_transaction_end")
        def restart_savepoint(session_sync, transaction):
            if transaction.nested and not transaction._parent.nested:
                session_sync.begin_nested()

        await conn.begin_nested()  # Start the first savepoint

        yield session

        await session.close()
        await txn.rollback()
```

### Database Setup (Session Scope)

Before `create_all`, we need to ensure the test database exists and PG enums are created. Two approaches:

**Approach A (preferred)**: Use `Base.metadata.create_all` which will create tables. Before that, run raw SQL to create the enums and pgcrypto extension:

```python
async with engine.begin() as conn:
    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
    # Create enums before tables
    await conn.execute(text(
        "DO $$ BEGIN "
        "CREATE TYPE unit_enum AS ENUM ('mg','g','kg','ml','l','tsp','tbsp','cup'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$"
    ))
    await conn.execute(text(
        "DO $$ BEGIN "
        "CREATE TYPE meal_type_enum AS ENUM ('breakfast','lunch','dinner','snacks','water'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$"
    ))
    await conn.run_sync(Base.metadata.create_all)
```

**Approach B**: Run Alembic migrations against the test database. More realistic but slower and more complex.

Recommendation: **Approach A** for speed. Alembic migration testing can be a separate, dedicated test.

### Example Test Skeleton

**Service test** (`tests/services/test_products.py`):

```python
"""Integration tests for products service."""
import uuid

import pytest

from app.services.products import (
    create_product,
    get_product,
    list_products,
    soft_delete_product,
    update_product,
)
from tests.factories import make_device


@pytest.mark.integration
class TestCreateProduct:
    async def test_creates_product_with_name(self, test_session):
        device = await make_device(test_session)
        product = await create_product(test_session, device_id=device.id, name="Chicken Breast")

        assert product.id is not None
        assert product.name == "Chicken Breast"
        assert product.device_id == device.id
        assert product.deleted_at is None

    async def test_creates_product_with_explicit_id(self, test_session):
        device = await make_device(test_session)
        explicit_id = uuid.uuid4()
        product = await create_product(
            test_session, device_id=device.id, name="Rice", product_id=explicit_id
        )

        assert product.id == explicit_id


@pytest.mark.integration
class TestListProducts:
    async def test_returns_only_own_device_products(self, test_session):
        device_a = await make_device(test_session)
        device_b = await make_device(test_session)

        await create_product(test_session, device_id=device_a.id, name="Apple")
        await create_product(test_session, device_id=device_b.id, name="Banana")

        results = await list_products(test_session, device_id=device_a.id)

        assert len(results) == 1
        assert results[0].name == "Apple"

    async def test_excludes_soft_deleted(self, test_session):
        device = await make_device(test_session)
        product = await create_product(test_session, device_id=device.id, name="Oats")
        await soft_delete_product(test_session, device_id=device.id, product_id=product.id)

        results = await list_products(test_session, device_id=device.id)
        assert len(results) == 0
```

**API test** (`tests/api/test_products.py`):

```python
"""API tests for products endpoints."""
import uuid

import pytest

from tests.factories import make_product


@pytest.mark.integration
class TestProductsAPI:
    async def test_create_product_returns_201(self, authed_client, device_id):
        resp = await authed_client.post("/v1/products", json={"name": "Chicken Breast"})

        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Chicken Breast"
        assert "id" in data

    async def test_list_products_empty(self, authed_client, device_id):
        resp = await authed_client.get("/v1/products")

        assert resp.status_code == 200
        assert resp.json() == []

    async def test_get_product_not_found(self, authed_client, device_id):
        resp = await authed_client.get(f"/v1/products/{uuid.uuid4()}")

        assert resp.status_code == 404

    async def test_device_scoping_prevents_cross_access(
        self, async_client, test_session
    ):
        """Device A cannot see Device B's products."""
        from tests.factories import make_device, make_product

        device_a = await make_device(test_session)
        device_b = await make_device(test_session)
        await make_product(test_session, device_id=device_b.id, name="Secret Product")

        # Override auth to device_a
        from app.api.deps import get_current_device_id
        async_client.app.dependency_overrides[get_current_device_id] = lambda: device_a.id

        resp = await async_client.get("/v1/products")
        assert resp.status_code == 200
        assert resp.json() == []
```

**Factory example** (`tests/factories.py`):

```python
"""Test data factories for creating ORM instances."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.body_weight import BodyWeight
from app.models.device import Device
from app.models.food_entry import FoodEntry
from app.models.product import Product
from app.models.product_portion import ProductPortion
from app.models.user_goal import UserGoal
from app.schemas.enums import MealType, Unit
from app.services.auth import issue_device_token


async def make_device(session: AsyncSession, **overrides) -> Device:
    device_id = overrides.get("id", uuid.uuid4())
    _, token_hash = issue_device_token(device_id)
    device = Device(
        id=device_id,
        token_hash=overrides.get("token_hash", token_hash),
    )
    session.add(device)
    await session.flush()
    await session.refresh(device)
    return device


async def make_product(
    session: AsyncSession, *, device_id: uuid.UUID, **overrides
) -> Product:
    product = Product(
        id=overrides.get("id", uuid.uuid4()),
        device_id=device_id,
        name=overrides.get("name", "Test Product"),
    )
    session.add(product)
    await session.flush()
    await session.refresh(product)
    return product


async def make_portion(
    session: AsyncSession,
    *,
    device_id: uuid.UUID,
    product_id: uuid.UUID,
    **overrides,
) -> ProductPortion:
    portion = ProductPortion(
        id=overrides.get("id", uuid.uuid4()),
        device_id=device_id,
        product_id=product_id,
        label=overrides.get("label", "100g"),
        base_amount=overrides.get("base_amount", Decimal("100")),
        base_unit=overrides.get("base_unit", Unit.g),
        calories=overrides.get("calories", Decimal("200")),
        protein=overrides.get("protein", Decimal("20")),
        carbs=overrides.get("carbs", Decimal("30")),
        fat=overrides.get("fat", Decimal("10")),
        is_default=overrides.get("is_default", True),
    )
    session.add(portion)
    await session.flush()
    await session.refresh(portion)
    return portion
```

### Key Patterns to Cover for 80%+

| Module | Test Focus | Test Type |
|--------|-----------|-----------|
| `services/products.py` | CRUD, soft delete, device scoping | Service (DB) |
| `services/portions.py` | CRUD, is_default logic, PortionConflict | Service (DB) |
| `services/food_entries.py` | CRUD, portion/product validation, date filtering | Service (DB) |
| `services/goals.py` | Create calc/manual, soft-delete cascade, update recalc | Service (DB) |
| `services/weights.py` | CRUD, WeightConflict (one-per-day), date range | Service (DB) |
| `services/stats.py` | Day stats aggregation, daily range, empty days | Service (DB) |
| `services/auth.py` | `get_device_by_id`, `touch_device_last_seen` (DB) | Service (DB) |
| `api/routers/devices.py` | Register, re-register, race condition | API (HTTP) |
| `api/routers/products.py` | CRUD via HTTP, 404s, 201s | API (HTTP) |
| `api/routers/portions.py` | CRUD via HTTP, 409 conflicts | API (HTTP) |
| `api/routers/food_entries.py` | CRUD via HTTP, date filters | API (HTTP) |
| `api/routers/goals.py` | Calculate, create, update, delete | API (HTTP) |
| `api/routers/stats.py` | Day stats, daily range, weight stats | API (HTTP) |
| `api/routers/sync.py` | Cursor pagination, incremental sync | API (HTTP) |
| `api/routers/weights.py` | CRUD via HTTP, 409 conflict | API (HTTP) |
| `api/deps.py` | Token parsing, verification, 401 cases | API (HTTP) |
| `main.py` | Health endpoint, app creation | API (HTTP) |

## Consequences

### Positive

- **Real database testing**: Every PG-specific feature (UUIDs, enums, locking, numerics) is tested against the actual database engine.
- **High confidence in device scoping**: Integration tests can verify that Device A's data is invisible to Device B, which is the core security guarantee of the system.
- **Fast iteration**: Savepoint rollback means each test runs against a clean state without paying truncation or re-creation costs. Typical test suite should complete in 10-20 seconds.
- **Minimal new dependencies**: Zero new packages. All tools (`httpx`, `pytest-asyncio`, `pytest-cov`) already exist in `pyproject.toml`.
- **CI-ready**: The same Docker Compose PG can be used in CI with a `services: postgres` step. Environment variables can override the database URL.
- **Covers the auth pipeline**: By testing the real token flow for `devices/register` and `deps.py`, we validate the security-critical code path end-to-end.

### Negative

- **Docker required**: Tests cannot run without a PostgreSQL instance. This is already true for local development, so the incremental cost is low.
- **Savepoint complexity**: The nested transaction fixture is non-trivial code that developers must understand. Mitigated by clear comments and documentation in `conftest.py`.
- **Test database creation**: The session-scoped fixture that creates `countonme_test` requires a sync connection with CREATE DATABASE privileges. This is a one-time per-session cost but adds setup code.

### Risks

- **Savepoint + `session.rollback()` interaction**: The `devices/register` router calls `await session.rollback()` in the `IntegrityError` catch block. Within a savepoint, this rolls back to the savepoint rather than the outer transaction. This should work correctly but must be verified during implementation. If it causes issues, the device registration concurrency test should use truncation isolation instead.
- **Shared PG instance contention**: If the development database is being actively used while tests run, there could theoretically be resource contention. Mitigated by using a separate database name (`countonme_test` vs `countonme`).
- **Enum drift**: If new enum values are added to `schemas/enums.py` but the test conftest enum creation SQL is not updated, tests will fail. Mitigated by generating the enum SQL dynamically from the Python enum definitions.
- **`create_all` vs Alembic drift**: Using `Base.metadata.create_all()` instead of Alembic migrations means the test schema is derived from ORM models, not migrations. If migrations and models ever diverge, tests would pass but production would fail. Mitigated by adding a dedicated "migration smoke test" that runs Alembic against an empty database.
