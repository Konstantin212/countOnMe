# Global Product Catalog Seeding

## Overview

CountOnMe includes a global, read-only product catalog seeded from USDA FoundationFoods JSON data. This catalog provides thousands of pre-defined products (with macro and calorie data) that any device can search and log from without manual product creation.

The catalog is stored in separate `catalog_products` and `catalog_portions` tables (no `device_id`), making it accessible to all devices while preserving the device-scoping invariant for user-created products.

## Running the Seed

### Quick Start

From the repository root:

```bash
./seed.sh
```

This sources `.env` (if present) and runs the seed script with default settings.

### Command-Line Options

```bash
./seed.sh --seeds-dir /path/to/json/files --dry-run
```

**Options:**

- `--seeds-dir PATH` — Directory containing USDA FoundationFoods `*.json` files. Default: `backend/seeds/`
- `--dry-run` — Parse and validate without writing to the database. Prints estimated product count.

### Direct Invocation

```bash
cd backend
python -m scripts.seed_catalog --seeds-dir ../seeds
```

### Environment Setup

The seed script requires database connectivity:

**Option 1: Environment variable**
```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/countonme"
./seed.sh
```

**Option 2: `.env` file at repo root**
```
DATABASE_URL=postgresql://user:pass@localhost:5432/countonme
```

The script reads the `.env` file automatically and converts `postgresql+asyncpg://` URLs to sync `postgresql://` format.

## Idempotency

The seed script is **fully idempotent**. It is safe to run multiple times:

1. Products are upserted using the USDA `fdc_id` (stable integer identifier) as the unique key
2. Product metadata (`name`, `category`) is updated on re-run
3. **All portions are replaced** (deleted and re-inserted) to reflect the latest USDA data
4. No duplicates are created

This means you can safely re-run the seed after a USDA dataset update without corrupting the catalog.

## API Endpoints

All catalog endpoints require device authentication (token header).

### List Products

```
GET /v1/catalog/products?search=apple&limit=10&offset=0
```

**Query Parameters:**

- `search` (optional, max 200 chars) — Case-insensitive substring match on product name
- `limit` (optional, default 50, max 200) — Number of results per page
- `offset` (optional, default 0) — Pagination offset

**Response (200 OK):**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "fdc_id": 167638,
    "name": "Apple, raw, with skin",
    "category": "Fruits and Fruit Juices",
    "default_portion": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "label": "100 g",
      "base_amount": "100.000",
      "base_unit": "g",
      "gram_weight": "100.000",
      "calories": "52.000",
      "protein": "0.260",
      "carbs": "13.810",
      "fat": "0.170",
      "is_default": true
    }
  }
]
```

### Get Product Details

```
GET /v1/catalog/products/{catalog_product_id}
```

**Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "fdc_id": 167638,
  "name": "Apple, raw, with skin",
  "category": "Fruits and Fruit Juices",
  "default_portion": { ... },
  "portions": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "label": "100 g",
      "base_amount": "100.000",
      "base_unit": "g",
      "gram_weight": "100.000",
      "calories": "52.000",
      "protein": "0.260",
      "carbs": "13.810",
      "fat": "0.170",
      "is_default": true
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "label": "1 medium, 182 g",
      "base_amount": "1.000",
      "base_unit": "cup",
      "gram_weight": "182.000",
      "calories": "94.640",
      "protein": "0.473",
      "carbs": "25.156",
      "fat": "0.309",
      "is_default": false
    }
  ]
}
```

**Status Codes:**

- `200` — Product found
- `401` — Missing or invalid device token
- `404` — Product not found

## Data Model

### catalog_products Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key, auto-generated |
| `fdc_id` | INTEGER | USDA FoundationFoods stable identifier (unique, upsert key) |
| `name` | TEXT | Product name (from USDA `description` field) |
| `category` | TEXT | Food category (e.g., "Fruits and Fruit Juices") |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |
| `updated_at` | TIMESTAMPTZ | Auto-updated on upsert |

**Indexes:**
- `fdc_id` (UNIQUE) — Idempotency lookups during seed

### catalog_portions Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key, auto-generated |
| `catalog_product_id` | UUID | Foreign key to `catalog_products` |
| `label` | TEXT | Human-readable portion label (e.g., "1 cup, 182g") |
| `base_amount` | NUMERIC(12,3) | Portion size (value in `base_unit`) |
| `base_unit` | Unit enum | Unit type: `g`, `kg`, `mg`, `ml`, `l`, `tsp`, `tbsp`, `cup` |
| `gram_weight` | NUMERIC(12,3) | Gram equivalent of this portion (for unit conversion) |
| `calories` | NUMERIC(12,3) | Total calories in this portion |
| `protein` | NUMERIC(12,3) | Grams of protein (nullable — not always available) |
| `carbs` | NUMERIC(12,3) | Grams of carbohydrates (nullable) |
| `fat` | NUMERIC(12,3) | Grams of fat (nullable) |
| `is_default` | BOOLEAN | True for the canonical portion (always "100 g") |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |
| `updated_at` | TIMESTAMPTZ | Auto-updated on upsert |

**Indexes:**
- `catalog_product_id` — List portions by product
- `(catalog_product_id) WHERE is_default = true` (partial unique) — Enforce one default per product

**Note:** Every catalog product has at least one default portion: a synthetic "100 g" portion created during seeding, even if the USDA data contains no explicit portions.

## USDA Data Transformation

The seed script performs the following transformations:

### Macro Extraction

Nutrients are extracted from the USDA `foodNutrients` array using these target names:

- `"Total lipid (fat)"` → `fat_g_100g`
- `"Carbohydrate, by difference"` → `carbs_g_100g`
- `"Protein"` → `protein_g_100g`
- `"Energy"` → `kcal_100g`

Values are rounded to 3 decimal places.

### Calorie Calculation

Calories per 100g are calculated as follows:

1. If `"Energy"` is present in the nutrient data, use that value directly
2. Otherwise, use the **Atwater formula**: `(protein × 4) + (carbs × 4) + (fat × 9)`

Fallback is necessary because USDA sometimes omits the direct energy value.

### Unit Normalization

USDA portion units are mapped to the `Unit` enum:

| USDA Unit | Normalized |
|-----------|------------|
| gram, g | g |
| kilogram, kg | kg |
| milligram, mg | mg |
| milliliter, ml, millilitre | ml |
| liter, l, litre | l |
| teaspoon, tsp | tsp |
| tablespoon, tbsp | tbsp |
| cup | cup |

Units not in this mapping (e.g., `oz`, `lb`) are **skipped**. The synthetic 100g portion is always created regardless.

### Portion Label Building

Portion labels are constructed from USDA data as:

```
"{base_amount} {measure_unit}, {modifier}"
```

For example:
- `"1 cup"` (from `value=1, abbreviation="cup"`)
- `"1 medium, 182 g"` (from `value=1, modifier="medium", gramWeight=182`)

### Filtering Criteria

Products are **skipped** (not seeded) if:

- `fdc_id` is missing or zero
- `description` is empty
- Calculated `kcal_100g` is zero or negative

This ensures only valid, quantifiable foods enter the catalog.

## Key Files

- `backend/scripts/seed_catalog.py` — Main seeding script (USDA JSON parsing, batch insert with idempotency)
- `backend/app/api/routers/catalog.py` — FastAPI router (`GET /v1/catalog/products`, `GET /v1/catalog/products/{id}`)
- `backend/app/services/catalog.py` — Service layer (list with search, get by id, default portion lookup)
- `backend/app/schemas/catalog.py` — Pydantic response schemas
- `backend/app/models/catalog_product.py` — SQLAlchemy ORM model for products
- `backend/app/models/catalog_portion.py` — SQLAlchemy ORM model for portions
- `seed.sh` — Bash wrapper at repo root

## Related Features

- [`product-management.md`](product-management.md) — User-created products (device-scoped)
- [`device-auth.md`](device-auth.md) — Authentication required to access catalog endpoints
- [`food-tracking.md`](food-tracking.md) — Food entries and meal logging (references user products, catalog products can be copied)
