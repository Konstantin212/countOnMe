---
type: adr
status: accepted
last-updated: 2026-03-15
related-features:
  - catalog-seeding
  - product-management
---

# ADR-003: Global Product Catalog (USDA Seed Data)

## Status

Accepted

## Context

CountOnMe stores all products under a `device_id` foreign key — every row belongs to exactly one device. The product is adding a global, read-only catalog seeded from USDA SR Legacy JSON (`seeds/FoodData_Central_sr_legacy_food_json_2018-04.json`). Every device should be able to search this catalog without creating products manually.

Three designs were evaluated:

- **Option A** — Make `device_id` nullable on `products` + `product_portions`.
- **Option B** — Separate tables `catalog_products` + `catalog_portions` with no `device_id`. New read-only endpoint `GET /v1/catalog/products`.
- **Option C** — A well-known system-device UUID in env config; seed populates rows under that UUID.

## Decision

**Option B: Separate catalog tables.**

New tables `catalog_products` and `catalog_portions` with no `device_id`. A new read-only router exposes `GET /v1/catalog/products` and `GET /v1/catalog/products/{id}`. A standalone seed script `backend/scripts/seed_catalog.py` populates them from JSON/CSV files. Idempotency is achieved via a unique constraint on `(source, source_id)`.

## Trade-Off Analysis

**Option A (nullable device_id)**: Rejected. Making `device_id` nullable violates the non-nullable device-scoping invariant relied on by every existing query. Every service function accepting `device_id` requires a new code path, increasing security risk and cyclomatic complexity.

**Option B (separate tables)**: Chosen. Zero impact on `products`, `product_portions`, or any existing service. Clean semantic boundary — catalog rows are read-only by design. Future features (copy to my products, link food entry to catalog) layer on top without touching existing schema.

**Option C (system-device UUID)**: Rejected. The catalog becomes writable through existing mutation endpoints if the system UUID is leaked or guessed. `device_id` is semantically polluted (overloaded to mean both "user device" and "the system"). Reversibility is very low.

## Design

### Database Tables

`catalog_products`: `id` (UUID PK), `source` (TEXT), `source_id` (TEXT), `name` (TEXT), `display_name` (TEXT), `brand` (TEXT nullable), `barcode` (TEXT nullable), `category` (TEXT nullable), `search_vector` (tsvector generated), `created_at`, `updated_at`. Unique constraint on `(source, source_id)`. No `deleted_at` (catalog items are never soft-deleted).

`catalog_portions`: `id` (UUID PK), `catalog_product_id` (UUID FK → catalog_products CASCADE), `label` (TEXT), `base_amount` (NUMERIC(12,3)), `base_unit` (unit_enum), `gram_weight` (NUMERIC(12,3) nullable), `calories` (NUMERIC(12,3)), `protein`/`carbs`/`fat` (NUMERIC nullable), `is_default` (BOOLEAN), `created_at`, `updated_at`.

A synthetic "100g" portion is always generated for every catalog product, marked `is_default=True`.

### Alembic Migrations

- `0007_catalog_products.py` — creates `catalog_products` table with `(source, source_id)` unique index.
- `0008_catalog_portions.py` — creates `catalog_portions` table with partial unique index on `(catalog_product_id) WHERE is_default = true`.

### Pydantic Schemas (`backend/app/features/catalog/schemas.py`)

```python
class CatalogPortionResponse(APIModel):
    id: UUID; label: str; base_amount: Decimal; base_unit: Unit
    gram_weight: Decimal | None; calories: Decimal
    protein: Decimal | None; carbs: Decimal | None; fat: Decimal | None
    is_default: bool

class CatalogProductListItem(APIModel):
    id: UUID; source: str; source_id: str; name: str; display_name: str
    brand: str | None; barcode: str | None; category: str | None
    default_portion: CatalogPortionResponse | None

class CatalogProductResponse(CatalogProductListItem):
    portions: list[CatalogPortionResponse]
```

### Service Layer (`backend/app/features/catalog/service.py`)

- `list_catalog_products(session, *, search, limit, offset)` — filters by `display_name ILIKE %search%` (short queries) or combined tsvector + ILIKE OR query (len >= 3). Returns paginated results ordered by `display_name` ascending. No soft-delete filter.
- `get_catalog_product(session, *, catalog_product_id)` — joins portions eagerly.

No write operations. Catalog is read-only from the API.

### API Router (`backend/app/features/catalog/router.py`)

All endpoints require Bearer authentication. Prefix: `/v1/catalog`.

```
GET /v1/catalog/products
    Query: search (str, optional), limit (int, default 50, max 200), offset (int, default 0)
    Response: list[CatalogProductListItem]  → 200

GET /v1/catalog/products/{catalog_product_id}
    Response: CatalogProductResponse (includes portions)  → 200 | 404
```

No POST, PATCH, or DELETE on `/v1/catalog/*`.

### Seed Script (`backend/scripts/seed_catalog.py`)

- Uses `asyncpg` directly — avoids importing `app.settings` (which requires `DEVICE_TOKEN_PEPPER`).
- Reads `DATABASE_URL` from env or `.env` at repo root.
- `--sources {usda,off,all}` (single value, default `all`), `--seeds-dir`, `--db-url`, `--dry-run` flags.
- Idempotency: `INSERT ... ON CONFLICT (source, source_id) DO UPDATE`. Portions are replaced wholesale (DELETE + INSERT) per product.
- Batch inserts via `executemany` (batches of 500). Entire operation wrapped in one transaction; rolls back and exits non-zero on any error.

## Consequences

### Positive

- Device-scoping invariant 100% preserved. No existing service, migration, or test requires modification.
- Catalog is structurally read-only — no mutation endpoints, no `deleted_at` plumbing.
- Idempotency is a database-level guarantee via `ON CONFLICT`.
- Seed script is standalone (no async machinery, no pepper validation).

### Negative

- Client must call two endpoints (`/v1/products` and `/v1/catalog/products`) and merge results for unified search.
- Two new table pairs add schema surface area to maintain.
- Portions are fully replaced on re-seed. If `catalog_portion_id` is ever referenced by a future table, the strategy must change to an upsert on a stable key.

### Risks

| Risk | Mitigation |
|---|---|
| `catalog_portion_id` referenced by future tables | Document delete-and-reinsert strategy; require ADR amendment before any FK added to `catalog_portions` |
| Unit normalization misses new USDA measure units | Log all unmapped units during seed with WARNING; review after each dataset release |
| `(source, source_id)` collision across dataset types | The seed script only reads known source keys; a new source requires a new seeder class |
