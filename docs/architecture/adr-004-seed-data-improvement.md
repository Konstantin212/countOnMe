---
type: adr
status: accepted
last-updated: 2026-03-15
related-features:
  - catalog-seeding
  - product-search
  - data-quality
---

# ADR-004: Seed Data Improvement — Rich Product Catalog

## Status

Accepted

## Context

The catalog from ADR-003 is too thin for real-world use:
- **Source**: USDA Foundation Foods only (~97 products after quality filtering).
- **Portion coverage**: 89% of USDA portions use RACC units not in `unit_enum` — dropped. Most foods have only the synthetic "100g" portion.
- **Names are unusable**: `"Beef, loin, tenderloin roast, separable lean only, boneless, trimmed to 0\" fat, select, cooked, roasted"`.
- **No packaged/branded foods**: Open Food Facts integration required for 2,000–5,000 packaged foods.
- **No full-text search**: `ILIKE '%q%'` is a sequential scan; unacceptable at scale.

## Decision

### 1. Data Sources

**USDA SR Legacy** (~7,800 items, `seeds/FoodData_Central_sr_legacy_food_json_2018-04.json`): replaces Foundation Foods. Same `fdcId`-based structure; 20× more coverage. After quality filtering: **7,414 products**.

**Open Food Facts** (bulk CSV, pre-filtered to top 5,000 by `unique_scans_n`): provides packaged/branded foods for offline search. Filtered to: English-speaking markets, `energy-kcal_100g > 0`, `completeness >= 0.65`, Nutri-Score present, ≥ 3 of 4 macro fields. Stored at `seeds/off_products_filtered.csv` (created by one-time `backend/scripts/prepare_off_data.py` script). Expected yield: **~4,989 products**.

Foundation Foods is dropped. FNDDS evaluated and deferred — different ID system (`food_code` vs `fdc_id`), composite-food entries, different portion structure.

### 2. Data Model Changes

**New columns on `catalog_products`** (`migration 0010_evolve_catalog_products`):
- `source` TEXT — `'usda'` or `'off'`
- `source_id` TEXT — fdc_id as string (USDA) or barcode (OFF)
- `display_name` TEXT — consumer-friendly cleaned name shown in UI
- `brand` TEXT nullable — OFF brand field; NULL for USDA
- `barcode` TEXT nullable — EAN/UPC; NULL for USDA
- `search_vector` tsvector GENERATED — `to_tsvector('english', display_name || brand || category)`

The `fdc_id` INTEGER column is replaced by `source_id` TEXT. Unique constraint changes from `UNIQUE(fdc_id)` to `UNIQUE(source, source_id)`.

**New `unit_enum` values** (`migration 0009_extend_unit_enum`):
- `pcs` — maps USDA `each`, `slice`, `piece`, `link`, `egg`, `fruit`, `fillet`, etc.
- `serving` — maps USDA `serving`, `RACC`, `container`, `order`, `package` and OFF serving data.

Recovers ~85% of previously dropped portions. Non-reversible (PostgreSQL `ALTER TYPE ADD VALUE`).

### 3. Name Normalization

A `clean_usda_name()` function transforms verbose USDA names:
- Split on `, ` into segments; drop noise (`"raw"`, `"separable lean only"`, `"boneless"`, `"trimmed to X"`, grade qualifiers).
- Capitalize first segment; append first cooking method if present.
- Cap at 60 characters.

Examples: `"Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised"` → `"Chicken breast, braised"`. `name` retains original for provenance; `display_name` is what the search indexes and UI renders.

### 4. Search Strategy

For `len(search) >= 3`: single `OR` query combining `plainto_tsquery('english', search)` against `search_vector` AND `display_name ILIKE '%search%'`. Both arms run in one database round-trip; results ordered by `ts_rank` descending so tsvector matches rank higher. The ILIKE arm catches brand names and terms that don't stem well.

For `len(search) < 3`: `display_name ILIKE '%search%'` only, ordered alphabetically.

No search: order by `display_name` ascending.

### 5. Seed Pipeline Architecture

```
backend/scripts/
    seed_catalog.py       # CLI entry point + orchestrator
    seeders/
        base.py           # Abstract seeder base class
        usda.py           # USDA SR Legacy seeder
        off.py            # Open Food Facts seeder
        name_cleaner.py   # USDA name normalization
```

CLI: `--sources {usda,off,all}` (single value, default `all`), `--seeds-dir`, `--db-url`, `--dry-run`. Uses `asyncpg` directly.

### 6. Schema Changes

`CatalogProductListItem` gains: `source`, `source_id`, `display_name`, `brand`, `barcode`, `default_portion`. The `fdc_id: int` field is removed (breaking change — catalog API not yet consumed by a released client).

`ProductSearchResultItem` gains optional `display_name` and `brand` fields.

Client renders `displayName ?? name` and shows `brand` as a subtitle when present.

## Trade-Off Analysis

| Decision | Chosen | Rejected |
|---|---|---|
| Generic food source | SR Legacy (7,414 items, same format) | Foundation Foods (97 items), FNDDS (different ID system) |
| Unit extension | Add `pcs` + `serving` (2 values, 85% recovery) | Add many specific units (imperial/metric complexity) |
| Search | tsvector + ILIKE single OR query | ILIKE-only (slow at scale), pg_trgm (Phase 2) |
| Branded foods | Seed curated OFF subset (offline, quality-controlled) | Live OFF API only (network required, variable quality) |
| Idempotency key | `(source, source_id)` composite | `fdc_id` + separate `barcode` column (two mechanisms) |

## Consequences

### Positive

- Catalog grows from ~97 to ~12,400 products. New users see a rich product list immediately.
- Consumer-friendly names (`"Chicken breast, braised"` instead of verbose USDA descriptions).
- Portion recovery from ~11% to ~85%+ of USDA portions.
- tsvector search performs well up to 50K+ products.
- Branded/packaged foods available offline.
- Multi-source pipeline extensible: new source = new seeder class.

### Negative

- 2 new migrations, one with column restructure.
- Seed time increases from ~2s to ~30-60s (12K products + portions).
- `seeds/` directory grows to ~50 MB. SR Legacy JSON and OFF CSV may need separate download step.
- `fdc_id` removal is a breaking schema/API change.
- Name cleaning is heuristic — requires review of output in dry-run mode.

### Risks

| Risk | Mitigation |
|---|---|
| SR Legacy JSON ~40 MB load | Batch processing; switch to `ijson` streaming if needed |
| `unit_enum ADD VALUE` irreversible | `pcs` and `serving` are generically useful permanently |
| OFF data quality varies | Quality gates (completeness >= 0.65, Nutri-Score, 3/4 macros) filter aggressively |
| USDA name cleaning produces poor results | `clean_usda_name()` is unit-testable; include manual override table for worst cases |
| OFF CSV pre-filtering is a manual step | `prepare_off_data.py` documents the one-time process |
