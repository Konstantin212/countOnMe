---
type: adr
status: accepted
last-updated: 2026-03-15
related-features: []
---

# ADR-001: Backend Test Infrastructure

## Status

Accepted

## Context

The backend has unit tests only, covering pure functions (`features/auth/service.py`, `features/goals/calculation.py`, `features/stats/calculation.py`). None touch the database. The `pyproject.toml` coverage target is `fail_under = 80`.

Untested code that must be covered:
- 6+ service modules with DB access (products, portions, food_entries, goals, weights, stats, catalog)
- 8+ API routers
- Dependency layer: `app/core/deps.py` (auth middleware)
- App wiring: `main.py`

All ORM models use PostgreSQL-specific features: `UUID(as_uuid=True)`, `func.gen_random_uuid()`, native PG enums, `with_for_update()`, and `Numeric(12, 3)`. Migration 0001 runs `CREATE EXTENSION IF NOT EXISTS pgcrypto`.

## Decisions

### 1. Test Database: Dedicated `countonme_test` in Existing Docker PG

Create a `countonme_test` database inside the same PostgreSQL instance from `docker-compose.yml`. Connection: `postgresql+asyncpg://countonme:countonme@localhost:5433/countonme_test`.

SQLite is eliminated — it cannot replicate any of the 5 PG-specific features above. Testcontainers adds heavyweight dependency and cold-start latency when Docker Compose already runs locally.

Trade-offs:
- (+) Zero new dependencies, same PG version as production
- (+) Fast: `metadata.create_all()` creates tables in < 1s
- (-) Requires Docker Compose PG to be running (already true for local dev)
- (-) CI must use a PG service container or Docker Compose

### 2. Test Isolation: Savepoint / Nested Transactions

Begin an outer transaction before each test, intercept `session.commit()` with savepoint commits, roll back the outer transaction after the test.

Every service module calls `await session.commit()` directly. The savepoint pattern lets services commit to inner savepoints while all changes roll back at test end — no table truncation needed.

Trade-offs:
- (+) Each test is fully isolated with no leftover data
- (+) Very fast — no table truncation between tests
- (-) Subtle: `session.rollback()` inside a test rolls back to savepoint, not outer txn (acceptable — only `devices` router does this, tested separately)

### 3. API Client: httpx AsyncClient with ASGITransport

Use `httpx.AsyncClient(transport=ASGITransport(app=app))`. Override `get_session` and `get_current_device_id` via `app.dependency_overrides`. Already a dev dependency.

Trade-offs:
- (+) Full-stack testing: Pydantic validation, deps, routing, serialization
- (+) Async-native, no network overhead
- (-) Tests are coupled to the HTTP contract (acceptable — we want to test the contract)

### 4. Data Factories: Plain Factory Functions

Plain `async` factory functions in `tests/factories.py`. No `factory_boy`.

Each function takes a session and optional overrides, returns a fully persisted ORM instance: `make_device(session)`, `make_product(session, device_id=...)`, etc.

Trade-offs:
- (+) Zero new dependencies, explicit, type-safe
- (-) More boilerplate than factory_boy (acceptable for ~8 entity types)

### 5. Auth Strategy: Override for Most Tests, Real Tokens for Auth Tests

Override `get_current_device_id` for 90% of tests. Use real token flow only for `devices/register` and `app/core/deps.py` auth pipeline tests.

Trade-offs:
- (+) 90% of tests are simpler (no token juggling)
- (+) Auth-specific tests still validate the real security pipeline

### 6. Environment Config: os.environ in conftest

Set test env vars in `conftest.py` before importing the app:

```python
import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://countonme:countonme@localhost:5433/countonme_test")
os.environ.setdefault("DEVICE_TOKEN_PEPPER", "test-pepper-not-for-production-use-32chars")
os.environ.setdefault("ENV", "test")
```

Using `setdefault` allows CI to override via real env vars.

Trade-offs:
- (+) Simple, uses the same config path as production
- (-) Must be at the very top of conftest before any `app` imports

## Implementation

### File Structure

```
backend/tests/
    conftest.py          # env setup, engine, session, app fixtures
    factories.py         # factory functions for all entity types
    api/
        conftest.py      # async_client, authed_client fixtures
        test_devices.py  # real token flow
        test_products.py
        ...
    services/
        test_auth.py     # (existing unit tests)
        test_products.py # DB integration tests
        ...
```

### Core Session Fixture

```python
@pytest.fixture()
async def test_session(test_engine):
    async with test_engine.connect() as conn:
        txn = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        @event.listens_for(session.sync_session, "after_transaction_end")
        def restart_savepoint(session_sync, transaction):
            if transaction.nested and not transaction._parent.nested:
                session_sync.begin_nested()
        await conn.begin_nested()
        yield session
        await session.close()
        await txn.rollback()
```

### Example Service Test

```python
from app.features.products.service import create_product, list_products
from tests.factories import make_device

async def test_returns_only_own_device_products(test_session):
    device_a = await make_device(test_session)
    device_b = await make_device(test_session)
    await create_product(test_session, device_id=device_a.id, name="Apple")
    await create_product(test_session, device_id=device_b.id, name="Banana")
    results = await list_products(test_session, device_id=device_a.id)
    assert len(results) == 1 and results[0].name == "Apple"
```

### Example API Test

```python
from app.core.deps import get_current_device_id

async def test_device_scoping(async_client, test_session):
    device_a = await make_device(test_session)
    async_client.app.dependency_overrides[get_current_device_id] = lambda: device_a.id
    resp = await async_client.get("/v1/products")
    assert resp.status_code == 200 and resp.json() == []
```

## Consequences

### Positive

- Every PG-specific feature (UUIDs, enums, locking, numerics) tested against the real database engine.
- Device scoping verified end-to-end: Device A's data is invisible to Device B.
- Savepoint rollback keeps each test clean without truncation overhead. Suite completes in ~10-20 seconds.
- Zero new packages added.

### Negative

- Docker required (already true for local dev).
- Savepoint fixture is non-trivial; mitigated by clear comments in `conftest.py`.

### Risks

- **Savepoint + `session.rollback()`**: The devices router calls `rollback()` in an `IntegrityError` catch. Within a savepoint this rolls back to the savepoint — must be verified during implementation.
- **`create_all` vs Alembic drift**: Test schema is derived from ORM models. If migrations and models diverge, tests pass but production fails. Mitigated by a dedicated migration smoke test.
- **Enum drift**: If new enum values are added to `app/core/enums.py` but the test conftest SQL is not updated, tests will fail. Generate enum SQL dynamically from Python enum definitions.
