---
type: api
status: current
last-updated: 2026-03-14
related-features:
  - catalog-seeding
  - product-management
---

# Catalog API

Prefix: `/v1/catalog` | Auth: Bearer token required

Global product catalog seeded from USDA data. Catalog products are shared (no device_id) and read-only.

## Endpoints

### `GET /v1/products/search`

Unified search that includes catalog results. See [Products API](products.md) for full details.

Catalog results are returned with `source: "catalog"` and `catalog_id` set. User products appear first, then catalog results. Macros are computed per 100g from the default portion: `round(value / base_amount * 100, 2)`.

## Data Model

**catalog_products** (global, no device_id):
- `id` (UUID), `fdc_id` (USDA stable ID), `name`, `category`, `created_at`, `updated_at`

**catalog_portions** (per catalog product):
- `id`, `catalog_product_id`, `label`, `base_amount`, `base_unit`, `calories`, `protein`, `carbs`, `fat`, `is_default`, `gram_weight`, `created_at`, `updated_at`

## Seeding

The catalog is populated via `seed.py` which imports USDA FDC data. See [Catalog Seeding](../features/catalog-seeding.md) for the full seeding process.

## Key Files

- `backend/app/features/products/router.py` — Search endpoint (includes catalog)
- `backend/app/features/products/service.py` — Catalog query logic in `search_products`
- `backend/app/features/catalog/models.py` — CatalogProduct, CatalogPortion ORM models
- `backend/scripts/seed_catalog.py` — USDA data import script
- `seed.py` — Cross-platform wrapper at repo root
