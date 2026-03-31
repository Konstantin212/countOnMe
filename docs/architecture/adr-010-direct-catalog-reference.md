---
type: adr
status: accepted
last-updated: 2026-03-31
---

# ADR-010: Direct Catalog Reference in Food Entries

## Context

When a user tracks food from the catalog (via search or barcode scan), the current
flow creates a private copy of the catalog product in the user's `products` table and
a matching `product_portions` row, then links the `food_entries` row to those private
copies. This "copy-on-track" approach has three costs:

1. **Wasted storage**: Every catalog track duplicates a product + portion row per user.
   With 10k users each tracking 20 catalog items, that is 200k redundant product rows
   and 200k redundant portion rows.

2. **Data staleness**: If catalog data is corrected (e.g., wrong calorie value fixed
   during a re-seed), private copies retain the stale values forever.

3. **UX friction and latency**: `ProductConfirmScreen.handleTrackFood` performs 3-4
   sequential API calls (create product, create portion, create food entry), adding
   hundreds of milliseconds of latency to a simple "track this food" tap.

4. **"My Products" pollution**: Catalog-sourced copies appear in the user's product
   list with `source: "catalog"`, requiring client-side filtering. The `ProductsListScreen`
   already filters these out (line 19-22 `products.filter(p => p.source === "user")`),
   but they still exist in storage and sync payloads.

This ADR replaces the copy-on-track flow with a direct reference from `food_entries`
to `catalog_portions`, eliminating the private copy for catalog items entirely.

## Decision

Add a nullable `catalog_portion_id` foreign key to the `food_entries` table. Food
entries reference EITHER a private `portion_id` (user-created products) OR a
`catalog_portion_id` (catalog products), never both. A CHECK constraint enforces
mutual exclusivity. The existing `product_id` and `portion_id` columns become
nullable. All existing rows remain valid (they have `product_id` + `portion_id`
set). New catalog-sourced entries set only `catalog_portion_id`.

### Schema Change

```sql
-- Migration: add catalog_portion_id, make product_id/portion_id nullable

ALTER TABLE food_entries
  ADD COLUMN catalog_portion_id UUID
    REFERENCES catalog_portions(id) ON DELETE RESTRICT;

ALTER TABLE food_entries
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE food_entries
  ALTER COLUMN portion_id DROP NOT NULL;

CREATE INDEX ix_food_entries_catalog_portion_id
  ON food_entries (catalog_portion_id)
  WHERE catalog_portion_id IS NOT NULL;

ALTER TABLE food_entries
  ADD CONSTRAINT ck_food_entries_portion_xor
    CHECK (
      (portion_id IS NOT NULL AND catalog_portion_id IS NULL)
      OR
      (portion_id IS NULL AND catalog_portion_id IS NOT NULL)
    );
```

**On `ON DELETE RESTRICT` for catalog_portions FK**: Catalog portions must not be
removed while food entries reference them. The seed script already uses
DELETE-then-INSERT per product for portion replacement; it must be updated to
check for referencing food entries or use a UPSERT strategy instead.

### ORM Model Change

**File**: `backend/app/features/meals/models.py`

```python
class FoodEntry(Base, TimestampMixin, SyncMixin):
    # ... existing fields ...

    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=True,   # was nullable=False
        index=True,
    )

    portion_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_portions.id", ondelete="RESTRICT"),
        nullable=True,   # was nullable=False
        index=True,
    )

    catalog_portion_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("catalog_portions.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
```

### Pydantic Schema Changes

**File**: `backend/app/features/meals/schemas.py`

The create request accepts one of two shapes:

```python
class FoodEntryCreateRequest(APIModel):
    # Private product path (existing)
    product_id: UUID | None = None
    portion_id: UUID | None = None

    # Catalog path (new)
    catalog_portion_id: UUID | None = None

    # Common fields
    day: date
    meal_type: MealType
    amount: Decimal = Field(gt=0)
    unit: Unit

    @model_validator(mode="after")
    def check_portion_xor(self) -> Self:
        has_private = self.product_id is not None and self.portion_id is not None
        has_catalog = self.catalog_portion_id is not None
        if has_private == has_catalog:
            raise ValueError(
                "Provide either (product_id + portion_id) or catalog_portion_id, not both/neither"
            )
        return self
```

The response exposes all three fields (nullable):

```python
class FoodEntryResponse(APIModel):
    id: UUID
    product_id: UUID | None
    portion_id: UUID | None
    catalog_portion_id: UUID | None
    day: date
    meal_type: MealType
    amount: Decimal
    unit: Unit
    created_at: datetime
    updated_at: datetime
```

### Service Layer Changes

**File**: `backend/app/features/meals/service.py`

`create_food_entry` gains a `catalog_portion_id` parameter. When present, it validates
that the catalog portion exists (simple SELECT on `catalog_portions` with no device
scoping since catalog is global), skips the product/portion ownership checks, and
creates the entry with only `catalog_portion_id` set.

```python
async def create_food_entry(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    # Private product path
    product_id: uuid.UUID | None = None,
    portion_id: uuid.UUID | None = None,
    # Catalog path
    catalog_portion_id: uuid.UUID | None = None,
    # Common
    day: date,
    meal_type,
    amount,
    unit,
    device_id: uuid.UUID | None = None,
) -> FoodEntry | None:
    if catalog_portion_id is not None:
        # Validate catalog portion exists (global, no device scoping)
        cat_portion = await _get_catalog_portion(session, catalog_portion_id)
        if cat_portion is None:
            return None
        entry = FoodEntry(
            user_id=user_id,
            device_id=device_id,
            created_on_device_id=device_id,
            catalog_portion_id=catalog_portion_id,
            day=day, meal_type=meal_type, amount=amount, unit=unit,
        )
    else:
        # Existing private product path (unchanged)
        ...
```

### Stats Service Changes

**File**: `backend/app/features/stats/service.py`

This is the most critical change. `get_day_stats` currently does a single JOIN:
`food_entries JOIN product_portions`. With dual portion sources, we need to handle
both.

**Recommended approach: UNION of two queries.**

```python
async def get_day_stats(session, *, user_id, day, device_id=None):
    # Query 1: entries with private portions
    private_stmt = (
        select(FoodEntry, ProductPortion)
        .join(ProductPortion, ProductPortion.id == FoodEntry.portion_id)
        .where(
            get_owner_filter(FoodEntry, user_id=user_id),
            FoodEntry.deleted_at.is_(None),
            FoodEntry.day == day,
            FoodEntry.portion_id.is_not(None),
            ProductPortion.deleted_at.is_(None),
        )
    )

    # Query 2: entries with catalog portions
    catalog_stmt = (
        select(FoodEntry, CatalogPortion)
        .join(CatalogPortion, CatalogPortion.id == FoodEntry.catalog_portion_id)
        .where(
            get_owner_filter(FoodEntry, user_id=user_id),
            FoodEntry.deleted_at.is_(None),
            FoodEntry.day == day,
            FoodEntry.catalog_portion_id.is_not(None),
        )
    )

    # Execute both
    private_res = await session.execute(private_stmt)
    catalog_res = await session.execute(catalog_stmt)

    totals = _zero()
    by_meal = defaultdict(_zero)

    # Process private entries (unchanged)
    for entry, portion in private_res.all():
        entry_totals = calc_totals_for_entry(...)
        totals = _add(totals, entry_totals)
        by_meal[entry.meal_type] = _add(by_meal[entry.meal_type], entry_totals)

    # Process catalog entries (same calc — CatalogPortion has identical
    # nutritional columns: base_amount, base_unit, calories, protein, carbs, fat)
    for entry, portion in catalog_res.all():
        entry_totals = calc_totals_for_entry(
            entry_amount=entry.amount,
            entry_unit=entry.unit,
            portion_base_amount=portion.base_amount,
            portion_base_unit=portion.base_unit,
            portion_calories=portion.calories,
            portion_protein=portion.protein,
            portion_carbs=portion.carbs,
            portion_fat=portion.fat,
        )
        totals = _add(totals, entry_totals)
        by_meal[entry.meal_type] = _add(by_meal[entry.meal_type], entry_totals)

    return totals, dict(by_meal)
```

This works because `CatalogPortion` and `ProductPortion` share identical nutritional
column signatures (`base_amount`, `base_unit`, `calories`, `protein`, `carbs`, `fat`),
so `calc_totals_for_entry` works unchanged for both.

### Sync Service Changes

**File**: `backend/app/features/sync/service.py`

Add `catalog_portion_id` to the `_PUSH_FIELDS["food_entries"]` set:

```python
"food_entries": {
    "product_id", "portion_id", "catalog_portion_id",
    "day", "meal_type", "amount", "unit",
},
```

The pull side needs no changes — it returns all columns of FoodEntry rows, and
the new `catalog_portion_id` column will be included automatically via ORM
serialization.

### Client API Changes

**File**: `client/src/services/api/foodEntries.ts`

Update types to support the dual-path create:

```typescript
type FoodEntryApiResponse = {
  id: string;
  product_id: string | null;       // nullable now
  portion_id: string | null;       // nullable now
  catalog_portion_id: string | null; // new
  day: string;
  meal_type: MealType;
  amount: string | number;
  unit: Unit;
  created_at: string;
  updated_at: string;
};

export type FoodEntry = {
  id: string;
  productId: string | null;         // nullable now
  portionId: string | null;         // nullable now
  catalogPortionId: string | null;  // new
  day: string;
  mealType: MealType;
  amount: number;
  unit: Unit;
  createdAt: string;
  updatedAt: string;
};

// Two possible create shapes
export type FoodEntryCreateRequest =
  | {
      product_id: string;
      portion_id: string;
      day: string;
      meal_type: MealType;
      amount: string | number;
      unit: Unit;
    }
  | {
      catalog_portion_id: string;
      day: string;
      meal_type: MealType;
      amount: string | number;
      unit: Unit;
    };
```

### Client Hook Changes

**File**: `client/src/hooks/useFoodEntries.ts`

The entire `ensureProductInBackend` and `getOrCreateDefaultPortion` functions are
no longer needed for catalog items. The new flow in `saveMealToBackend`:

```typescript
for (const item of items) {
  const product = products.find(p => p.id === item.productId);
  if (!product) continue;

  let request: FoodEntryCreateRequest;

  if (item.catalogPortionId) {
    // Catalog path — single API call, no private copy
    request = {
      catalog_portion_id: item.catalogPortionId,
      day: entryDay,
      meal_type: mealType,
      amount: item.amount,
      unit: item.unit,
    };
  } else {
    // Private product path — existing flow
    const portionId = await getOrCreateDefaultPortion(item.productId, product);
    request = {
      product_id: item.productId,
      portion_id: portionId,
      day: entryDay,
      meal_type: mealType,
      amount: item.amount,
      unit: item.unit,
    };
  }

  const entry = await createFoodEntry(request);
  createdEntries.push(entry);
}
```

This requires adding `catalogPortionId` to `MealItem`:

**File**: `client/src/models/types.ts`

```typescript
export type MealItem = {
  productId: string;
  amount: number;
  unit: Unit;
  catalogPortionId?: string;  // set for catalog items, absent for user products
};
```

### ProductConfirmScreen Changes

**File**: `client/src/screens/ProductFlow/ProductConfirmScreen.tsx`

`handleTrackFood` currently:
1. Calls `addProduct(...)` to create a private product copy
2. Calls `saveMealToBackend(...)` which creates another private portion copy

New flow:
1. Creates a local `Product` with `source: "catalog"` in AsyncStorage (needed for
   display name resolution in `useMealTypeEntries`)
2. Calls `saveMealToBackend(...)` with `catalogPortionId` set on the `MealItem`
3. No backend product/portion creation needed

The local Product in AsyncStorage is still needed because `useMealTypeEntries.enrichEntry`
resolves product names from the local products list. However, no backend product row
is created. The local product serves only as a display-name cache.

**Important**: The `addProduct` call changes from creating a backend-synced product to
a local-only product entry. The `source: "catalog"` flag already exists and is already
filtered out of "My Products" views.

### MealTypeEntries Enrichment Changes

**File**: `client/src/hooks/useMealTypeEntries.ts`

`enrichEntry` currently:
1. Looks up the product from local products (by `entry.productId`)
2. Fetches portions via `listPortions(entry.productId)` (backend API)
3. Finds the matching portion by `entry.portionId`

For catalog entries (`entry.catalogPortionId !== null`):
1. Product name resolution: need a new lookup path. Options:
   a. Keep the local AsyncStorage product copy (display name only) — already exists
   b. Fetch from catalog API by `catalog_portion_id` — adds latency

**Recommendation**: Keep the local product copy for display names. When enriching
a catalog entry, use the catalog portion data directly (fetch from
`GET /v1/catalog/products/{id}` if not cached). Add a separate
`catalogPortionCache` similar to the existing `portionCache`.

However, the simpler approach is to have the backend return enriched data. See
"Future Enhancement" section below.

For now, the pragmatic approach:
- The local Product copy (stored with `source: "catalog"`) provides the display name
- For nutrition calculation on catalog entries, use the product's stored per-100g
  values as fallback (same as existing fallback path in `enrichEntry` catch block)
- Backend stats are already accurate (the stats query joins the correct portion table)

### Favorites and Recents

**File**: `client/src/storage/storage.ts`

Favorites and recents store product IDs as `string[]`. For catalog items that no
longer have private product copies on the backend, we have two options:

| | Option A: Keep product ID references | Option B: Dual-key references |
|---|---|---|
| Description | Continue storing the local product ID (which maps to the AsyncStorage product copy). The product copy exists locally for display purposes even though no backend row exists. | Store `{ type: "user" | "catalog", id: string }` objects instead of plain strings. |
| Pros | Zero migration. Existing favorites/recents just work. Local product copy already has the display name. | Explicit about what the ID refers to. No ambiguity. |
| Cons | The local product ID is a client-generated UUID that has no meaning on the backend for catalog items. If local storage is cleared, favorites referencing catalog items are lost. | Breaking change to storage format. Requires migration of existing favorites data. Every consumer of favorites must be updated. |
| **Recommendation** | **Use this** | |

**Decision**: Keep product ID references (Option A). The local product copy in
AsyncStorage already serves as the authoritative source for favorites/recents
resolution. Since favorites are inherently a client-local concept (not synced to
backend), this is acceptable. The `productMap` in `SelectProduct` already resolves
IDs to local products for display.

### What Gets Removed

1. **`ensureProductInBackend()`** in `useFoodEntries.ts` — no longer called for catalog items
2. **`getOrCreateDefaultPortion()`** in `useFoodEntries.ts` — no longer called for catalog items
3. **Backend product creation** from `ProductConfirmScreen.handleTrackFood` — replaced
   by local-only product creation
4. **`productSyncedCache`** in `useFoodEntries.ts` — no longer needed for catalog items

These functions are NOT deleted entirely because they are still needed for
user-created products tracked via the `AddFood` screen. They become dead code only
for the catalog path.

### What product_id Means Going Forward

`product_id` on `food_entries` remains for user-created products. It is NOT used
for catalog items. The two paths are:

| | User Product | Catalog Product |
|---|---|---|
| `food_entries.product_id` | Set (FK to `products`) | NULL |
| `food_entries.portion_id` | Set (FK to `product_portions`) | NULL |
| `food_entries.catalog_portion_id` | NULL | Set (FK to `catalog_portions`) |
| Product name resolution | Local products list | Local products list (catalog copy) |
| Stats calculation | JOIN `product_portions` | JOIN `catalog_portions` |
| Sync push fields | `product_id`, `portion_id` | `catalog_portion_id` |

## Consequences

### Positive

- **Eliminates redundant data**: No more private copies of catalog products/portions
  in backend tables. Reduces storage by ~2 rows per catalog food track.
- **Always-fresh nutrition data**: Catalog corrections propagate automatically to
  all food entries referencing those portions. Stats recalculate correctly.
- **Faster track flow**: Catalog food tracking drops from 3-4 API calls to 1 API call
  (just `POST /v1/food-entries` with `catalog_portion_id`).
- **Cleaner "My Products"**: No more phantom catalog copies cluttering the user's
  product list or sync payloads.
- **Backwards compatible**: All existing food entries continue to work unchanged.
  The migration only adds a nullable column and relaxes NOT NULL constraints.

### Negative

- **Dual-join in stats**: Stats queries become slightly more complex (two queries
  instead of one). Performance impact is negligible — both queries hit indexed
  columns and the row counts per day are small (typically <30 entries).
- **Client enrichment complexity**: `useMealTypeEntries.enrichEntry` needs branching
  logic for catalog vs. private entries. Mitigated by the fallback-to-product
  pattern that already exists.
- **Seed script constraint**: The existing DELETE-then-INSERT strategy for catalog
  portions during re-seed will fail if food entries reference those portions
  (RESTRICT). The seed script must be updated to use UPSERT or skip deletion of
  referenced portions.
- **Local product copy still needed**: We still create a local Product in AsyncStorage
  for display name resolution. This is lighter than the current approach (no backend
  row, no portion row) but not zero overhead.

### Alternatives Considered

- **Polymorphic portion view (CREATE VIEW)**: A database view unifying
  `product_portions` and `catalog_portions` into a single virtual table. Stats would
  join a single view. Rejected because: (a) views add complexity to migrations,
  (b) `product_portions` has `deleted_at` while `catalog_portions` does not, requiring
  COALESCE logic, (c) ORM mapping to views is fragile with SQLAlchemy.

- **COALESCE approach (single query with LEFT JOINs)**: Join food_entries to both
  portion tables with LEFT JOIN, use COALESCE to pick whichever is non-null. Rejected
  because: (a) the query is harder to read and maintain, (b) LEFT JOINs on two
  tables with COALESCE across 6+ columns is error-prone, (c) no meaningful
  performance benefit over two simple queries.

- **Unified portions table**: Merge `catalog_portions` into `product_portions` with
  a `source` discriminator. Rejected because: (a) catalog portions have no `device_id`,
  no `deleted_at`, no sync columns — merging would require nullable columns everywhere,
  (b) violates the clean separation between user-scoped and global data established
  in ADR-003.

- **Keep copy-on-track, fix staleness with sync**: Update private copies when
  catalog data changes. Rejected because: (a) requires tracking which private
  products originated from which catalog entries, (b) the fundamental storage
  waste remains, (c) sync complexity is much higher than the direct reference
  approach.

### Migration Safety

The migration is fully backwards-compatible:

1. **Step 1**: Add `catalog_portion_id` column (nullable, no CHECK constraint yet)
2. **Step 2**: Deploy backend code that handles both paths
3. **Step 3**: Deploy client code that sends `catalog_portion_id` for catalog items
4. **Step 4**: Add CHECK constraint (`ck_food_entries_portion_xor`)

Steps 1-2 can be deployed together. Step 3 is a client release. Step 4 is added
after confirming all clients send valid data. This staged approach prevents the
CHECK constraint from blocking old clients that still send `product_id + portion_id`
for catalog items.

**Rollback**: Drop the `catalog_portion_id` column and restore NOT NULL on
`product_id`/`portion_id`. Any food entries created with only `catalog_portion_id`
would need backfilling (create private copies) before rolling back. This makes
rollback moderately complex after data has been written via the new path.

### Seed Script Impact

**File**: `backend/scripts/seed_catalog.py`

The current seed strategy for portions is DELETE-all-for-product then INSERT-fresh.
With `ON DELETE RESTRICT` on `food_entries.catalog_portion_id`, this will fail if
any food entry references a catalog portion being deleted.

**Fix**: Change to UPSERT strategy:
- For each portion in the seed data, INSERT ON CONFLICT (id) DO UPDATE
- Only delete portions that are no longer in the seed data AND have no referencing
  food entries
- Alternatively, use a soft-disable flag on orphaned portions rather than deleting

## Future Enhancement: Backend-Enriched Food Entry Response

A future improvement would extend `FoodEntryResponse` to include resolved product
name and portion label directly from the backend, eliminating the client's need to
maintain local product copies for display names:

```python
class FoodEntryResponse(APIModel):
    # ... existing fields ...
    resolved_product_name: str | None = None
    resolved_portion_label: str | None = None
    resolved_calories_per_base: Decimal | None = None
```

The router would join the appropriate portion table and product table (or catalog
tables) to populate these fields. This is out of scope for this ADR but would
simplify the client significantly.

## Status

Accepted. Implementation in progress (ADR-010 backend changes merged; client implementation pending).
