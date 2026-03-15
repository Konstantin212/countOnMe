---
type: api
status: current
last-updated: 2026-03-15
related-features:
  - catalog-seeding
  - product-management
---

# Catalog API

Prefix: `/v1/catalog` | Auth: Bearer token required

Global product catalog seeded from USDA SR Legacy and Open Food Facts. Catalog products are shared (no device_id) and read-only. Full-text search via PostgreSQL `tsvector`.

## Endpoints

### `GET /v1/catalog/products`

List catalog products with optional full-text search.

**Query Parameters:**
- `search` (optional, max 200 chars) — Full-text search on display_name, brand, category
- `limit` (optional, default 50, max 200) — Number of results
- `offset` (optional, default 0) — Pagination offset

**Response (200 OK):** Array of catalog products with these fields:
- `id`, `source` (usda/off), `source_id`, `display_name`, `brand` (nullable), `barcode` (nullable)
- `name`, `category` (nullable), `search_vector`
- `default_portion` — Default portion with `id`, `label`, `base_amount`, `base_unit`, `gram_weight`, `calories`, `protein`, `carbs`, `fat`, `is_default`

### `GET /v1/catalog/products/{catalog_product_id}`

Get a single catalog product with all portions.

**Response (200 OK):** Single catalog product with:
- `id`, `source`, `source_id`, `display_name`, `brand`, `barcode`, `name`, `category`
- `default_portion` — See structure above
- `portions[]` — All portions for this product

**Status Codes:**
- `200` — Product found
- `401` — Missing or invalid device token
- `404` — Product not found

## Data Model

**catalog_products:**
- `id` (UUID), `source` (text), `source_id` (text), `display_name`, `brand` (nullable), `barcode` (nullable), `name`, `category` (nullable), `search_vector` (TSVECTOR), `created_at`, `updated_at`
- **Unique:** `(source, source_id)` — Composite key per data source

**catalog_portions:**
- `id` (UUID), `catalog_product_id` (FK), `label`, `base_amount` (decimal), `base_unit` (enum: g, kg, mg, ml, l, tsp, tbsp, cup, pcs, serving), `gram_weight` (decimal, nullable), `calories`, `protein` (nullable), `carbs` (nullable), `fat` (nullable), `is_default` (boolean), `created_at`, `updated_at`

## Seeding

See [Catalog Seeding](../features/catalog-seeding.md) for the full seeding process, data sources, and transformations.

## Key Files

- `backend/app/features/catalog/router.py` — Endpoints
- `backend/app/features/catalog/service.py` — Query logic (list, search, get by id)
- `backend/app/features/catalog/models.py` — ORM models
- `backend/app/features/catalog/schemas.py` — Response schemas
- `backend/scripts/seed_catalog.py` — Seed orchestrator
- `seed.py` — Cross-platform wrapper at repo root
