---
type: plan
status: approved
created: 2026-03-14
related-adr: adr-004-seed-data-improvement
---

# Implementation Plan: Seed Data Improvement

## Overview

Evolve the catalog from ~97 Foundation Foods products to ~5,500-8,500 products by adding USDA SR Legacy (~2,500-3,500 generic foods) and Open Food Facts (~3,000-5,000 packaged foods). This requires database schema changes (new columns, enum values, full-text search), a refactored multi-source seed pipeline with name normalization, backend search improvements, and minor client UI changes.

## Success Criteria

- [ ] `unit_enum` includes `pcs` and `serving` values
- [ ] `catalog_products` has `source`, `source_id`, `display_name`, `brand`, `barcode`, `search_vector` columns; `fdc_id` column removed
- [ ] Unique constraint on `(source, source_id)` replaces old `UNIQUE(fdc_id)`
- [ ] GIN index on `search_vector` tsvector generated column
- [ ] USDA name cleaner produces consumer-friendly names with >90% quality (validated by test suite)
- [ ] OFF Parquet filter script produces a CSV with ~5,000 rows
- [ ] Seed pipeline seeds USDA SR Legacy and OFF data idempotently
- [ ] Catalog search uses tsvector with ILIKE fallback
- [ ] Unified product search includes `display_name` and `brand` in results
- [ ] Client renders `displayName` with brand subtitle for catalog items
- [ ] All existing tests pass; new tests cover name cleaner, quality gates, search, and OFF parsing
- [ ] `ruff check`, `tsc --noEmit`, `pytest`, `pnpm test` all green after each phase

## Assumptions

- SR Legacy JSON top-level key is `SRLegacyFoods` (validated: line 1 of seed file)
- SR Legacy food structure matches Foundation Foods (`fdcId`, `description`, `foodCategory`, `foodNutrients`, `foodPortions`) (validated: same field names in seed file)
- Parquet file has columns matching Open Food Facts schema (`code`, `product_name`, `brands`, `countries_en`, `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`, `completeness`, `nutrition_grade_fr`, `unique_scans_n`, `serving_size`) -- needs user confirmation
- `pyarrow` or `pandas` not currently in backend dependencies -- `prepare_off_data.py` will need `pyarrow`+`pandas` as a dev/script dependency
- The catalog API is not consumed by a released client, so breaking changes to `fdc_id` removal are acceptable (validated in ADR)
- Test DB `conftest.py` creates `unit_enum` with hardcoded values -- must be updated to include `pcs` and `serving`

## Architecture Changes

Per ADR-004. No deviations from the approved architecture.

## Files Affected

### New Files

| File | Purpose |
|------|---------|
| `backend/scripts/seeders/__init__.py` | Package marker |
| `backend/scripts/seeders/base.py` | Abstract seeder base class |
| `backend/scripts/seeders/usda.py` | USDA SR Legacy seeder |
| `backend/scripts/seeders/off.py` | Open Food Facts seeder |
| `backend/scripts/seeders/name_cleaner.py` | USDA name normalization |
| `backend/scripts/prepare_off_data.py` | One-time Parquet-to-CSV filter script |
| `backend/alembic/versions/0009_extend_unit_enum.py` | Add `pcs`, `serving` to unit_enum |
| `backend/alembic/versions/0010_evolve_catalog_products.py` | Schema evolution migration |
| `backend/tests/scripts/__init__.py` | Test package marker |
| `backend/tests/scripts/test_name_cleaner.py` | Unit tests for USDA name normalization |
| `backend/tests/scripts/test_usda_seeder.py` | Tests for USDA seeder quality gates and parsing |
| `backend/tests/scripts/test_off_seeder.py` | Tests for OFF seeder quality gates and serving parser |

### Modified Files

| File | Change |
|------|--------|
| `backend/app/core/enums.py` | Add `pcs = "pcs"` and `serving = "serving"` to `Unit` |
| `backend/app/features/catalog/models.py` | Replace `fdc_id` with `source`, `source_id`, `display_name`, `brand`, `barcode`; add `search_vector` column property; add unique constraint |
| `backend/app/features/catalog/schemas.py` | Replace `fdc_id: int` with `source: str`, `source_id: str`, `display_name: str`, `brand: str | None`, `barcode: str | None` |
| `backend/app/features/catalog/service.py` | Switch search from ILIKE to tsvector + ILIKE fallback; order by `ts_rank` |
| `backend/app/features/catalog/router.py` | Update response construction to use new fields |
| `backend/app/features/products/schemas.py` | Add `display_name: str | None = None`, `brand: str | None = None` to `ProductSearchResultItem` |
| `backend/app/features/products/service.py` | Use `display_name` in catalog search; pass new fields in `ProductSearchResultItem` |
| `backend/scripts/seed_catalog.py` | Refactor to orchestrator: CLI with `--sources` arg, delegates to seeder classes |
| `backend/tests/conftest.py` | Update `unit_enum` creation to include `pcs` and `serving` |
| `backend/tests/services/test_catalog.py` | Update helpers to use `source`/`source_id`/`display_name` instead of `fdc_id`; add tsvector search tests |
| `backend/tests/api/test_catalog.py` | Update helpers and assertions for new schema fields |
| `backend/tests/services/test_products_db.py` | Update `_make_catalog_product` helper; add tests for `display_name`/`brand` in search results |
| `backend/tests/factories.py` | Add `create_catalog_product` and `create_catalog_portion` factories |
| `backend/pyproject.toml` | Add `pyarrow` and `pandas` to dev dependencies (for prepare_off_data.py only) |
| `seed.py` | Forward `--sources` argument |
| `client/src/models/types.ts` | Add `pcs`, `serving` to `Unit`; add `displayName`, `brand` to `ProductSearchResult` |
| `client/src/services/api/products.ts` | Add `display_name`, `brand` to `ProductSearchResultResponse` |
| `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx` | Render `displayName ?? name`; show brand subtitle |

### Deleted Files

| File | When |
|------|------|
| `seeds/foundation_food_2025-12-18.json` | After Phase 5 verification (if it exists) |

## Implementation Phases

### Phase 1: Database Schema & Enum (Backend Foundation)

**Estimate**: 5 files modified, 2 new files

No other phase can proceed until migrations exist, because the ORM model and all queries depend on the new columns.

**1.1 Extend Unit enum in Python** (`backend/app/core/enums.py`)
- Action: Add `pcs = "pcs"` and `serving = "serving"` to the `Unit` StrEnum class, after `cup`
- Why: All downstream code (models, seeders, client) depends on these values existing
- Dependencies: None
- Risk: Low
- Test: `ruff check app/`

**1.2 Update test conftest enum creation** (`backend/tests/conftest.py`)
- Action: In the `test_engine` fixture, update the `CREATE TYPE unit_enum` SQL to include `'pcs'` and `'serving'` in the enum values list. Change to: `CREATE TYPE unit_enum AS ENUM ('mg', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'pcs', 'serving');`
- Why: Tests create the enum from scratch; without this, any test using `pcs` or `serving` will fail with a Postgres enum error
- Dependencies: 1.1
- Risk: Low
- Test: `pytest` (existing tests still pass)

**1.3 Create migration 0009: extend unit_enum** (`backend/alembic/versions/0009_extend_unit_enum.py`)
- Action: Create Alembic migration with `revision = "0009_extend_unit_enum"`, `down_revision = "0008_catalog_portions"`. Use `op.execute("ALTER TYPE unit_enum ADD VALUE IF NOT EXISTS 'pcs'")` and same for `'serving'`. Set `autocommit = True` in the Alembic migration context (required for ADD VALUE outside transaction). No `downgrade()` body (non-reversible).
- Why: PostgreSQL requires ADD VALUE outside a transaction block
- Dependencies: 1.1
- Risk: Medium -- `ADD VALUE` is irreversible. Must use `schema_editor=True` or `autocommit=True` context. Alembic handles this via `with op.get_context().autocommit_block():`
- Test: `alembic upgrade head` (manual verification against dev DB)

**1.4 Evolve CatalogProduct model** (`backend/app/features/catalog/models.py`)
- Action: Remove `fdc_id` column. Add columns: `source` (Text, NOT NULL), `source_id` (Text, NOT NULL), `display_name` (Text, NOT NULL), `brand` (Text, nullable), `barcode` (Text, nullable). Add `search_vector` as a `mapped_column` using `Computed` with the tsvector expression. Add `__table_args__` with `UniqueConstraint('source', 'source_id', name='uq_catalog_products_source_source_id')`. Remove old `index=True` on `fdc_id`. Add `Index` on `barcode`.
- Why: The model must match the DB schema for all subsequent service and test code
- Dependencies: 1.3
- Risk: Medium -- Must use `sqlalchemy.schema.Computed` for generated column; syntax: `mapped_column(TSVECTOR, Computed("to_tsvector('english', coalesce(display_name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(category, ''))"), nullable=True)`. The column is read-only in ORM.
- Test: `ruff check app/` (model compiles)

**1.5 Create migration 0010: evolve catalog_products** (`backend/alembic/versions/0010_evolve_catalog_products.py`)
- Action: Create migration with `revision = "0010_evolve_catalog_products"`, `down_revision = "0009_extend_unit_enum"`. Steps in `upgrade()`:
  1. `op.add_column('catalog_products', sa.Column('source', sa.Text(), nullable=False, server_default='usda'))`
  2. `op.add_column('catalog_products', sa.Column('source_id', sa.Text(), nullable=True))`
  3. `op.execute("UPDATE catalog_products SET source_id = fdc_id::text")`
  4. `op.alter_column('catalog_products', 'source_id', nullable=False)`
  5. `op.add_column('catalog_products', sa.Column('display_name', sa.Text(), nullable=True))`
  6. `op.execute("UPDATE catalog_products SET display_name = name")`
  7. `op.alter_column('catalog_products', 'display_name', nullable=False)`
  8. `op.add_column('catalog_products', sa.Column('brand', sa.Text(), nullable=True))`
  9. `op.add_column('catalog_products', sa.Column('barcode', sa.Text(), nullable=True))`
  10. `op.create_unique_constraint('uq_catalog_products_source_source_id', 'catalog_products', ['source', 'source_id'])`
  11. `op.create_index('ix_catalog_products_barcode', 'catalog_products', ['barcode'])`
  12. `op.drop_index('ix_catalog_products_fdc_id', table_name='catalog_products')`
  13. `op.drop_column('catalog_products', 'fdc_id')`
  14. Remove the `server_default` from `source` column: `op.alter_column('catalog_products', 'source', server_default=None)`
  15. `op.execute("""ALTER TABLE catalog_products ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(display_name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(category, ''))) STORED""")` -- raw SQL because Alembic doesn't natively handle GENERATED ALWAYS
  16. `op.create_index('ix_catalog_products_search_vector', 'catalog_products', ['search_vector'], postgresql_using='gin')`
- `downgrade()`: Reverse all steps (add fdc_id back, drop new columns, etc.)
- Why: Safe migration pattern: add nullable first, backfill, then set NOT NULL
- Dependencies: 1.3, 1.4
- Risk: High -- Complex migration with many steps. Must be tested against a real DB. The generated column requires raw SQL.
- Test: `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` (manual)

**Verification**: `cd backend && ruff check app/ && pytest` (all existing tests will FAIL at this point because test helpers still use `fdc_id` -- that's expected and fixed in Phase 2)

---

### Phase 2: Update Schemas, Service, Router & Tests (Backend API Layer)

**Estimate**: 9 files modified, 0 new files

Depends on Phase 1 (model changes). This phase makes the API layer match the new model and fixes all broken tests.

**2.1 Update catalog schemas** (`backend/app/features/catalog/schemas.py`)
- Action: In `CatalogProductListItem`, remove `fdc_id: int`. Add `source: str`, `source_id: str`, `display_name: str`, `brand: str | None`, `barcode: str | None`. `CatalogProductResponse` inherits from `CatalogProductListItem` and needs no changes.
- Why: Response schema must match the new model
- Dependencies: Phase 1
- Risk: Low
- Test: `ruff check app/`

**2.2 Update product search schema** (`backend/app/features/products/schemas.py`)
- Action: Add two optional fields to `ProductSearchResultItem`: `display_name: str | None = None` and `brand: str | None = None`
- Why: Unified search needs to return display_name and brand for catalog items
- Dependencies: None (additive change)
- Risk: Low
- Test: `ruff check app/`

**2.3 Update catalog service search** (`backend/app/features/catalog/service.py`)
- Action: Modify `list_catalog_products()`:
  - Import `func` from sqlalchemy and `column` from sqlalchemy (for search_vector access)
  - When `search` is provided and `len(search) >= 3`:
    - Build `ts_query = func.plainto_tsquery('english', search)`
    - Filter: `.where(column('search_vector').op('@@')(ts_query))`
    - Order by: `func.ts_rank(column('search_vector'), ts_query).desc()`
  - If tsvector returns 0 results, fall back to `CatalogProduct.display_name.ilike(f"%{search}%")`
  - If `len(search) < 3`, use ILIKE on `display_name` directly (too short for meaningful tsvector)
  - Default ordering (no search): `CatalogProduct.display_name.asc()` instead of `CatalogProduct.name.asc()`
- Why: tsvector provides stemming and relevance ranking for the larger catalog
- Dependencies: 1.4 (model with search_vector)
- Risk: Medium -- The `column('search_vector')` approach works for generated columns not mapped in ORM. Must test carefully.
- Test: Unit tests in Phase 2.7

**2.4 Update catalog router** (`backend/app/features/catalog/router.py`)
- Action: Update response construction in both endpoints to use new fields:
  - `CatalogProductListItem(id=p.id, source=p.source, source_id=p.source_id, name=p.name, display_name=p.display_name, brand=p.brand, barcode=p.barcode, category=p.category, default_portion=...)`
  - Same for `CatalogProductResponse`
- Why: Router must pass new model fields to schema
- Dependencies: 2.1
- Risk: Low
- Test: Integration tests in Phase 2.8

**2.5 Update products service search** (`backend/app/features/products/service.py`)
- Action: In `search_products()`, two changes:
  1. Catalog query: replace `CatalogProduct.name.ilike(...)` with tsvector search matching the same pattern as 2.3 (or use `CatalogProduct.display_name.ilike(...)` for consistency -- the unified search can use simpler ILIKE since it's capped at `catalog_limit` rows)
  2. When constructing `ProductSearchResultItem` for catalog results, add `display_name=cp.display_name` and `brand=cp.brand`
- Decision point: For the unified search (`search_products`), use ILIKE on `display_name` rather than tsvector. Reason: the catalog-specific endpoint handles heavy search; unified search is capped at 25 catalog results and simplicity matters. The GIN index still speeds up ILIKE for prefix matches.
- Dependencies: 2.2, 1.4
- Risk: Low
- Test: Existing `test_products_db.py` tests + new tests

**2.6 Add catalog factories** (`backend/tests/factories.py`)
- Action: Add `create_catalog_product(session, *, name, source="usda", source_id=None, display_name=None, category=None, brand=None, barcode=None)` and `create_catalog_portion(session, *, catalog_product_id, label="100 g", ...)` factory functions. Auto-generate `source_id` from random int if not provided. Default `display_name` to `name` if not provided.
- Why: Centralize test data creation; all test files currently have duplicate helpers
- Dependencies: 1.4
- Risk: Low
- Test: Used by subsequent test steps

**2.7 Fix and extend catalog service tests** (`backend/tests/services/test_catalog.py`)
- Action:
  - Replace `_create_catalog_product` helper with calls to `create_catalog_product` factory (from 2.6)
  - Remove `fdc_id` references; use `source`/`source_id`/`display_name` instead
  - Fix `test_get_default_portion_*` tests: replace `CatalogProduct(fdc_id=...)` with `CatalogProduct(source="usda", source_id="...", display_name="...")` in pure unit tests
  - Add new tests:
    - `test_list_catalog_products_tsvector_search` -- search "chicken" finds "Chicken breast, grilled" via stemming
    - `test_list_catalog_products_tsvector_fallback_to_ilike` -- search for a brand name that doesn't stem well falls back to ILIKE
    - `test_list_catalog_products_short_query_uses_ilike` -- search with 2-char query uses ILIKE
    - `test_list_catalog_products_search_by_brand` -- search finds product via brand field in tsvector
- Dependencies: 2.3, 2.6
- Risk: Low
- Test: `pytest tests/services/test_catalog.py`

**2.8 Fix and extend catalog API tests** (`backend/tests/api/test_catalog.py`)
- Action:
  - Replace `_insert_catalog_product` helper with `create_catalog_product` factory
  - Update response assertions: check `source`, `source_id`, `display_name` instead of `fdc_id`
  - Add test: `test_list_catalog_products_response_includes_new_fields` -- verify `brand`, `barcode`, `display_name` appear in JSON response
- Dependencies: 2.4, 2.6
- Risk: Low
- Test: `pytest tests/api/test_catalog.py`

**2.9 Fix products service tests** (`backend/tests/services/test_products_db.py`)
- Action:
  - Update `_make_catalog_product` helper to use `source`, `source_id`, `display_name` instead of `fdc_id`
  - Add tests:
    - `test_search_catalog_returns_display_name` -- verify `display_name` field populated in search results
    - `test_search_catalog_returns_brand` -- verify `brand` field populated for OFF items
- Dependencies: 2.5, 2.6
- Risk: Low
- Test: `pytest tests/services/test_products_db.py`

**Verification**: `cd backend && ruff check app/ && pytest --cov=app --cov-report=term-missing` -- all tests green

---

### Phase 3: Name Cleaner & Seeder Infrastructure (Backend Scripts)

**Estimate**: 6 new files, 1 modified file

Independent of Phase 2 for pure logic, but depends on Phase 1 for model imports in seeder code. Can be developed in parallel with Phase 2 (name_cleaner and quality gates are pure functions with no DB dependency).

**3.1 Create name_cleaner module** (`backend/scripts/seeders/name_cleaner.py`)
- Action: Implement `clean_usda_name(raw: str) -> str` following ADR rules:
  1. Split on `, ` into segments
  2. Drop noise segments matching patterns: regex for "raw", "separable lean only", "boneless", r"trimmed to .+", "select", "choice", "all grades", "year round average", "with skin", "without skin", "meat only", "meat and skin"
  3. Capitalize first segment as primary name
  4. Detect and append first cooking method from {"roasted", "baked", "grilled", "fried", "boiled", "steamed", "braised", "broiled", "sauteed", "poached", "smoked", "dried", "canned", "frozen"}
  5. Handle special patterns: "Nuts, almonds" -> "Almonds"; "Beans, snap, green" -> "Green snap beans"; "Tomatoes, grape" -> "Grape tomatoes"
  6. Cap result at 60 chars, truncating qualifiers from end
  7. Strip trailing commas/spaces
- Also implement `_NOISE_PATTERNS` as compiled regex set and `_COOKING_METHODS` as a frozenset
- Why: Core transformation logic; must be heavily unit-tested before integration
- Dependencies: None (pure function)
- Risk: Medium -- Heuristic; will produce imperfect results for edge cases. Mitigated by extensive test suite.
- Test: See 3.2

**3.2 Test name_cleaner** (`backend/tests/scripts/test_name_cleaner.py`)
- Action: Write tests for all ADR examples plus edge cases:
  - `test_chicken_breast_braised` -- "Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised" -> "Chicken breast, braised"
  - `test_beef_tenderloin_roasted` -- "Beef, loin, tenderloin roast, separable lean only, boneless, trimmed to 0\" fat, select, cooked, roasted" -> "Beef tenderloin roast, roasted"
  - `test_almonds_dry_roasted` -- "Nuts, almonds, dry roasted, with salt added" -> "Almonds, dry roasted, salted" (or close)
  - `test_green_snap_beans` -- "Beans, snap, green, canned, regular pack, drained solids" -> "Green snap beans, canned"
  - `test_grape_tomatoes` -- "Tomatoes, grape, raw" -> "Grape tomatoes"
  - `test_hummus_commercial` -- "Hummus, commercial" -> "Hummus"
  - `test_truncation_at_60_chars` -- very long name gets truncated
  - `test_empty_string` -- returns ""
  - `test_single_word` -- "Avocado" -> "Avocado"
  - `test_no_cooking_method` -- segments without cooking method
  - `test_multiple_cooking_methods_first_wins` -- e.g. "cooked, baked, then fried" -> picks "baked"
- Why: TDD -- write tests first, then implement 3.1 to pass them
- Dependencies: 3.1
- Risk: Low
- Test: `pytest tests/scripts/test_name_cleaner.py`

**3.3 Create seeders package** (`backend/scripts/seeders/__init__.py`)
- Action: Empty `__init__.py` with docstring only
- Why: Package marker for imports
- Dependencies: None
- Risk: Low
- Test: N/A

**3.4 Create abstract base seeder** (`backend/scripts/seeders/base.py`)
- Action: Define `AbstractSeeder` with:
  ```
  class AbstractSeeder(ABC):
      def __init__(self, seeds_dir: str): ...
      @abstractmethod
      async def run(self, conn: Any, *, dry_run: bool) -> tuple[int, int]: ...
          """Returns (products_seeded, portions_seeded)"""
  ```
- Also move shared utilities from current `seed_catalog.py` here: `normalize_unit()` (updated with pcs/serving aliases), `extract_macros_per_100g()`, `calc_kcal_per_100g()`, `_build_portion_label()`
- Update `SUPPORTED_UNITS` to include `"pcs"` and `"serving"`
- Update `_UNIT_ALIASES` with the new mappings from ADR (each, slice, piece, etc. -> pcs; serving, racc, container, etc. -> serving)
- Why: Shared code reused by both USDA and OFF seeders
- Dependencies: 1.1 (enum values)
- Risk: Low
- Test: Existing macro extraction logic preserved; tested via seeder tests

**3.5 Create USDA seeder** (`backend/scripts/seeders/usda.py`)
- Action: Implement `UsdaSeeder(AbstractSeeder)`:
  - `run()`: Load SR Legacy JSON (key: `SRLegacyFoods`), iterate foods, apply quality gates, transform, upsert
  - Quality gates (as methods for testability):
    - `_has_valid_id(food)` -- fdcId present and > 0
    - `_has_name(food)` -- description non-empty
    - `_has_calories(macros, kcal)` -- kcal > 0
    - `_is_not_excluded_category(food)` -- category not in {"Supplements", "Baby Foods"}
  - Transform: call `clean_usda_name()` for `display_name`
  - Upsert SQL: `INSERT ... ON CONFLICT (source, source_id) DO UPDATE SET ...` with `source='usda'`, `source_id=str(fdcId)`
  - Portions: Same logic as current `_process_food()` but using updated `normalize_unit()` with pcs/serving
  - Progress logging every 500 products
- Why: Replaces Foundation Foods processing in current seed_catalog.py
- Dependencies: 3.1, 3.4
- Risk: Medium -- 210 MB JSON file; `json.load()` will use ~600 MB RAM. Acceptable for a CLI script. If needed, use `ijson` streaming.
- Test: See 3.7

**3.6 Create OFF seeder** (`backend/scripts/seeders/off.py`)
- Action: Implement `OffSeeder(AbstractSeeder)`:
  - `run()`: Load pre-filtered CSV from `seeds/off_products_filtered.csv`, iterate rows, upsert
  - `parse_serving_size(raw: str) -> tuple[str, float | None]`:
    - Regex patterns: `r"(\d+\.?\d*)\s*g\b"` -> gram weight; `r"(\d+\.?\d*)\s*ml\b"` -> ml weight (assume density 1); `r"\((\d+\.?\d*)\s*g\)"` -> parenthesized gram weight
    - Return `(raw_label, gram_weight_or_none)`
  - For each row: `source='off'`, `source_id=barcode`, `display_name=product_name`, `brand=brands`, `barcode=code`
  - Portions: always a "100 g" default portion + optional serving portion if `parse_serving_size` succeeds
  - Dedup check: before insert, check if `display_name` (lowered, stripped) exists with `source='usda'`. If so, skip.
  - Macros from CSV columns: `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`
- Why: Adds packaged/branded foods to catalog
- Dependencies: 3.4, prepare_off_data.py output
- Risk: Medium -- CSV column names may use hyphens (`energy-kcal_100g`); need to access via `row['energy-kcal_100g']` not attribute access
- Test: See 3.8

**3.7 Test USDA seeder** (`backend/tests/scripts/test_usda_seeder.py`)
- Action: Test quality gate functions and food processing logic in isolation (no DB):
  - `test_has_valid_id_rejects_zero`
  - `test_has_valid_id_accepts_positive`
  - `test_has_name_rejects_empty`
  - `test_is_not_excluded_category_rejects_supplements`
  - `test_is_not_excluded_category_rejects_baby_foods`
  - `test_is_not_excluded_category_accepts_dairy`
  - `test_normalize_unit_maps_each_to_pcs`
  - `test_normalize_unit_maps_serving_to_serving`
  - `test_normalize_unit_maps_slice_to_pcs`
  - `test_normalize_unit_returns_none_for_unknown`
- Why: Quality gates must be validated before running against real data
- Dependencies: 3.5
- Risk: Low
- Test: `pytest tests/scripts/test_usda_seeder.py`

**3.8 Test OFF seeder** (`backend/tests/scripts/test_off_seeder.py`)
- Action: Test `parse_serving_size()` and quality gate logic:
  - `test_parse_serving_size_simple_grams` -- "30g" -> ("30g", 30.0)
  - `test_parse_serving_size_with_parens` -- "1 bar (40g)" -> ("1 bar (40g)", 40.0)
  - `test_parse_serving_size_ml` -- "250ml" -> ("250ml", 250.0)
  - `test_parse_serving_size_unparseable` -- "a handful" -> ("a handful", None)
  - `test_parse_serving_size_with_spaces` -- "30 g" -> ("30 g", 30.0)
  - `test_parse_serving_size_empty` -- "" -> ("", None)
- Why: Serving size parsing is tricky; must be tested
- Dependencies: 3.6
- Risk: Low
- Test: `pytest tests/scripts/test_off_seeder.py`

**Verification**: `cd backend && ruff check app/ scripts/ && pytest` -- all tests green

---

### Phase 4: Prepare OFF Data Script & Seed Orchestrator

**Estimate**: 2 new files, 2 modified files

Depends on Phase 3 (seeder classes). The prepare script is independent and can be done first.

**4.1 Add pyarrow/pandas to dev dependencies** (`backend/pyproject.toml`)
- Action: Add to `[tool.poetry.group.dev.dependencies]`: `pyarrow = ">=14.0"` and `pandas = ">=2.0"`
- Why: `prepare_off_data.py` reads a 4.4 GB Parquet file; pyarrow is the only performant way to do this. These are dev-only dependencies, not runtime.
- Dependencies: None
- Risk: Low -- dev-only, won't affect production
- Test: Manual install verification

**4.2 Create prepare_off_data.py** (`backend/scripts/prepare_off_data.py`)
- Action: Implement CLI script that:
  1. Reads `seeds/food.parquet` using `pandas.read_parquet()` with `columns=[...]` to limit memory (only read needed columns)
  2. Required columns: `code`, `product_name`, `brands`, `countries_en`, `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`, `completeness`, `nutrition_grade_fr`, `unique_scans_n`, `serving_size`
  3. Apply quality gates as DataFrame filters:
     - `product_name` non-null and length between 1-120
     - `energy-kcal_100g` > 0
     - `completeness` >= 0.65
     - `nutrition_grade_fr` in {'a','b','c','d','e'} (case-insensitive)
     - Macro coverage: at least 3 of 4 macro columns non-null
     - English market: `countries_en.str.contains('United States|United Kingdom|Canada|Australia', case=False, na=False)`
  4. Sort by `unique_scans_n` descending, take top 5,000
  5. Write to `seeds/off_products_filtered.csv`
  6. Print summary stats (total input, after each gate, final count)
  - CLI: `python -m scripts.prepare_off_data [--seeds-dir PATH] [--limit 5000]`
- Why: The raw Parquet is 4.4 GB; pre-filtering is essential. This runs once manually.
- Dependencies: 4.1
- Risk: Medium -- Column names in Parquet may differ from CSV export; need to verify against actual file. The `countries_en` column in Parquet may be named differently (could be `countries_tags` or `countries`). Need to inspect actual schema.
- Test: Manual run + inspect output CSV

**4.3 Refactor seed_catalog.py to orchestrator** (`backend/scripts/seed_catalog.py`)
- Action: Rewrite as orchestrator:
  - Keep: `_asyncpg_url()`, `_load_database_url()`, logging setup
  - Remove: All food processing logic (moved to seeders)
  - Add: `--sources` CLI argument (choices: `usda`, `off`, `all`; default: `all`)
  - `_seed_async()`:
    ```
    if "usda" in sources or "all" in sources:
        usda = UsdaSeeder(seeds_dir)
        await usda.run(conn, dry_run=dry_run)
    if "off" in sources or "all" in sources:
        off = OffSeeder(seeds_dir)
        await off.run(conn, dry_run=dry_run)
    ```
  - Import `UsdaSeeder` from `scripts.seeders.usda` and `OffSeeder` from `scripts.seeders.off`
- Why: Single entry point delegates to source-specific seeders
- Dependencies: 3.5, 3.6
- Risk: Low -- mostly restructuring existing code
- Test: `python -m scripts.seed_catalog --sources usda --dry-run` and `python -m scripts.seed_catalog --sources off --dry-run`

**4.4 Update seed.py wrapper** (`seed.py`)
- Action: Forward all args (including the new `--sources`) to the backend script. Current code already does `*sys.argv[1:]`, so this may need no change. Verify.
- Why: Convenience wrapper at repo root
- Dependencies: 4.3
- Risk: Low
- Test: `python seed.py --sources usda --dry-run`

**Verification**: `cd backend && ruff check app/ scripts/ && pytest` (tests pass); `python seed.py --dry-run` (prints expected product counts)

---

### Phase 5: Seed Execution & Validation (Manual)

**Estimate**: 0 code files, operational verification

Depends on Phases 1-4 complete.

**5.1 Run prepare_off_data.py**
- Action: Execute `cd backend && python -m scripts.prepare_off_data --seeds-dir ../seeds`
- Verify: `seeds/off_products_filtered.csv` created with ~3,000-5,000 rows; spot-check product names and brands
- Risk: Medium -- Parquet column names may not match expectations. If so, fix 4.2.

**5.2 Run migrations on dev DB**
- Action: `cd backend && alembic upgrade head`
- Verify: `\d catalog_products` shows new columns, no `fdc_id`; `\dT+ unit_enum` shows pcs and serving

**5.3 Run full seed**
- Action: `python seed.py --sources all`
- Verify: Log output shows ~2,500-3,500 USDA products and ~3,000-5,000 OFF products seeded; spot-check search via API

**5.4 Validate search quality**
- Action: Manually test searches via curl/httpie:
  - `GET /v1/catalog/products?search=chicken` -- should return chicken items with clean display_names
  - `GET /v1/catalog/products?search=coca cola` -- should return OFF branded items with brand
  - `GET /v1/products/search?q=chicken` -- unified search with user+catalog results
- Verify: Results are relevant, display_name is clean, brand shows for OFF items

**5.5 Clean up old seed data**
- Action: Delete `seeds/foundation_food_2025-12-18.json` if it exists (replaced by SR Legacy)
- Add `seeds/off_products_filtered.csv` to git (if < 10 MB) or to `.gitignore` with download instructions

**Verification**: Full backend test suite + manual API testing

---

### Phase 6: Client Changes (Frontend)

**Estimate**: 3 files modified

Independent of Phases 3-5 (backend seed pipeline). Depends on Phase 2 (API response shape). Can start after Phase 2 is complete.

**6.1 Update client types** (`client/src/models/types.ts`)
- Action:
  - Add `"pcs" | "serving"` to the `Unit` type union: `export type Unit = "mg" | "g" | "kg" | "ml" | "l" | "tsp" | "tbsp" | "cup" | "pcs" | "serving";`
  - Add fields to `ProductSearchResult`: `displayName: string | null;` and `brand: string | null;`
- Why: Client types must match the new API response
- Dependencies: Phase 2 (API contract defined)
- Risk: Low
- Test: `npx tsc --noEmit`

**6.2 Update API client** (`client/src/services/api/products.ts`)
- Action: Add to `ProductSearchResultResponse` type: `display_name: string | null;` and `brand: string | null;`
- Why: API response type must include new fields
- Dependencies: 6.1
- Risk: Low
- Test: `npx tsc --noEmit`

**6.3 Update SelectProduct screen** (`client/src/screens/AddMealFlow/components/SelectProduct/index.tsx`)
- Action: Two changes:
  1. In `runSearch` callback, map `display_name` and `brand` from API response to `ProductSearchResult`:
     ```
     displayName: item.display_name,
     brand: item.brand,
     ```
  2. In `renderSearchRow`, for catalog items: replace `<Text style={styles.rowName}>{item.name}</Text>` with `<Text style={styles.rowName}>{item.displayName ?? item.name}</Text>`. Add a brand subtitle line: `{item.brand && <Text style={styles.rowMeta}>{item.brand}</Text>}`. Keep existing "Catalog" badge.
  3. In `handleCatalogSelect`, use `displayName ?? name` for the product name: `name: item.displayName ?? item.name`
- Why: Catalog items should display clean names and brands
- Dependencies: 6.1, 6.2
- Risk: Low -- minor rendering change
- Test: `npx tsc --noEmit && pnpm test`

**Verification**: `cd client && pnpm run verify` (type check + lint + tests)

---

## Dependency Graph

```
Phase 1 (DB Schema) ──────┬──> Phase 2 (API Layer) ──> Phase 6 (Client)
                           │
                           └──> Phase 3 (Seeders) ──> Phase 4 (Orchestrator) ──> Phase 5 (Seed Run)
```

- Phase 1 blocks everything
- Phase 2 and Phase 3 can run in parallel (different files, same dependency on Phase 1)
- Phase 4 depends on Phase 3
- Phase 5 depends on Phases 1-4
- Phase 6 depends on Phase 2 only (can run in parallel with Phases 3-5)

## Parallelism Opportunities

| Slot | Backend Developer | Frontend Developer |
|------|-------------------|--------------------|
| 1 | Phase 1 (migrations + model) | -- (blocked) |
| 2 | Phase 2 (API layer) | -- (blocked) |
| 3 | Phase 3 (seeders + name cleaner) | Phase 6 (client types + UI) |
| 4 | Phase 4 (orchestrator + OFF prep) | -- (done) |
| 5 | Phase 5 (seed run + validation) | -- (done) |

After Phase 2 completes, the frontend developer can work on Phase 6 independently while the backend developer handles Phases 3-5.

## Testing Strategy

### Unit Tests (TDD -- write tests first)
- `tests/scripts/test_name_cleaner.py` -- All ADR name transformation examples + edge cases (~15 tests)
- `tests/scripts/test_usda_seeder.py` -- Quality gate functions, normalize_unit with new mappings (~10 tests)
- `tests/scripts/test_off_seeder.py` -- parse_serving_size patterns (~6 tests)

### Integration Tests (existing, updated)
- `tests/services/test_catalog.py` -- tsvector search, ILIKE fallback, brand search (~4 new tests)
- `tests/api/test_catalog.py` -- New response fields in JSON (~1 new test)
- `tests/services/test_products_db.py` -- display_name/brand in unified search (~2 new tests)

### Manual Verification
- Run seed with `--dry-run` and validate counts
- Run full seed and spot-check 20 random products via API
- Search for 10 common foods and verify relevance
- Search for 5 brands and verify brand display

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| SR Legacy JSON is 210 MB, not ~40 MB as ADR estimated | Low | `json.load()` at 210 MB uses ~800 MB RAM. Acceptable for CLI. If OOM on CI, use `ijson` streaming parser. |
| Parquet column names may differ from ADR assumptions | Medium | `prepare_off_data.py` should first print `df.columns.tolist()` and fail-fast with clear error if expected columns missing. Fix column mapping before proceeding. |
| `search_vector` GENERATED ALWAYS column not supported by `alembic autogenerate` | Medium | Use raw SQL in migration (step 1.5.15). Document this in migration docstring. |
| Test conftest hardcodes unit_enum values | Medium | Phase 1.2 updates it. If missed, every test using pcs/serving fails with clear error. |
| Name cleaner produces poor results for some food categories | Medium | Build override mechanism (dict of fdc_id -> custom display_name) for worst cases. Review dry-run output before committing seed data. |
| Migration 0010 is complex (15 steps) | High | Test with `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` on dev DB. Consider splitting into 2 migrations if review reveals issues. |
| OFF dedup check (display_name match) may miss or over-match | Low | Dedup is best-effort per ADR. Duplicates are cosmetic, not data integrity issues. Can refine later with similarity threshold. |
| `poetry` not in PATH for dependency installation | Low | Manually edit `pyproject.toml` for pyarrow/pandas. Use `pip install pyarrow pandas` directly if needed for the prepare script. |

## Open Questions

1. **Parquet column names**: The ADR assumes standard Open Food Facts CSV column names. The Parquet file from Hugging Face may use different column names (e.g., `countries_tags` vs `countries_en`, column names with hyphens). Need to inspect the actual Parquet schema before implementing `prepare_off_data.py`. Suggest running `python -c "import pyarrow.parquet as pq; print(pq.read_schema('seeds/food.parquet'))"` first.

2. **Git tracking of filtered CSV**: The filtered OFF CSV will be ~2-5 MB. Should it be committed to git, or `.gitignore`'d with download instructions? Recommend committing if < 10 MB for reproducibility.

3. **SR Legacy file naming**: The ADR references `sr_legacy_2025-10.json` but the actual file is `FoodData_Central_sr_legacy_food_json_2018-04.json`. The USDA seeder should be coded to find the actual filename. Suggest pattern-matching for `*sr_legacy*.json` in the seeds directory.

4. **Migration number prefix**: The ADR uses `0009` and `0010`. Confirm no other migrations have been added since `0008_catalog_portions`. (Verified: `0008` is the latest.)
