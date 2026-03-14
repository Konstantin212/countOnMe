---
type: plan
status: completed
created: 2026-03-14
---

# Architecture Design: Products Epic

## Context

Two user flows need completing:

1. **Flow 1 — Add/Edit Product**: Profile > My Products already navigates to `ProductsList`. The `ProductFormScreen` creates/edits products but has no name-uniqueness check and does not auto-favorite on create.
2. **Flow 2 — Select Product (Add Meal)**: `SelectProductScreen` only shows user products from AsyncStorage. The default list ordering is not enforced to the 5-favorites / 10-recents spec, and no catalog search is integrated.

No new navigation routes or screens are needed. The profile entry point (`My Products` button navigating to `ProductsList`) already exists in `ProfileScreen`.

---

## Requirements

### Functional
- Name uniqueness validation (device-scoped, debounced) in ProductFormScreen, shown as inline error
- Auto-favorite: when `addProduct()` succeeds, add the new product id to favorites storage
- SelectProduct default list: first 5 favorites (most recently favorited order), then up to 10 recents that are not already in the favorites slot; total cap 15
- SelectProduct search: when query is non-empty, call backend unified search; results replace the default list; user products first, then catalog matches; discriminated by `source` field
- Empty state and error state with retry in SelectProduct
- Recently-used update: when a food item is added in AddFoodScreen (`upsertItem` call), push that product id to the recents list in AsyncStorage

### Non-Functional
- Offline-first: name-check and catalog search silently fail/skip when offline; no crash or blocking
- Search debounce: 400 ms to avoid hammering the backend on each keystroke
- Catalog results are display-only on SelectProduct; selecting a catalog item must materialize a local user product first

---

## Data Flow Diagrams

### Flow 1 — Create Product with Name Check

```
ProductFormScreen
  → debounce 400ms on name field change
  → GET /v1/products/check-name?name=X   (skipped if offline)
  ← { available: boolean }
  → show inline error "Name already used" if !available
  → on submit: useProducts.addProduct()
    → saveProducts() to AsyncStorage
    → saveProductFavourites([newId, ...existing])  ← auto-favorite
    → enqueue sync mutation
```

### Flow 2 — Select Product (default list, no search)

```
SelectProductScreen mounts
  → loadProductFavourites() → string[] (ordered)
  → loadProductRecents()    → string[] (ordered newest-first)
  → products from useProducts (AsyncStorage)
  compose default list:
    favSlot  = favourites[0..4] resolved to Product (max 5)
    recentSlot = recents filtered to exclude favSlot ids, resolved to Product (max 10)
    defaultList = [...favSlot, ...recentSlot]
```

### Flow 2 — Select Product (search active)

```
query changes → debounce 400ms
  → GET /v1/products/search?q=<query>&limit=35
  ← SearchResultItem[]  (source: "user" | "catalog")
  render results (user items first, catalog items below with badge)

user selects catalog item
  → materialize: useProducts.addProduct({ name, caloriesPer100g, ... })
  → auto-favorite the new product id
  → navigate to AddFood with new product id
```

### Recently-Used Update

```
AddFoodScreen — user taps "Add"
  → upsertItem()
  → updateRecents(productId)   ← new helper in storage
      prepend id, deduplicate, cap at 50
```

---

## Backend Section

### New: GET /v1/products/check-name

**Router**: `backend/app/api/routers/products.py`
**Service**: `backend/app/services/products.py`

```
GET /v1/products/check-name?name=Chicken+Breast
Authorization: Bearer <token>

Response 200:
{
  "available": true   // false if a non-deleted product with same name (case-insensitive) exists for device
}
```

Implementation: `SELECT COUNT(*) FROM products WHERE device_id=? AND lower(name)=lower(?) AND deleted_at IS NULL`. Return `{ available: count == 0 }`. No new migration needed.

New Pydantic schema in `backend/app/schemas/product.py`:
```python
class ProductNameCheckResponse(APIModel):
    available: bool
```

---

### New: GET /v1/products/search

**Router**: `backend/app/api/routers/products.py`
**Service**: `backend/app/services/products.py`

```
GET /v1/products/search?q=chick&limit=35
Authorization: Bearer <token>

Response 200: SearchResultItem[]

SearchResultItem:
{
  "id": "uuid",
  "name": "string",
  "source": "user" | "catalog",
  "calories_per_100g": number | null,   // from default portion if catalog
  "catalog_id": "uuid | null"           // set only when source=catalog
}
```

Service logic:
1. Query `products` WHERE `device_id=?` AND `lower(name) LIKE lower('%q%')` AND `deleted_at IS NULL` LIMIT 10 — tag source="user"
2. Query `catalog_products` JOIN `catalog_portions` (default only) WHERE `lower(name) LIKE lower('%q%')` LIMIT 25 — tag source="catalog"
3. Concatenate: user results first, then catalog results. Total returned = up to 35.
4. `limit` param applies to total returned (default 35, max 60).

New Pydantic schemas in `backend/app/schemas/product.py`:
```python
class ProductSearchResultItem(APIModel):
    id: UUID
    name: str
    source: Literal["user", "catalog"]
    calories_per_100g: float | None = None
    catalog_id: UUID | None = None
```

No migration needed. Uses existing tables.

**Route ordering note**: `/check-name` and `/search` must be declared before `/{product_id}` in the router to avoid FastAPI matching them as UUIDs.

---

## Frontend Section

### useProducts hook (`client/src/hooks/useProducts.ts`)

No interface change. `addProduct()` return value is already `Promise<Product>`. Callers handle auto-favorite.

### storage.ts (`client/src/storage/storage.ts`)

Add helper:
```typescript
export const pushProductRecent = async (productId: string): Promise<void>
// prepend id, deduplicate, cap array at 50, save
```

### ProductFormScreen (`client/src/screens/ProductFormScreen.tsx`)

Changes:
- Add `useRef<ReturnType<typeof setTimeout>>` for debounce timer
- On name field change: clear timer, set 400 ms timer to call `GET /v1/products/check-name?name=X`; skip if offline or name empty
- Hold `nameAvailable: boolean | null` in local state; null = unchecked / loading
- Show inline error under name field when `nameAvailable === false` (skip on edit mode for current product's own name)
- After successful `addProduct()`, call `saveProductFavourites([newProduct.id, ...existingFavourites])`

### SelectProductScreen (`client/src/screens/AddMealFlow/components/SelectProduct/index.tsx`)

**State changes**:
- Remove `mode` (all/favourites segmented control) — not part of spec
- Add `searchResults: SearchResultItem[] | null` (null = no search active)
- Add `searchLoading: boolean`
- Add `searchError: boolean`

**Default list** (when query empty):
```typescript
const defaultList = useMemo(() => {
  const favSlot = favourites  // ordered array, first 5
    .slice(0, 5)
    .map(id => productMap.get(id))
    .filter(Boolean)
  const favIds = new Set(favSlot.map(p => p.id))
  const recentSlot = recents
    .filter(id => !favIds.has(id))
    .slice(0, 10)
    .map(id => productMap.get(id))
    .filter(Boolean)
  return [...favSlot, ...recentSlot]
}, [favourites, recents, productMap])
```

Note: `favourites` must change from `Set<string>` to `string[]` to preserve insertion order. `toggleFavourite` prepends on add, removes on remove.

**Search** (when query non-empty):
- Debounce 400 ms → `GET /v1/products/search?q=<query>&limit=35`
- Render `searchResults` instead of `defaultList`
- Show `searchLoading` spinner during fetch
- Show `searchError` + retry button on failure
- Show empty state when `searchResults.length === 0`

**Selecting a catalog result**:
```
user taps catalog item
  → addProduct({ name, caloriesPer100g: item.calories_per_100g ?? 0, ... })
  → saveProductFavourites([newId, ...favourites])
  → navigation.navigate('AddFood', { productId: newProduct.id })
```

**Selecting a user result**:
```
user taps user item
  → navigation.navigate('AddFood', { productId: item.id })
  (recents updated in AddFoodScreen on confirm)
```

**Row rendering**: show a small "Catalog" badge for `source === "catalog"` items in search results.

### AddFoodScreen (`client/src/screens/AddMealFlow/components/AddFood/index.tsx`)

On the "Add" press (after `upsertItem`), call `pushProductRecent(product.id)`.

### Client type additions (`client/src/models/types.ts`)

```typescript
export type ProductSource = "user" | "catalog";

export type ProductSearchResult = {
  id: string;
  name: string;
  source: ProductSource;
  caloriesPer100g: number | null;
  catalogId: string | null;
};
```

---

## Trade-Off Analysis

### Decision 1: Unified /products/search BE endpoint vs client-side merge

| | Unified BE endpoint | Client-side merge (2 calls) |
|---|---|---|
| Pros | Single request; BE controls ordering and limits; simpler FE code | No BE changes; fully offline if needed |
| Cons | BE must know about both tables in one query | Two round trips; client merges; harder to paginate |
| **Recommendation** | Unified BE endpoint | |
| Reversibility | Easy — add pagination later | |

Chosen: unified endpoint. The ordering guarantee (user-first) is a domain rule that belongs on the server. The client should not need to know the merge strategy.

---

### Decision 2: favorites/recents — AsyncStorage-only vs backend-persisted

| | AsyncStorage-only (current) | Backend-persisted |
|---|---|---|
| Pros | Works offline; already implemented; no migration | Survives device reinstall |
| Cons | Lost on reinstall | Sync complexity; needs new table |
| **Recommendation** | AsyncStorage-only for MVP | |

Chosen: keep local. Out of scope to sync favorites/recents for this epic.

---

### Decision 3: Catalog item selection — materialize user product vs reference catalog directly

| | Materialize as user product | Reference catalog_product_id in food_entry |
|---|---|---|
| Pros | Single product model everywhere; AddFoodScreen unchanged; offline fully works | No duplication |
| Cons | Duplicate data; user product has no nutritional data except calories | Schema change on food_entry; AddFoodScreen needs two product lookup paths |
| **Recommendation** | Materialize as user product | |
| Reversibility | Medium — catalog_id field can link back later | |

Chosen: materialize. The client model `Product` is local-first and the AddFoodScreen resolves products by id from AsyncStorage. Introducing a second product source would require splitting that lookup. For MVP, materialize with `caloriesPer100g` from the catalog default portion.

---

## Risks

- **Route ordering conflict**: `GET /v1/products/check-name` must be registered before `GET /v1/products/{product_id}` or FastAPI will try to parse "check-name" as a UUID. Same for `/search`. Mitigation: place both new routes at the top of the router, before the `/{product_id}` routes.
- **Favorites ordering**: current code stores favorites as a `Set<string>` in state, losing insertion order. Changing to `string[]` is a localized state change in SelectProductScreen and storage; no storage format change needed (already serialized as array).
- **Offline name check**: if the network call fails silently, the user can still save a duplicate name. This is acceptable — the backend does not enforce uniqueness either (no unique constraint). Duplicates are cosmetically undesirable but not data-corrupting.
- **Catalog calories mapping**: `catalog_portions.calories` is per `base_amount` (e.g., 28g), not per 100g. The `SearchResultItem.calories_per_100g` field must be computed on the backend: `round(calories / base_amount * 100, 2)`. This calculation belongs in the search service, not the router.

---

## Out of Scope

- Barcode / external product search (ProductSearchScreen, ProductConfirmScreen) — unrelated flow
- Syncing favorites/recents to backend
- Pagination for catalog search results
- Editing or deleting catalog-materialized products differently from user products
- Profile screen changes (entry point already exists)

---

## Next Steps

Hand off to `planner` agent for implementation phases.
