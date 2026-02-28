# ADR-003: Global Product Catalog (USDA Seed Data)

## Status

Proposed

## Context

CountOnMe currently stores all products under a `device_id` foreign key — every row in `products` and `product_portions` belongs to exactly one device. This is the core device-scoping invariant that keeps user data isolated.

The product is now adding a global, read-only catalog seeded from USDA FoundationFoods JSON files (`/seeds/foundation_food_2025-12-18.json`). Every device should be able to search this catalog and log food from it without having to create products manually. The catalog is owned by the system, not by any device.

Three candidate designs were evaluated:

- **Option A** — Make `device_id` nullable on `products` + `product_portions`. `NULL` means global catalog row.
- **Option B** — Separate tables `catalog_products` + `catalog_portions` with no `device_id`. New read-only endpoint `GET /v1/catalog/products`.
- **Option C** — A well-known system-device UUID stored in env config. Seed populates rows under that UUID. Client queries both the system UUID and the user device UUID.

## Decision

**Option B: Separate catalog tables.**

New tables `catalog_products` and `catalog_portions` are introduced. These have no `device_id` column. A new read-only router exposes `GET /v1/catalog/products` and `GET /v1/catalog/products/{catalog_product_id}` (with portions). A standalone seed script `backend/scripts/seed_catalog.py` populates these tables from JSON files. Idempotency is achieved by treating `fdc_id` (USDA's stable integer identifier) as a unique natural key on `catalog_products`.

## Trade-Off Analysis

### Option A — Nullable `device_id` on existing tables

Pros:
- Single set of tables for all products.
- The existing `list_products` endpoint could be extended with a UNION or an `OR device_id IS NULL` clause.
- No duplication of schema between catalog and user products.

Cons:
- Violates the non-nullable device scoping invariant that every other row in the system relies on. Making `device_id` nullable is a conceptually ambiguous state: "this product belongs to no device" is a sentinel value, not a first-class concept.
- Migration on `products` requires dropping the NOT NULL constraint and the CHECK/FK that enforces it. Every existing query that filters by `device_id` must be audited to ensure it does not accidentally return catalog rows.
- The partial unique index `ux_product_portions_default_per_product` (currently scoped by product_id only) would need re-examination: catalog portions cannot have the same one-default-per-product invariant enforced the same way because catalog products can have many portions with one canonical default, but that default is global, not per-device.
- Service functions such as `get_product`, `get_portion`, `soft_delete_product`, and `soft_delete_portion` all accept `device_id` as a required argument. Adding a "nullable device_id" code path to every function increases cyclomatic complexity and the likelihood of a security bug where a catalog row is accidentally mutated through the device-scoped API.
- The `product_portions` table also has a `device_id` NOT NULL, `ForeignKey("devices.id", ondelete="CASCADE")`. Making it nullable means deleting a device could no longer cascade-delete its catalog portions (undesired). Dropping the cascade or making FK nullable both have side effects.

Verdict: Rejected. The cost to the invariant model and to every existing service function is too high relative to the benefit of table unification.

### Option B — Separate `catalog_products` + `catalog_portions` tables (chosen)

Pros:
- Zero impact on `products`, `product_portions`, or any existing service. The device-scoping invariant is completely preserved.
- Clean semantic boundary: catalog rows are read-only by design. The API layer never exposes a mutation endpoint for catalog items.
- `fdc_id` (USDA's stable integer) maps naturally to a unique constraint on `catalog_products`, making idempotency trivial.
- The catalog tables carry only the columns they need — no `device_id`, no `deleted_at` (catalog items are never soft-deleted by users).
- Future features (e.g. "copy catalog item to my products", "link food entry to catalog_product_id") can be layered on top without touching the existing schema.
- Easier to reason about in tests: catalog fixtures are separate from user-owned fixtures.

Cons:
- Two Alembic migrations instead of one (for the two new tables).
- Client must call a different endpoint (`/v1/catalog/products`) to browse global products vs. `/v1/products` for their own. The client-side search UX must merge both result sets if the user wants a unified list.
- Some column overlap with `products` and `product_portions` (name, label, macros). This is acceptable duplication — the schema semantics are different enough to justify separate models.

Verdict: Chosen. Clean separation, no risk to existing invariants, idempotency is straightforward.

### Option C — Well-known system-device UUID

Pros:
- No schema changes at all — uses the exact same tables and code paths.
- Seed script is trivial: create a device row with the system UUID and insert products under it.

Cons:
- Deeply violates the device-scoping semantic. The system UUID is "a device" — meaning device_id is now overloaded to mean both "user device" and "the system". Any code that says "return data for this device" would return catalog data if called with the system UUID.
- The system UUID must be kept secret from clients, or clients could use it to create, edit, or delete catalog products through the existing product mutation endpoints. This creates a persistent security risk that grows as the feature set expands.
- If the system UUID is accidentally leaked or guessed, the catalog is writable by any client. The existing endpoints do not distinguish between "user product" and "system product".
- The system UUID must be stored somewhere (env var, config). Losing it means losing the ability to re-seed idempotently without extra bookkeeping.
- Reversibility is very low: migrating away from Option C later requires either adding a `is_catalog` boolean flag (which is just a worse version of Option A) or moving rows to new tables (which is Option B with extra pain).

Verdict: Rejected. Security risk is too high and the semantic pollution of `device_id` is irreversible.

## Design

### New Database Tables

#### `catalog_products`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` server default |
| `fdc_id` | INTEGER NOT NULL UNIQUE | USDA stable external identifier — idempotency key |
| `name` | TEXT NOT NULL | From `description` field in USDA JSON |
| `category` | TEXT | From `foodCategory.description` — optional |
| `created_at` | TIMESTAMPTZ NOT NULL | `now()` server default |
| `updated_at` | TIMESTAMPTZ NOT NULL | `now()` server default |

No `deleted_at`. Catalog items are replaced (or left) on re-seed, never soft-deleted.

#### `catalog_portions`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` server default |
| `catalog_product_id` | UUID NOT NULL FK → `catalog_products.id` CASCADE | Parent |
| `label` | TEXT NOT NULL | Built from `modifier + measureUnit.name` (USDA) |
| `base_amount` | NUMERIC(12,3) NOT NULL | From `value` or `amount` in USDA portion |
| `base_unit` | `unit_enum` NOT NULL | Normalized from `measureUnit.abbreviation/name` |
| `gram_weight` | NUMERIC(12,3) | USDA `gramWeight` — gram equivalent of the portion |
| `calories` | NUMERIC(12,3) NOT NULL | Computed per portion (Atwater or direct) |
| `protein` | NUMERIC(12,3) | Nullable — not always present |
| `carbs` | NUMERIC(12,3) | Nullable |
| `fat` | NUMERIC(12,3) | Nullable |
| `is_default` | BOOLEAN NOT NULL | True for the first/canonical portion per product |
| `created_at` | TIMESTAMPTZ NOT NULL | `now()` server default |
| `updated_at` | TIMESTAMPTZ NOT NULL | `now()` server default |

Note: `unit_enum` already exists in the database (created in migration `0001`). The new tables reference it with `create_type=False`.

Additionally, a synthetic "100g" portion is always generated for every catalog product regardless of whether the USDA data includes explicit portions. This ensures every catalog product has at least one default portion with a predictable, well-understood base amount. The synthetic 100g portion is marked `is_default=True`.

Index strategy:
- `ix_catalog_products_fdc_id` (unique) — idempotency lookups during seed
- `ix_catalog_portions_catalog_product_id` — list portions by product
- `ux_catalog_portions_default_per_product` — partial unique on `(catalog_product_id)` WHERE `is_default = true`

### Alembic Migrations

Migration `0007_catalog_products.py`:
- Creates `catalog_products` table with the `fdc_id` unique index.

Migration `0008_catalog_portions.py`:
- Creates `catalog_portions` table.
- Adds the partial unique index for the default portion constraint.

Migrations are hand-written (not autogenerated) to match the style of `0003_product_portions.py`.

### ORM Models

`backend/app/models/catalog_product.py` — `CatalogProduct(Base)` with `TimestampMixin`.

`backend/app/models/catalog_portion.py` — `CatalogPortion(Base)` with `TimestampMixin`.

Neither model uses `device_id`. `CatalogProduct` has `fdc_id: Mapped[int]`.

### Pydantic Schemas

`backend/app/schemas/catalog.py`:

```
CatalogPortionResponse
    id: UUID
    catalog_product_id: UUID
    label: str
    base_amount: Decimal
    base_unit: Unit
    gram_weight: Decimal | None
    calories: Decimal
    protein: Decimal | None
    carbs: Decimal | None
    fat: Decimal | None
    is_default: bool

CatalogProductResponse
    id: UUID
    fdc_id: int
    name: str
    category: str | None
    portions: list[CatalogPortionResponse]

CatalogProductListItem
    id: UUID
    fdc_id: int
    name: str
    category: str | None
```

`CatalogProductListItem` is used for list responses (no portions embedded). `CatalogProductResponse` is used for the single-item endpoint.

### Service Layer

`backend/app/services/catalog.py`:

- `list_catalog_products(session, *, search: str | None, limit: int, offset: int) -> list[CatalogProduct]`
  - Filters by `name ILIKE %search%` when search is provided.
  - Returns paginated results ordered by name ascending.
  - Does not filter by `deleted_at` (no soft delete on catalog).
- `get_catalog_product(session, *, catalog_product_id: UUID) -> CatalogProduct | None`
  - Joins `catalog_portions` eagerly.
- `list_catalog_portions(session, *, catalog_product_id: UUID) -> list[CatalogPortion]`

No write operations are exposed through this service. Catalog is read-only from the API perspective.

### API Router

`backend/app/api/routers/catalog.py`:

Router prefix: `/catalog`, included under the `/v1` prefix in `main.py`.

All endpoints require authentication (`device_id` dependency). This prevents anonymous scraping of the catalog while keeping it accessible to any registered device.

```
GET /v1/catalog/products
    Query params: search (str, optional), limit (int, default 50, max 200), offset (int, default 0)
    Response: list[CatalogProductListItem]
    Status: 200

GET /v1/catalog/products/{catalog_product_id}
    Response: CatalogProductResponse  (includes portions)
    Status: 200 | 404
```

Catalog endpoints are read-only. There is no POST, PATCH, or DELETE on `/v1/catalog/*`.

The `search` parameter performs a case-insensitive substring match on `name`. This is sufficient for MVP. Full-text search (pg_trgm or tsvector) can be added later without API changes.

### Seed Script

`backend/scripts/seed_catalog.py` — standalone synchronous Python script (not async, for simplicity at the CLI level).

Design principles:
- Reads `DATABASE_URL` from environment or falls back to the default in `app/settings.py`. Also reads from a `.env` file at the repo root if present (using `python-dotenv` or manual dotenv parsing, since `pydantic-settings` requires the full app to load which requires `DEVICE_TOKEN_PEPPER`). The script does NOT import `app.settings` to avoid the pepper validation at startup.
- Accepts `--seeds-dir` argument (default: `../../seeds` relative to the script, resolving to `/countOnMe/seeds/`).
- Accepts `--dry-run` flag: prints counts without writing.
- Uses `psycopg` (sync) directly — avoids pulling the entire asyncpg/SQLAlchemy async stack into a CLI script. This is consistent with the approach taken in `adr-001` for the test database setup fixture.
- Idempotency: uses PostgreSQL `INSERT ... ON CONFLICT (fdc_id) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, updated_at=now()`. Portions are handled by: delete all existing portions for that `catalog_product_id`, then re-insert. This is safe because portions have no external references (no food entry points to a `catalog_portion_id`).
- Batch inserts: products and portions are inserted in batches of 500 rows using `executemany` to avoid memory pressure on the USDA file (~6.8 MB JSON).
- Progress reporting: prints a line per 100 products processed.
- Error handling: wraps the entire operation in a transaction. On any unhandled exception the transaction rolls back and the script exits non-zero.

Script structure:
```
backend/scripts/
    __init__.py          (empty)
    seed_catalog.py      (main entry point)
```

Invocation:
```
cd backend
DATABASE_URL="postgresql://countonme:countonme@localhost:5433/countonme" \
SEEDS_DIR="../seeds" \
python scripts/seed_catalog.py
```

### Bash Wrapper

`seed.sh` at the repo root:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEEDS_DIR="${SCRIPT_DIR}/seeds"
BACKEND_DIR="${SCRIPT_DIR}/backend"

# Load .env if present
if [ -f "${SCRIPT_DIR}/.env" ]; then
  set -o allexport
  source "${SCRIPT_DIR}/.env"
  set +o allexport
fi

cd "${BACKEND_DIR}"
python scripts/seed_catalog.py --seeds-dir "${SEEDS_DIR}" "$@"
```

The `"$@"` passthrough allows `./seed.sh --dry-run` to work.

### Idempotency Detail

The `fdc_id` integer from USDA is stable across dataset releases for the same food item. It is stored as a `UNIQUE NOT NULL` integer column on `catalog_products`.

On seed:
1. For each food in the JSON, attempt `INSERT INTO catalog_products (fdc_id, name, category, ...) ON CONFLICT (fdc_id) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, updated_at=now()` — this upserts the product row and returns the `id`.
2. For portions: `DELETE FROM catalog_portions WHERE catalog_product_id = $1` then batch-insert all portions fresh. Since no external table references `catalog_portion_id`, this is safe and simpler than diffing portions.
3. If a food has no supported portions (all `measureUnit` values normalize to `None`), the seed script still generates the synthetic 100g portion.

This means re-running the seed script after a USDA dataset update: updates product names/categories, replaces all portions with the latest data, and creates new catalog products for new `fdc_id` values. No duplicates are ever created.

### USDA Data Transformation

The seed script ports the logic from `backend/main.py` directly:

- `extract_macros_per_100g(food)` — returns fat/carbs/protein per 100g.
- `normalize_unit(abbr, name)` — maps USDA unit strings to `Unit` enum values.
- `calc_per_portion(per_100g, gram_weight)` — scales macros to portion gram weight.
- Calorie calculation: prefer `Energy` nutrient from `foodNutrients`; fall back to Atwater formula `4*protein + 9*fat + 4*carbs`.
- Portion label: `f"{modifier} {measureUnit.name}".strip()` or `f"{value} {abbreviation}"` — normalized and deduplicated.
- Portions whose `normalize_unit` returns `None` are skipped (unsupported units such as oz or lb that are not in the `Unit` enum). The 100g synthetic portion is always added regardless.

### Changes to `main.py` (App Wiring)

In `backend/app/main.py` (the FastAPI app factory), add:

```python
from app.api.routers import catalog as catalog_router
app.include_router(catalog_router.router, prefix="/v1")
```

### Test Coverage

New test files following existing patterns (ADR-001):

- `backend/tests/services/test_catalog.py` — service unit tests with DB: list with/without search, get by id, 404.
- `backend/tests/api/test_catalog.py` — API-level tests: list returns 200, search filters, single product returns portions, unknown id returns 404, endpoint requires auth.
- `backend/tests/factories.py` — add `make_catalog_product(session, **overrides) -> CatalogProduct` and `make_catalog_portion(session, catalog_product_id, **overrides) -> CatalogPortion`.
- `backend/scripts/test_seed_catalog.py` — optional unit tests for the pure transformation functions (`extract_macros_per_100g`, `normalize_unit`, `calc_per_portion`). No DB required for these.

## File Inventory

New files created by implementation:

| File | Purpose |
|---|---|
| `backend/app/models/catalog_product.py` | `CatalogProduct` ORM model |
| `backend/app/models/catalog_portion.py` | `CatalogPortion` ORM model |
| `backend/app/schemas/catalog.py` | Pydantic request/response schemas |
| `backend/app/services/catalog.py` | Read-only service: list, get, search |
| `backend/app/api/routers/catalog.py` | FastAPI router: `GET /v1/catalog/products` |
| `backend/alembic/versions/0007_catalog_products.py` | Migration: `catalog_products` table |
| `backend/alembic/versions/0008_catalog_portions.py` | Migration: `catalog_portions` table |
| `backend/scripts/__init__.py` | Package marker |
| `backend/scripts/seed_catalog.py` | Standalone seed script |
| `seed.sh` | Bash wrapper at repo root |
| `backend/tests/services/test_catalog.py` | Service integration tests |
| `backend/tests/api/test_catalog.py` | API integration tests |

Modified files:

| File | Change |
|---|---|
| `backend/app/main.py` (FastAPI app factory, not `backend/main.py` USDA prototype) | Mount `catalog_router` under `/v1` |
| `backend/app/models/__init__.py` | Export new models (if barrel exported) |
| `backend/tests/factories.py` | Add catalog factory functions |

The prototype file `backend/main.py` (USDA parsing scratch script) is left unchanged. Its logic is ported to `seed_catalog.py`.

## Consequences

### Positive

- Device-scoping invariant is 100% preserved. No existing service, migration, or test requires modification.
- The catalog is structurally read-only: no mutation endpoints exist, no `deleted_at` plumbing required.
- Idempotency is a database-level guarantee via `ON CONFLICT (fdc_id) DO UPDATE`, not application-level bookkeeping.
- The seed script is a standalone sync script with a single psycopg dependency — no async machinery, no FastAPI app startup, no pepper validation required.
- `fdc_id` as the natural key means the same script works for initial seed, incremental updates from new USDA dataset releases, and CI test data setup.
- Future "copy to my products" feature: a user can call a new `POST /v1/catalog/products/{id}/copy` endpoint (not in scope now) that creates a `Product` + `ProductPortion` in the user's device namespace. This is additive and requires no schema changes.

### Negative

- Two new table pairs (catalog product + catalog portion) add schema surface area to maintain.
- Client must call two endpoints (`/v1/products` and `/v1/catalog/products`) and merge results for a unified product search UI.
- The USDA JSON is 6.8 MB. The seed script must load it into memory. At current size this is acceptable; if the file grows substantially a streaming JSON parser would be needed.
- Portions are fully replaced on re-seed (delete + insert). If `catalog_portion_id` is ever referenced by a future table (e.g. a food log entry linked to a catalog portion), this strategy would need to change to an upsert on a stable portion key.

### Alternatives Considered

- **Option A (nullable device_id)**: Rejected — breaks the device-scoping invariant, requires auditing every service function for the `NULL device_id` code path, and complicates the FK cascade on `devices`.
- **Option C (system device UUID)**: Rejected — creates a persistent security risk where the catalog is writable through existing mutation endpoints if the system UUID is leaked or guessed.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `catalog_portion_id` referenced by future tables (food log) | Document the delete-and-reinsert strategy now; require an ADR amendment before any FK is added to `catalog_portions` |
| USDA dataset grows beyond comfortable in-memory size | `seed_catalog.py` uses streaming-compatible batch processing; switching to `ijson` for streaming is a one-function change |
| Unit normalization misses new USDA measure units | Log all unmapped units during seed with a WARNING; review after each dataset release |
| `fdc_id` collision across different USDA dataset types | The seed script only reads `FoundationFoods` key; if SR Legacy or SurveyFoods are added later, a `source` column and composite key `(fdc_id, source)` would be needed. Document this assumption. |
| Catalog endpoint performance on large catalog | The `name ILIKE` query benefits from a trigram index (`pg_trgm`). Do not add it now (premature); add if search latency is measured above 200ms |

## Next Steps

Hand off to `planner` agent for implementation phases.
