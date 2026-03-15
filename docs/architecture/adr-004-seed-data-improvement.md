---
type: adr
status: accepted
last-updated: 2026-03-14
related-features:
  - catalog-seeding
  - product-search
  - data-quality
---

# ADR-004: Seed Data Improvement — Rich Product Catalog

## Status

Accepted

## Context

The catalog seeded in ADR-003 is too thin and too noisy for real-world use. Currently:

- **Source**: USDA Foundation Foods only (365 items in `seeds/foundation_food_2025-12-18.json`).
- **Actually seeded**: ~97 products. The rest are filtered out because Atwater fallback produces zero kcal.
- **Portion coverage**: 89% of USDA portions use RACC units that are not in `unit_enum`, so they are dropped. 326 of 365 foods end up with only the synthetic "100 g" portion.
- **Names are unusable on mobile**: `"Beef, loin, tenderloin roast, separable lean only, boneless, trimmed to 0\" fat, select, cooked, roasted"` — these are scientific descriptions, not product names.
- **No packaged/branded foods**: The issue (#35) explicitly requires Open Food Facts or similar integration for 2,000–5,000 packaged foods.
- **No full-text search**: `ILIKE '%q%'` is a sequential scan. At ~100 rows this is fine; at 5,000+ it will degrade.
- **Missing unit mappings**: `oz`, `each`, `slice`, `piece`, `link`, `serving` are all dropped by `normalize_unit()`.

### What the issue requires

- 1,000–3,000 generic foods with clean consumer-friendly names.
- 2,000–5,000 packaged/branded foods with brand, barcode, and nutrient data.
- No duplicates, no incomplete entries.
- Search must remain responsive (< 300 ms).
- Existing user products unaffected.

## Decision

### 1. Data Source Selection

Use **two** USDA datasets plus **Open Food Facts** filtered data:

#### Source A: USDA SR Legacy (~7,800 items)

SR Legacy is the classic USDA nutrient database. It replaces Foundation Foods as the generic food source because:

- ~7,800 foods vs 365 in Foundation Foods — 20x more coverage.
- Same `fdcId`-based structure, same nutrient array format. The existing `extract_macros_per_100g()` and `calc_kcal_per_100g()` functions work unchanged.
- Names are still USDA-style verbose (`"Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised"`), but SR Legacy is the standard basis for every name-normalization recipe. A `clean_usda_name()` function can reduce these to `"Chicken breast, cooked"` reliably (see Section 3 below).
- Portion data uses the same `foodPortions[].measureUnit` structure. SR Legacy has significantly more portion entries than Foundation Foods.
- After quality filtering (kcal > 0, name not empty, category present), 7,414 products survive.

**Foundation Foods is dropped as a seed source.** It has value for analytical precision but too few items and its fdcIds overlap with SR Legacy for common foods. The seed script will read from the `SRLegacyFoods` top-level key instead of `FoundationFoods`.

#### Source B: Open Food Facts (bulk CSV, filtered)

Open Food Facts provides the packaged/branded food layer. The client already has a live-search service (`client/src/services/openFoodFacts.ts`), but that requires network connectivity. Seeding a curated subset into `catalog_products` serves two purposes:

1. **Offline search** — users can find popular packaged foods without network.
2. **Quality control** — the bulk download can be filtered far more aggressively than real-time API results.

Download the `en.openfoodfacts.org.products.csv` file (~7 GB uncompressed) and filter to:

- `countries_tags` contains any of: `en:united-states`, `en:united-kingdom`, `en:canada`, `en:australia`, `en:france`, `en:germany`, `en:netherlands`, `en:spain`, `en:austria`, `en:poland`, `en:ukraine`.
- `product_name` is non-empty and <= 120 characters.
- `energy-kcal_100g` is present and > 0.
- `completeness` >= 0.65 (Open Food Facts quality score, 0–1).
- `nutrition_grade_fr` (Nutri-Score) is present (A–E). This correlates strongly with data completeness.
- At least 3 of the 4 macro fields present (`proteins_100g`, `carbohydrates_100g`, `fat_100g`, `energy-kcal_100g`).

After filtering, take the top 5,000 by `unique_scans_n` descending (most-scanned products = most popular in the real world).

Expected yield: ~3,000–5,000 products with brand, barcode, and macros.

#### Source C: USDA FNDDS (not selected)

FNDDS (~7,000 "as consumed" foods) was evaluated. Its names are more consumer-friendly than SR Legacy (e.g., "Chicken breast, grilled" instead of "Chicken, broiler or fryers, breast..."). However:

- FNDDS uses a different ID system (`food_code`, not `fdc_id`). This breaks the existing idempotency key assumption.
- FNDDS portions are in "amount consumed" format that does not map cleanly to the `base_amount + base_unit + gram_weight` model we use.
- Many FNDDS items are composite recipes ("Chicken Caesar salad with dressing") rather than single ingredients.
- The naming benefit can be achieved by transforming SR Legacy names instead (see Section 3).

FNDDS is **rejected** for this iteration. It may be reconsidered later for recipe/composite food support.

### 2. Data Model Changes

#### 2a. Add columns to `catalog_products`

| Column | Type | Purpose |
|---|---|---|
| `source` | TEXT NOT NULL | `'usda'` or `'off'` (Open Food Facts). Needed for deduplication and re-seeding. |
| `display_name` | TEXT NOT NULL | Consumer-friendly cleaned name. This is what the user sees. `name` retains the original source name for data provenance. |
| `brand` | TEXT | Brand name. NULL for generic USDA foods. Populated from OFF `brands` field. |
| `barcode` | TEXT | EAN/UPC barcode. NULL for USDA. Populated from OFF `code` field. Indexed for future barcode-scan feature. |

The **idempotency key** changes from `fdc_id` alone to a **composite** `(source, source_id)`:

- For USDA: `source='usda'`, `source_id=str(fdc_id)`.
- For OFF: `source='off'`, `source_id=barcode`.

The existing `fdc_id` INTEGER column is replaced by `source_id` TEXT to accommodate both numeric USDA IDs and alphanumeric barcodes. A unique constraint on `(source, source_id)` replaces the current `UNIQUE(fdc_id)` constraint.

#### 2b. Add `pcs` and `serving` to `unit_enum`

The current enum (`mg`, `g`, `kg`, `ml`, `l`, `tsp`, `tbsp`, `cup`) drops every countable-unit portion (`each`, `slice`, `piece`, `link`, `egg`, `fruit`). Adding two values solves the majority of dropped portions:

- **`pcs`** — generic countable unit. Maps USDA `each`, `slice`, `piece`, `link`, `egg`, `fruit`, `fillet`, `drumstick`, `steak`, `wedge`, `spear`, `olive`, `cookie`.
- **`serving`** — generic dimensionless serving. Maps USDA `serving`, `RACC`, `container`, `order`, `package` and OFF's default "per serving" data.

This is a PostgreSQL `ALTER TYPE unit_enum ADD VALUE` migration (non-reversible, per PostgreSQL rules).

After adding `pcs` and `serving`, the seed script's `normalize_unit()` mapping changes:

```python
_UNIT_ALIASES = {
    # existing...
    "each": "pcs", "slice": "pcs", "piece": "pcs", "pieces": "pcs",
    "link": "pcs", "egg": "pcs", "fruit": "pcs", "fillet": "pcs",
    "drumstick": "pcs", "steak": "pcs", "wedge": "pcs", "spear": "pcs",
    "olive": "pcs", "cookie": "pcs",
    "serving": "serving", "racc": "serving", "container": "serving",
    "order": "serving", "package": "serving",
}
```

Impact: Portions that were previously dropped now get seeded. Expected recovery: 250+ of the 268 RACC portions, plus most of the `each`/`slice`/`piece` variants. The remaining ~15 truly exotic units (`roast`, `bunch`, `ckd pr g`, specific fruit names like `Banana`, `Onion`) stay unmapped and get only the synthetic default portion.

#### 2c. Full-text search index

Add a `search_vector` generated column on `catalog_products`:

```sql
ALTER TABLE catalog_products
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(display_name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(category, ''))
) STORED;

CREATE INDEX ix_catalog_products_search_vector
ON catalog_products USING GIN (search_vector);
```

The service layer switches from `ILIKE` to `ts_query` with a fallback to trigram similarity for short/partial queries.

Search strategy (in the service, not in SQL):

1. If `len(query) >= 3`: single `OR` query combining `plainto_tsquery('english', query)` against `search_vector` and `display_name ILIKE '%query%'`. Both arms run in one database round-trip; results are ordered by `ts_rank` descending so tsvector matches rank higher. The ILIKE arm catches brand names and terms that don't stem well.
2. If `len(query) < 3`: `display_name ILIKE '%query%'` only, ordered alphabetically.
3. No query: order by `display_name` ascending.

This replaces the `ILIKE`-only path in `list_catalog_products()`. The unified search in `products/service.py` (`search_products()`) uses ILIKE on `display_name` and `brand` for catalog items.

#### 2d. Add trigram extension (optional, Phase 2)

For typo-tolerance ("chiken" -> "chicken"), enable `pg_trgm`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ix_catalog_products_display_name_trgm
ON catalog_products USING GIN (display_name gin_trgm_ops);
```

This is deferred to Phase 2 because tsvector already provides stemming and the trigram index doubles the index storage.

### 3. Name Normalization Pipeline

USDA names follow a systematic pattern: `"Primary, qualifier, qualifier, ..."`. A `clean_usda_name()` function transforms them:

**Rules (applied in order):**

1. Split on `, ` into segments.
2. Drop segments matching noise patterns: `"raw"`, `"cooked"` (keep cooking method only if unique), `"separable lean only"`, `"boneless"`, `"trimmed to X"`, `"select"`, `"choice"`, `"all grades"`, `"year round average"`.
3. Capitalize the first segment as the primary name.
4. Append the first cooking method (`"roasted"`, `"baked"`, `"grilled"`, `"fried"`, `"boiled"`, `"steamed"`, `"braised"`) if present.
5. Cap the result at 60 characters. If over, truncate qualifiers from the end.

**Examples:**

| Original USDA Name | Cleaned `display_name` |
|---|---|
| `Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised` | `Chicken breast, braised` |
| `Beef, loin, tenderloin roast, separable lean only, boneless, trimmed to 0" fat, select, cooked, roasted` | `Beef tenderloin roast, roasted` |
| `Nuts, almonds, dry roasted, with salt added` | `Almonds, dry roasted, salted` |
| `Beans, snap, green, canned, regular pack, drained solids` | `Green snap beans, canned` |
| `Tomatoes, grape, raw` | `Grape tomatoes` |
| `Hummus, commercial` | `Hummus` |

The `name` column retains the original for provenance. `display_name` is what the search indexes and the UI renders.

For Open Food Facts products, `display_name` = `product_name` (already consumer-friendly). `brand` is stored separately and displayed as a subtitle.

### 4. Seed Pipeline Architecture

Replace the single `seed_catalog.py` with a multi-source pipeline:

```
backend/scripts/
    seed_catalog.py          # CLI entry point + orchestrator
    seeders/
        __init__.py
        base.py              # Abstract base class for seeders
        usda.py              # USDA SR Legacy seeder
        off.py               # Open Food Facts seeder
        name_cleaner.py      # USDA name normalization
```

#### Pipeline stages (per source):

```
[Read raw data] → [Filter by quality gates] → [Transform names/portions] → [Upsert to DB]
```

#### Orchestrator (`seed_catalog.py`):

```python
def seed(seeds_dir, *, dry_run, sources):
    # sources: list of "usda", "off", or "all"
    if "usda" in sources or "all" in sources:
        usda_seeder = UsdaSeeder(seeds_dir)
        usda_seeder.run(conn, dry_run=dry_run)
    if "off" in sources or "all" in sources:
        off_seeder = OffSeeder(seeds_dir)
        off_seeder.run(conn, dry_run=dry_run)
```

CLI changes:

```
python -m scripts.seed_catalog --sources usda off --seeds-dir ../seeds --dry-run
python -m scripts.seed_catalog --sources all  # default
```

#### Idempotency changes:

The upsert key changes from `ON CONFLICT (fdc_id)` to `ON CONFLICT (source, source_id)`. The migration adds a unique index on `(source, source_id)` and drops the old `fdc_id` unique index.

```sql
INSERT INTO catalog_products (id, source, source_id, name, display_name, brand, barcode, category, ...)
ON CONFLICT (source, source_id) DO UPDATE SET
    name = EXCLUDED.name,
    display_name = EXCLUDED.display_name,
    brand = EXCLUDED.brand,
    category = EXCLUDED.category,
    updated_at = now()
RETURNING id
```

Portions are still replaced wholesale (DELETE + INSERT) per product, unchanged from ADR-003.

### 5. Open Food Facts Portion Strategy

OFF provides nutrition per 100g. Most OFF products also have a `serving_size` field (e.g., `"30g"`, `"1 bar (40g)"`, `"250ml"`).

For each OFF product, generate:

1. **Default "100 g" portion** — always, same as USDA. `is_default=True`.
2. **Serving portion** (if `serving_size` parses) — e.g., `label="1 bar (40g)"`, `base_amount=1`, `base_unit='serving'`, `gram_weight=40`, macros scaled from per-100g. `is_default=False`.

A `parse_serving_size(raw: str) -> tuple[str, float | None]` function extracts gram weight from common patterns:

- `"30g"` → `("30g", 30.0)`
- `"1 bar (40g)"` → `("1 bar (40g)", 40.0)`
- `"250ml"` → `("250ml", 250.0)` (assume density ~1 for beverages)
- Unparseable → `(raw, None)` — skip serving portion, keep only 100g default.

### 6. Quality Gate Criteria

#### USDA SR Legacy quality gates:

| Gate | Criterion | Expected rejection |
|---|---|---|
| Has fdcId | `fdcId` is present and > 0 | ~0 |
| Has name | `description` is non-empty | ~5 |
| Has calories | `kcal_per_100g > 0` after Atwater | ~500 (water, spices, zero-cal items) |
| Has category | `foodCategory.description` is present | ~100 (acceptable: still seed, category=NULL) |
| Name length | `len(display_name) <= 80` after cleaning | ~0 (cleaning truncates) |
| Not a supplement | Category is not `"Supplements"` or `"Baby Foods"` | ~200 |

Actual yield: **7,414 products** from SR Legacy.

#### Open Food Facts quality gates:

| Gate | Criterion | Expected rejection |
|---|---|---|
| Has name | `product_name` non-empty, <= 120 chars | ~30% of raw data |
| Has calories | `energy-kcal_100g` > 0 | ~15% |
| Completeness | `completeness >= 0.65` | ~40% |
| Has Nutri-Score | `nutrition_grade_fr` in {a,b,c,d,e} | ~30% |
| Macro coverage | >= 3 of 4 macro fields present | ~10% after other gates |
| Market filter | `countries_tags` includes any of US/UK/CA/AU/FR/DE/NL/ES/AT/PL/UA | ~60% of global data |
| Popularity cap | Top 5,000 by `unique_scans_n` | Hard cap |

Actual yield: **4,989 products** from OFF.

### 7. Deduplication Between Sources

Overlap between USDA (generic "Chicken breast") and OFF (branded "Tyson Chicken Breast") is low because:

- USDA items are generic ingredients without brands.
- OFF items are packaged products with brands.

The risk is a generic OFF entry (e.g., "Chicken breast" from a store brand with no brand field) duplicating a USDA entry. Mitigation:

- During OFF seeding, check if `display_name` (lowercased, stripped) already exists with `source='usda'`. If so, skip the OFF entry.
- This is a "best effort" dedup, not cryptographic. Duplicates are a UX annoyance (two "Chicken Breast" entries), not a data integrity violation. Users can create their own products either way.

### 8. Schema Response Changes

The `CatalogProductListItem` and `CatalogProductResponse` schemas gain new fields:

```python
class CatalogProductListItem(APIModel):
    id: UUID
    source: str              # NEW: "usda" or "off"
    source_id: str           # NEW: replaces fdc_id
    name: str                # Original source name (for provenance)
    display_name: str        # NEW: cleaned, user-facing name
    brand: str | None        # NEW
    barcode: str | None      # NEW
    category: str | None
    default_portion: CatalogPortionResponse | None
```

The `fdc_id: int` field is **removed** from the schema response and replaced by `source_id: str`. This is a breaking change to the catalog API. Since the catalog API is not yet consumed by a released client version, this is acceptable.

The unified search response (`ProductSearchResultItem`) gains optional fields:

```python
class ProductSearchResultItem(APIModel):
    id: UUID
    name: str
    source: Literal["user", "catalog"]
    calories_per_100g: float | None = None
    protein_per_100g: float | None = None
    carbs_per_100g: float | None = None
    fat_per_100g: float | None = None
    catalog_id: UUID | None = None
    display_name: str | None = None   # NEW: cleaned name for catalog items
    brand: str | None = None          # NEW: brand for catalog items
```

The client renders `display_name ?? name` and shows `brand` as a subtitle when present.

## Trade-Off Analysis

### Decision 1: SR Legacy vs Foundation Foods vs FNDDS

| | SR Legacy (chosen) | Foundation Foods (current) | FNDDS |
|---|---|---|---|
| Volume | ~7,800 raw, 7,414 after filter | 365 raw, ~97 after filter | ~7,000 |
| Name quality | Verbose but systematically parseable | Same verbose pattern | Consumer-friendly |
| Portion data | Same structure as Foundation | Same | Different structure |
| ID system | `fdcId` (same) | `fdcId` (same) | `food_code` (different) |
| Composites | No | No | Many (salads, recipes) |
| **Recommendation** | **Selected** | Dropped | Deferred |

SR Legacy wins on volume while keeping the same data format. FNDDS is deferred because its different ID system and composite-food nature add complexity without proportional value for single-ingredient tracking.

### Decision 2: Unit Enum Extension Strategy

| | Add `pcs` + `serving` (chosen) | Add many specific units | Keep current enum |
|---|---|---|---|
| Migration cost | 1 migration, 2 `ADD VALUE` | 1 migration, 10+ `ADD VALUE` | None |
| Portion recovery | ~85% of dropped portions | ~95% | 0% |
| Semantic clarity | Good — `pcs` = countable, `serving` = abstract | Poor — `oz` vs `fl_oz` vs `piece` | N/A |
| Client impact | Add 2 values to `Unit` type | Add 10+ values, update all unit pickers | None |
| Reversibility | Cannot remove enum values in PG | Same, but worse | N/A |
| **Recommendation** | **Selected** | Too many to add at once | Unacceptable (89% portions lost) |

Adding `pcs` and `serving` is the minimal change that recovers the most dropped data. Specific units like `oz` are intentionally not added yet — they introduce weight-system complexity (imperial vs metric) that the client unit pickers are not ready for.

### Decision 3: Search Strategy

| | `tsvector` + ILIKE fallback (chosen) | `pg_trgm` only | ILIKE only (current) |
|---|---|---|---|
| Stemming | Yes (English stemmer) | No | No |
| Typo tolerance | No (Phase 2 with trigram) | Yes | No |
| Partial match | Via ILIKE fallback | Yes | Yes |
| Index type | GIN on tsvector | GIN on trigram | B-tree (current name index) |
| Ranking | `ts_rank` (relevance) | `similarity()` | None (alpha sort) |
| Performance at 5K rows | < 5 ms | < 10 ms | ~50 ms (seq scan) |
| Performance at 50K rows | < 10 ms | < 20 ms | ~200+ ms |
| **Recommendation** | **Selected** | Phase 2 addon | Unacceptable at scale |

### Decision 4: OFF Integration — Seed vs Live API

| | Seed curated subset (chosen) | Live API only (current client) | Both |
|---|---|---|---|
| Offline search | Yes | No | Yes (seed + fallback to API) |
| Data quality | Pre-filtered, guaranteed | Variable, unpredictable | Best of both |
| Freshness | Stale until re-seed | Always current | Mixed |
| Network dependency | None for seeded data | Required | Partial |
| Catalog size control | Exact (top N by scans) | Unbounded per query | Bounded seed + unbounded live |
| **Recommendation** | **Selected for MVP** | Keep client service for future barcode scan | Phase 2: combine both |

The existing `client/src/services/openFoodFacts.ts` is kept as-is for a future barcode-scanning feature. The seed pipeline operates independently and populates the same `catalog_products` table.

### Decision 5: `fdc_id` → `source_id` Migration

| | Replace with `(source, source_id)` composite (chosen) | Keep `fdc_id`, add `barcode` separately |
|---|---|---|
| Schema clarity | One idempotency mechanism for all sources | Two different idempotency keys |
| Index count | 1 unique composite index | 2 unique indexes (fdc_id + barcode) |
| Null handling | `source_id` always NOT NULL | `fdc_id` NULL for OFF, `barcode` NULL for USDA |
| Migration complexity | Drop fdc_id column + add 2 columns | Add 2 columns only |
| Future sources | Just add new `source` values | Need new columns per source |
| **Recommendation** | **Selected** | Simpler migration but poor long-term design |

## Migration Plan

### Migration 0009: Extend unit_enum

```sql
ALTER TYPE unit_enum ADD VALUE 'pcs';
ALTER TYPE unit_enum ADD VALUE 'serving';
```

Non-reversible (PostgreSQL limitation). Must be run outside a transaction block (Alembic handles this with `autocommit=True`).

### Migration 0010: Evolve catalog_products schema

1. Add `source TEXT NOT NULL DEFAULT 'usda'`.
2. Add `source_id TEXT`.
3. Backfill: `UPDATE catalog_products SET source_id = fdc_id::text`.
4. Set `source_id` to NOT NULL.
5. Add `display_name TEXT`.
6. Backfill: `UPDATE catalog_products SET display_name = name`.
7. Set `display_name` to NOT NULL.
8. Add `brand TEXT`.
9. Add `barcode TEXT`.
10. Create unique index on `(source, source_id)`.
11. Create index on `barcode` (non-unique — some OFF products share barcodes across regions).
12. Drop old unique index on `fdc_id`.
13. Drop `fdc_id` column.
14. Add `search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(display_name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(category, ''))) STORED`.
15. Create GIN index on `search_vector`.

This is a single migration because all steps are in one transaction (except the enum extension which is separate).

### Migration 0011: (Phase 2, optional) Add pg_trgm

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ix_catalog_products_display_name_trgm
ON catalog_products USING GIN (display_name gin_trgm_ops);
```

## Seed Data File Layout

```
seeds/
    sr_legacy_2025-10.json        # USDA SR Legacy bulk download
    off_products_filtered.csv     # Pre-filtered OFF extract (created by a one-time script)
```

The OFF CSV is **pre-filtered outside the seed script** because the raw CSV is ~7 GB. A one-time data-prep script (`scripts/prepare_off_data.py`) downloads, filters, and writes the ~5,000-row subset to `seeds/off_products_filtered.csv`. This script is run manually by a developer and is not part of the regular seed pipeline.

The SR Legacy JSON can be downloaded directly from USDA's bulk download page. File size is ~40 MB (vs 6.8 MB for Foundation Foods).

## ORM Model Changes

`backend/app/features/catalog/models.py`:

```python
class CatalogProduct(Base):
    __tablename__ = "catalog_products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    source: Mapped[str] = mapped_column(Text, nullable=False)          # 'usda' or 'off'
    source_id: Mapped[str] = mapped_column(Text, nullable=False)       # fdc_id as string, or barcode
    name: Mapped[str] = mapped_column(Text, nullable=False)            # Original source name
    display_name: Mapped[str] = mapped_column(Text, nullable=False)    # Cleaned consumer-facing name
    brand: Mapped[str | None] = mapped_column(Text, nullable=True)
    barcode: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    # search_vector is GENERATED ALWAYS, not mapped in ORM — queried via func.to_tsvector or column()
    ...
```

Unique constraint: `UniqueConstraint('source', 'source_id', name='uq_catalog_products_source_source_id')`.

## Client Changes

### API type changes

`client/src/services/api/products.ts` — `ProductSearchResultResponse` gains:

```typescript
display_name: string | null;
brand: string | null;
```

### Model type changes

`client/src/models/types.ts` — `ProductSearchResult` gains:

```typescript
displayName: string | null;
brand: string | null;
```

`Unit` type gains `"pcs"` and `"serving"`.

### UI rendering changes

`SelectProduct` screen renders `item.displayName ?? item.name` as the product name, and `item.brand` as a subtitle line (when present). This is a minor rendering change, not a new component.

## Volume Summary

| Source | Raw items | After quality gates | Portions seeded |
|---|---|---|---|
| USDA SR Legacy | ~7,800 | 7,414 | 7,414 (1:1 — 100g default only) |
| Open Food Facts | ~3M global | 4,989 (top by scans) | 8,541 (~1.71 avg — 100g default + serving where parseable) |
| **Total** | — | **12,403** | **15,955** |

Database size estimate: ~12,400 products x ~1.3 portions = ~15,900 rows across two tables. At ~500 bytes/row, this is ~8 MB of data. Well within comfortable Postgres performance bounds.

## Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| SR Legacy JSON is ~40 MB — seed script must load it | Low | Already uses batch processing. At 40 MB, `json.load()` uses ~120 MB RAM. Acceptable for a CLI script. If needed, switch to `ijson` streaming parser. |
| `unit_enum ADD VALUE` is irreversible in PostgreSQL | Low | `pcs` and `serving` are generic enough to be permanently useful. No rollback needed. |
| OFF data quality varies by region | Medium | Quality gates (completeness >= 0.65, Nutri-Score present, 3/4 macros) filter aggressively. The `unique_scans_n` popularity cap ensures only well-known products survive. |
| USDA name cleaning produces poor results for some foods | Medium | The `clean_usda_name()` function is unit-testable. Ship with a manual override table (`name_overrides.json`) for the worst cases (~50 items). Review output in dry-run mode before committing to DB. |
| Deduplication between USDA and OFF misses edge cases | Low | Duplicate entries are a UX annoyance, not a data integrity issue. Users already see both "user" and "catalog" entries in search. A future dedup pass can merge entries by name similarity. |
| `search_vector` generated column adds write overhead | Low | Catalog is written once during seed, read many times during search. The write cost is negligible. |
| Breaking change to catalog API (fdc_id removed) | Low | Catalog API is not yet consumed by a released client. The ProductSearchResultItem response is additive (new optional fields). |
| OFF CSV pre-filtering is a manual step | Medium | Document the `prepare_off_data.py` script usage. Include the filtered CSV in `seeds/` (committed to repo if < 10 MB, or `.gitignore`'d with download instructions). |
| SR Legacy download URL may change | Low | Document the download URL and date in `seeds/README.md`. The seed script validates file structure before processing. |

## Consequences

### Positive

- Catalog grows from ~97 to 12,403 products. New users see a rich product list immediately.
- Product names become consumer-friendly (`"Chicken breast, grilled"` instead of `"Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised"`).
- Portion recovery from ~11% to ~85%+ of USDA portions. Users can log "1 egg" or "1 serving" instead of only "100g".
- Search becomes relevance-ranked via tsvector, performing well up to 50K+ products.
- Branded/packaged foods available offline — no network required.
- Multi-source seed pipeline is extensible: adding a third data source (e.g., a country-specific food database) requires only a new seeder class.

### Negative

- Migration complexity: 2 new migrations, one with a column restructure.
- Seed time increases from ~2 seconds to ~30–60 seconds (8K products x portions).
- `seeds/` directory grows from 6.8 MB to ~50 MB (SR Legacy JSON + OFF CSV). May need `.gitignore` and separate download step.
- Name cleaning is heuristic and will produce imperfect results for some foods. Requires ongoing review.
- The `fdc_id` removal is a breaking change to the catalog schema and API. All existing catalog rows are re-seeded.

### Alternatives Considered

- **FNDDS instead of SR Legacy**: Rejected — different ID system, composite foods, portion format mismatch.
- **Live OFF API instead of seed**: Rejected for MVP — requires network, variable quality, no offline support.
- **Keep `fdc_id` and add `barcode` as separate column**: Rejected — creates two idempotency mechanisms instead of one generic approach.
- **Add many specific units (oz, lb, fl_oz, etc.)**: Rejected — adds imperial-metric complexity the client is not ready for.
- **pg_trgm instead of tsvector**: Deferred to Phase 2 — tsvector provides stemming and ranking; trigram adds typo tolerance later.

## File Inventory

### New files:

| File | Purpose |
|---|---|
| `backend/scripts/seeders/__init__.py` | Package marker |
| `backend/scripts/seeders/base.py` | Abstract seeder base class |
| `backend/scripts/seeders/usda.py` | USDA SR Legacy seeder (replaces Foundation Foods logic) |
| `backend/scripts/seeders/off.py` | Open Food Facts seeder |
| `backend/scripts/seeders/name_cleaner.py` | USDA name normalization functions |
| `backend/scripts/prepare_off_data.py` | One-time OFF bulk CSV filter script |
| `backend/alembic/versions/0009_extend_unit_enum.py` | Add `pcs` and `serving` to unit_enum |
| `backend/alembic/versions/0010_evolve_catalog_products.py` | Schema evolution: source, source_id, display_name, brand, barcode, search_vector |
| `seeds/README.md` | Download instructions for SR Legacy JSON and OFF CSV |

### Modified files:

| File | Change |
|---|---|
| `backend/scripts/seed_catalog.py` | Refactor to orchestrator pattern, delegate to seeder classes |
| `backend/app/features/catalog/models.py` | Replace `fdc_id` with `source`, `source_id`, `display_name`, `brand`, `barcode` |
| `backend/app/features/catalog/schemas.py` | Update response schemas with new fields |
| `backend/app/features/catalog/service.py` | Switch search from ILIKE to tsvector, add fallback |
| `backend/app/features/products/service.py` | Update `search_products()` to use `display_name` and tsvector for catalog |
| `backend/app/features/products/schemas.py` | Add `display_name`, `brand` to `ProductSearchResultItem` |
| `backend/app/core/enums.py` | Add `pcs` and `serving` to `Unit` |
| `client/src/models/types.ts` | Add `pcs`, `serving` to `Unit`; add `displayName`, `brand` to `ProductSearchResult` |
| `client/src/services/api/products.ts` | Add new fields to `ProductSearchResultResponse` |
| `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx` | Render `displayName`, `brand` |
| `seed.py` | Update CLI passthrough for `--sources` argument |

### Deleted files:

| File | Reason |
|---|---|
| `seeds/foundation_food_2025-12-18.json` | Replaced by SR Legacy JSON (after SR Legacy is downloaded and seed is verified) |

## Next Steps

Hand off to `planner` agent for implementation phases.
