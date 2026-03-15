---
type: feature
status: current
last-updated: 2026-03-14
related-features:
  - product-management
---

# Global Product Catalog Seeding

## Overview

CountOnMe includes a global, read-only product catalog seeded from multiple data sources: USDA SR Legacy (7,414 products) and Open Food Facts (4,989 packaged products with barcodes), totalling 12,403 catalog products. This catalog provides pre-defined products that any device can search and log from without manual product creation.

The catalog is stored in separate `catalog_products` and `catalog_portions` tables (no `device_id`), making it accessible to all devices while preserving the device-scoping invariant for user-created products.

## Running the Seed

### Quick Start

From the repository root:

```bash
python seed.py
```

This sets the default `DATABASE_URL` and runs the seed script. Seeds both USDA and Open Food Facts by default.

### Command-Line Options

```bash
python seed.py --seeds-dir /path/to/seed/files --sources all --dry-run
```

**Options:**

- `--seeds-dir PATH` — Directory containing USDA JSON and OFF CSV files. Default: `seeds/`
- `--sources {usda,off,all}` — Data sources to seed. Default: `all`
- `--db-url URL` — PostgreSQL connection URL. Overrides `DATABASE_URL` environment variable
- `--dry-run` — Parse and validate without writing to the database

### Direct Invocation

```bash
cd backend
python -m scripts.seed_catalog --seeds-dir ../seeds
```

### Environment Setup

The seed script uses a default database connection and does not require configuration for typical setups.

**Default behavior:**
- `seed.py` automatically sets `DATABASE_URL` to `postgresql://countonme:countonme@localhost:5433/countonme` (host-accessible port via Docker Compose)
- If you have already started the database with Docker Compose, no further setup is needed

**Override the database URL:**

**Option 1: Command-line flag**
```bash
python seed.py --db-url "postgresql://user:pass@custom-host:5432/countonme"
```

**Option 2: Environment variable**
```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/countonme"
python seed.py
```

**Option 3: `.env` file at repo root**
```
DATABASE_URL=postgresql://user:pass@localhost:5432/countonme
```

**Database Port Clarification:**
- From the **host machine**: `localhost:5433` (exposed by Docker Compose)
- Inside **Docker** (container to container): `db:5432` (internal Docker network)
- Use `localhost:5433` when running the seed script from your development machine

## Idempotency

The seed script is **fully idempotent**. It is safe to run multiple times:

1. Products are upserted using the composite key `(source, source_id)` — stable per data source
2. Product metadata (`display_name`, `brand`, `barcode`, `category`) is updated on re-run
3. **All portions are replaced** (deleted and re-inserted) to reflect the latest data
4. No duplicates are created

This means you can safely re-run the seed after a dataset update without corrupting the catalog.

## API Endpoints

See [`docs/api/catalog.md`](../api/catalog.md) for full endpoint reference including request/response schemas and status codes.

## Data Model

### catalog_products Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key, auto-generated |
| `source` | TEXT | Data source: `usda` or `off` |
| `source_id` | TEXT | Stable ID within source (fdc_id for USDA, barcode for OFF) |
| `display_name` | TEXT | Consumer-friendly name (cleaned from USDA or OFF) |
| `brand` | TEXT | Brand name (OFF only, nullable) |
| `barcode` | TEXT | Barcode (OFF only, nullable, indexed) |
| `name` | TEXT | Legacy searchable name field (indexed) |
| `category` | TEXT | Food category (nullable) |
| `search_vector` | TSVECTOR | PostgreSQL full-text search vector (computed) |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |
| `updated_at` | TIMESTAMPTZ | Auto-updated on upsert |

**Unique Constraint:**
- `(source, source_id)` — Composite key for idempotency

### catalog_portions Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key, auto-generated |
| `catalog_product_id` | UUID | Foreign key to `catalog_products` |
| `label` | TEXT | Human-readable portion label (e.g., "1 cup, 182g") |
| `base_amount` | NUMERIC(12,3) | Portion size (value in `base_unit`) |
| `base_unit` | Unit enum | Unit type: `g`, `kg`, `mg`, `ml`, `l`, `tsp`, `tbsp`, `cup`, `pcs`, `serving` |
| `gram_weight` | NUMERIC(12,3) | Gram equivalent (nullable for dimensionless units like `pcs`, `serving`) |
| `calories` | NUMERIC(12,3) | Total calories in this portion |
| `protein` | NUMERIC(12,3) | Grams of protein (nullable) |
| `carbs` | NUMERIC(12,3) | Grams of carbohydrates (nullable) |
| `fat` | NUMERIC(12,3) | Grams of fat (nullable) |
| `is_default` | BOOLEAN | True for the canonical portion (typically "100 g") |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |
| `updated_at` | TIMESTAMPTZ | Auto-updated on upsert |

**Indexes:**
- `catalog_product_id` — List portions by product

**Note:** Every catalog product has at least one default portion (typically "100 g"). The `pcs` and `serving` units recover ~85% of portions that were previously dropped due to unsupported USDA units.

## Data Transformation

### USDA SR Legacy

**Macro Extraction:** Nutrients are extracted from `foodNutrients` array: `"Energy"` (kcal), `"Protein"`, `"Carbohydrate, by difference"`, `"Total lipid (fat)"`. Uses Atwater formula if Energy is missing: `(protein × 4) + (carbs × 4) + (fat × 9)`.

**Name Normalization:** `clean_usda_name()` transforms verbose USDA descriptions (e.g., "Chicken, broiler or fryers, breast, skinless...") into consumer-friendly names (e.g., "Chicken breast, braised") by removing noise patterns and cooking metadata.

**Unit Support:** Portions map USDA units to the enum: `g`, `kg`, `mg`, `ml`, `l`, `tsp`, `tbsp`, `cup`, `pcs` (countable items), `serving`. Unmapped units (e.g., `oz`, `lb`) are skipped; portions with no `gramWeight` are also skipped. A synthetic 100g portion is always created.

**Filtering:** Products are skipped if `fdc_id` is missing, description is empty, `kcal_100g` ≤ 0 (e.g., water, spices), or category is "Supplements" or "Baby Foods". This ensures only valid, quantifiable consumer foods enter the catalog.

### Open Food Facts

**Source:** Pre-filtered CSV from `prepare_off_data.py`, which reduces the 4.4 GB Parquet to ~5,000 rows.

**Columns:** barcode, product_name, brands, categories, energy_kcal_100g, and macro data. Branded products provide `display_name`, `brand`, and `barcode` for retail lookups.

**Units:** OFF portions use `pcs` (items) or `serving` (reference servings), enabling countable and pre-portioned products.

## Search Strategy

The service uses a hybrid approach for fast, relevant results:

- **len(search) ≥ 3:** single `OR` query combining PostgreSQL `tsvector` match and `display_name ILIKE`; results ordered by `ts_rank` descending so tsvector matches rank higher
- **len(search) < 3:** ILIKE on `display_name` directly, ordered alphabetically
- **No search:** Order by `display_name` ascending

The `search_vector` is computed automatically from `display_name`, `brand`, and `category`.

## Technical Details

**Database Library:** The seed script uses `asyncpg` (not psycopg) for async PostgreSQL. This allows the script to run standalone without importing app dependencies that require environment configuration.

**Seeder Architecture:** The script uses an orchestrator pattern with source-specific seeder classes (`UsdaSeeder`, `OffSeeder`) that inherit from `AbstractSeeder`. Each seeder handles parsing, validation, and database upserts independently, allowing parallel or sequential execution.

## Key Files

- `backend/scripts/seed_catalog.py` — Orchestrator (asyncpg connection, CLI, source delegation)
- `backend/scripts/seeders/base.py` — AbstractSeeder, shared utilities (unit normalization, macro extraction)
- `backend/scripts/seeders/usda.py` — USDA SR Legacy seeder (JSON parsing, name cleaning, batch insert)
- `backend/scripts/seeders/off.py` — Open Food Facts seeder (CSV parsing, branded products)
- `backend/scripts/seeders/name_cleaner.py` — USDA name normalization (verbose → consumer-friendly)
- `backend/scripts/prepare_off_data.py` — Parquet filter utility (reduces 4.4 GB to 5,000-row CSV)
- `backend/app/features/catalog/models.py` — CatalogProduct, CatalogPortion ORM models
- `backend/app/features/catalog/service.py` — Query logic (tsvector search, get by id)
- `backend/app/features/catalog/router.py` — FastAPI endpoints
- `seed.py` — Cross-platform wrapper at repo root (sets DATABASE_URL, calls seed_catalog)

## Related Features

- [`product-management.md`](product-management.md) — User-created products (device-scoped)
- [`device-auth.md`](device-auth.md) — Authentication required to access catalog endpoints
- [`food-tracking.md`](food-tracking.md) — Food entries and meal logging (references user products, catalog products can be copied)
