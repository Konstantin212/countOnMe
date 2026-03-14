# Implementation Plan: Products Epic

## Phases Overview

| # | Owner | Name | Depends On | Parallel With |
|---|-------|------|-----------|---------------|
| BE-1 | Backend | check-name endpoint | — | BE-2 |
| BE-2 | Backend | search endpoint | — | BE-1 |
| FE-1 | Frontend | Types + storage helper | — | BE-1, BE-2 |
| FE-2 | Frontend | API client functions | FE-1 | — |
| FE-3 | Frontend | ProductFormScreen — name check + auto-favorite | FE-2 | FE-4 |
| FE-4 | Frontend | SelectProductScreen — default list + search | FE-2 | FE-3 |
| FE-5 | Frontend | AddFoodScreen — push recents | FE-1 | — |

BE-1 and BE-2 can be implemented in parallel.
FE-1, BE-1, BE-2 can be started simultaneously.
FE-3, FE-4, FE-5 can be implemented in parallel once FE-2 is done.

---

## BE-1: check-name endpoint

**Files modified:**
- `backend/app/schemas/product.py` — add `ProductNameCheckResponse`
- `backend/app/services/products.py` — add `check_product_name_available`
- `backend/app/api/routers/products.py` — add `GET /products/check-name` route (before `/{product_id}`)

**Files created:**
- `backend/tests/services/test_products_db.py` — extend with `test_check_name_available_*` cases
- `backend/tests/api/test_products_api.py` — extend with `test_check_name_*` cases

**Tasks:**

1. Add schema to `backend/app/schemas/product.py`:
   ```python
   class ProductNameCheckResponse(APIModel):
       available: bool
   ```

2. Add service function to `backend/app/services/products.py`:
   ```python
   async def check_product_name_available(
       session: AsyncSession, *, device_id: uuid.UUID, name: str
   ) -> bool
   ```
   Implementation: `SELECT COUNT(*) FROM products WHERE device_id=? AND lower(name)=lower(?) AND deleted_at IS NULL`. Return `count == 0`.

3. Add route to `backend/app/api/routers/products.py` **before** `/{product_id}` routes:
   ```python
   @router.get("/check-name", response_model=ProductNameCheckResponse)
   async def products_check_name(name: str = Query(min_length=1), ...)
   ```

**Acceptance tests:**
- `GET /v1/products/check-name?name=Chicken` → `{"available": true}` when no product with that name
- `GET /v1/products/check-name?name=chicken` → `{"available": false}` (case-insensitive) when "Chicken" exists
- Soft-deleted products with same name → `{"available": true}`
- Device B's product with same name does not affect Device A → `{"available": true}`
- Missing `name` param → 422
- Unauthenticated → 401

**Verification:** `cd backend && pytest tests/services/test_products_db.py tests/api/test_products_api.py -v && ruff check app/`

---

## BE-2: search endpoint

**Files modified:**
- `backend/app/schemas/product.py` — add `ProductSearchResultItem`
- `backend/app/services/products.py` — add `search_products`
- `backend/app/api/routers/products.py` — add `GET /products/search` route (before `/{product_id}`)

**Files created:**
- `backend/tests/services/test_products_db.py` — extend with `test_search_products_*` cases
- `backend/tests/api/test_products_api.py` — extend with `test_search_*` cases

**Tasks:**

1. Add schema to `backend/app/schemas/product.py`:
   ```python
   class ProductSearchResultItem(APIModel):
       id: UUID
       name: str
       source: Literal["user", "catalog"]
       calories_per_100g: float | None = None
       catalog_id: UUID | None = None
   ```

2. Add service function to `backend/app/services/products.py`:
   ```python
   async def search_products(
       session: AsyncSession, *, device_id: uuid.UUID, q: str, limit: int = 35
   ) -> list[ProductSearchResultItem]
   ```
   Implementation:
   - Query 1: `products` WHERE `device_id=?` AND `lower(name) LIKE lower('%q%')` AND `deleted_at IS NULL` LIMIT 10, tag `source="user"`
   - Query 2: `catalog_products` JOIN `catalog_portions` (WHERE `is_default=true`) WHERE `lower(name) LIKE lower('%q%')` LIMIT 25, compute `calories_per_100g = round(calories / base_amount * 100, 2)`, tag `source="catalog"`, set `catalog_id=catalog_product.id`
   - Return user results + catalog results, total capped at `limit`

3. Add route to `backend/app/api/routers/products.py` **before** `/{product_id}` routes:
   ```python
   @router.get("/search", response_model=list[ProductSearchResultItem])
   async def products_search(q: str = Query(min_length=1), limit: int = Query(default=35, le=60), ...)
   ```

**Acceptance tests:**
- `GET /v1/products/search?q=chick` → user products matching "chick" appear first, then catalog matches
- Catalog items have `source="catalog"` and non-null `catalog_id`
- User items have `source="user"` and null `catalog_id`
- `calories_per_100g` computed correctly from `calories / base_amount * 100`
- Catalog product with no default portion → `calories_per_100g=null`
- Soft-deleted user products excluded
- `limit` param caps total results
- Unauthenticated → 401
- Missing `q` → 422

**Verification:** `cd backend && pytest tests/services/test_products_db.py tests/api/test_products_api.py -v && ruff check app/`

---

## FE-1: Types + storage helper

**Files modified:**
- `client/src/models/types.ts` — add `ProductSource`, `ProductSearchResult`
- `client/src/storage/storage.ts` — add `pushProductRecent`
- `client/src/storage/storage.test.ts` — add tests for `pushProductRecent`

**Tasks:**

1. Add to `client/src/models/types.ts`:
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

2. Add to `client/src/storage/storage.ts`:
   ```typescript
   export const pushProductRecent = async (productId: string): Promise<void> => {
     const existing = await loadProductRecents();
     const deduped = [productId, ...existing.filter(id => id !== productId)];
     await saveProductRecents(deduped.slice(0, 50));
   };
   ```

3. Add tests to `client/src/storage/storage.test.ts` under `describe("product favourites and recents")`:
   - `pushProductRecent` prepends id to front
   - `pushProductRecent` deduplicates existing id (moves to front)
   - `pushProductRecent` caps at 50 items

**Acceptance tests:**
- `pnpm test -- storage.test.ts` passes
- `npx tsc --noEmit` passes

**Verification:** `cd client && pnpm test -- storage.test.ts && npx tsc --noEmit`

---

## FE-2: API client functions

**Files modified:**
- `client/src/services/api/products.ts` — add `checkProductName`, `searchProducts`

**Files created:**
- (tests inline — no separate test file for API layer; covered by integration)

**Tasks:**

1. Add to `client/src/services/api/products.ts`:
   ```typescript
   export type ProductNameCheckResponse = { available: boolean };

   export type ProductSearchResultResponse = {
     id: string;
     name: string;
     source: "user" | "catalog";
     calories_per_100g: number | null;
     catalog_id: string | null;
   };

   export const checkProductName = async (name: string): Promise<ProductNameCheckResponse> =>
     apiFetch<ProductNameCheckResponse>('/v1/products/check-name', { query: { name } });

   export const searchProducts = async (q: string, limit = 35): Promise<ProductSearchResultResponse[]> =>
     apiFetch<ProductSearchResultResponse[]>('/v1/products/search', { query: { q, limit } });
   ```

2. The `apiFetch` `query` param already handles string/number/boolean — no change to `http.ts`.

**Acceptance tests:**
- `npx tsc --noEmit` passes (types resolve correctly)

**Verification:** `cd client && npx tsc --noEmit`

---

## FE-3: ProductFormScreen — name check + auto-favorite

**Files modified:**
- `client/src/screens/ProductFormScreen.tsx` — debounced name check, inline error, auto-favorite on create

**Tasks:**

1. Add state: `const [nameAvailable, setNameAvailable] = useState<boolean | null>(null)`
2. Add debounce ref: `const nameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)`
3. Add `NetInfo` or use try/catch to skip silently when offline (use try/catch — no new dep needed; `ApiError` with network failure already throws)
4. On name field `onChangeText`: clear existing timer, set 400ms timer calling `checkProductName(name.trim())`:
   - If name empty or `isEditing` and name matches current product's own name → `setNameAvailable(null)`, return
   - On success: `setNameAvailable(result.available)`
   - On error (network/offline): `setNameAvailable(null)` (silent skip)
5. Show inline error under name field when `nameAvailable === false`: text "Name already used"
6. Disable Save button additionally when `nameAvailable === false`
7. In `onSubmit`, after successful `addProduct()` call:
   ```typescript
   const existing = await loadProductFavourites();
   await saveProductFavourites([newProduct.id, ...existing]);
   ```
8. Import `loadProductFavourites`, `saveProductFavourites` from `@storage/storage`
9. Import `checkProductName` from `@services/api/products`

**Acceptance tests (manual):**
- Type "Chicken Breast" (existing name) → inline "Name already used" error appears after 400ms debounce
- Type own product's name in edit mode → no error shown
- Type unique name → no error
- Submit with name conflict → Save button disabled
- Create product → product appears in favorites list

**Verification:** `cd client && npx tsc --noEmit && pnpm run lint`

---

## FE-4: SelectProductScreen — default list + search

**Files modified:**
- `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx` — full rewrite of state + rendering logic

**Tasks:**

1. **Change `favourites` from `Set<string>` to `string[]`** (ordered):
   - `useState<string[]>([])`
   - `loadProductFavourites()` returns `string[]` — assign directly
   - `toggleFavourite`: if already in list → filter out; if not → prepend
   - `saveProductFavourites(nextArray)`

2. **Add search state:**
   ```typescript
   const [searchResults, setSearchResults] = useState<ProductSearchResult[] | null>(null);
   const [searchLoading, setSearchLoading] = useState(false);
   const [searchError, setSearchError] = useState(false);
   const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   ```

3. **Build `defaultList` via `useMemo`** (replace existing `filtered` logic when `query` is empty):
   ```typescript
   const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
   const defaultList = useMemo(() => {
     const favSlot = favourites.slice(0, 5).map(id => productMap.get(id)).filter(Boolean) as Product[];
     const favIds = new Set(favSlot.map(p => p.id));
     const recentSlot = recents.filter(id => !favIds.has(id)).slice(0, 10).map(id => productMap.get(id)).filter(Boolean) as Product[];
     return [...favSlot, ...recentSlot];
   }, [favourites, recents, productMap]);
   ```

4. **Debounced search** on `query` change:
   - Clear timer; if empty → `setSearchResults(null)`, return
   - Set 400ms timer → `searchProducts(query, 35)`
   - Set `searchLoading(true)` before call, `false` after
   - On success: transform snake_case to camelCase → `setSearchResults(transformed)`
   - On error: `setSearchError(true)`

5. **Render logic** in FlatList:
   - When `query` non-empty: render `searchResults` (or loading spinner / error state)
   - When `query` empty: render `defaultList`
   - Search results: user rows render same as before; catalog rows show a "Catalog" text badge

6. **Catalog item tap handler:**
   ```typescript
   const handleCatalogSelect = async (item: ProductSearchResult) => {
     const newProduct = await addProduct({ name: item.name, caloriesPer100g: item.caloriesPer100g ?? 0 });
     const existing = await loadProductFavourites();
     await saveProductFavourites([newProduct.id, ...existing]);
     navigation.navigate('AddFood', { productId: newProduct.id });
   };
   ```

7. **Remove `mode` / `SegmentedButtons`** — not in spec.

8. **Empty state**: when `searchResults?.length === 0` → show "No results for query" text.

9. **Error state + retry**: when `searchError === true` → show error message + Pressable "Retry" that re-runs search.

**Acceptance tests (manual):**
- Default list: first 5 favourites, then up to 10 recents not already in favourites, max 15 total
- Empty query → shows default list; no spinner
- Type 3+ chars → spinner → results appear; user results first, catalog items have badge
- Tap user result → navigate to AddFood
- Tap catalog result → creates product, adds to favorites, navigates to AddFood
- Network error during search → error message + retry button visible
- Empty results → "No results" empty state

**Verification:** `cd client && npx tsc --noEmit && pnpm run lint`

---

## FE-5: AddFoodScreen — push recents

**Files modified:**
- `client/src/screens/AddMealFlow/components/AddFood/index.tsx` — call `pushProductRecent` on Add press

**Tasks:**

1. Import `pushProductRecent` from `@storage/storage`
2. In the "Add" `onPress` handler, after `upsertItem(...)`:
   ```typescript
   await pushProductRecent(product.id);
   ```
3. The call is fire-and-forget from UX perspective but must not block navigation; `await` is fine here since `pushProductRecent` is fast (AsyncStorage write).

**Acceptance tests (manual):**
- Tap "Add" on any product → subsequent visit to SelectProduct shows that product in recents slot

**Verification:** `cd client && npx tsc --noEmit && pnpm run lint`

---

## Testing Strategy

**Backend unit tests** (`backend/tests/services/test_products_db.py`):
- `test_check_name_available_true` — no matching product
- `test_check_name_available_false` — case-insensitive match
- `test_check_name_ignores_deleted` — soft-deleted products counted as available
- `test_check_name_device_scoped` — other device's product doesn't affect result
- `test_search_returns_user_first` — user results precede catalog results
- `test_search_calories_per_100g_computed` — correct formula
- `test_search_catalog_no_default_portion_null_calories` — graceful null
- `test_search_limit_cap` — total capped at limit

**Backend integration tests** (`backend/tests/api/test_products_api.py`):
- `test_check_name_available` / `test_check_name_taken` / `test_check_name_requires_auth`
- `test_search_returns_results` / `test_search_requires_auth` / `test_search_missing_q`

**Frontend unit tests** (`client/src/storage/storage.test.ts`):
- `pushProductRecent` prepend, dedup, cap at 50

**Manual verification checklist:**
- [ ] Name check fires after 400ms; not on every keystroke
- [ ] Offline: name check skipped silently; form still submittable
- [ ] Edit mode: no name-check error for own current name
- [ ] Default list ordering: 5 favs → 10 recents → max 15
- [ ] Search debounce 400ms; spinner visible
- [ ] Catalog badge visible on search results
- [ ] Catalog select: product created, favorited, navigated
- [ ] After Add in AddFoodScreen: product appears in recents on next SelectProduct open

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Route ordering: `/check-name` and `/search` matched as UUIDs | High | Register both routes **before** `/{product_id}` in router; covered by integration tests that would fail on wrong ordering |
| `favourites` type change from `Set` to `string[]` in SelectProduct | Medium | Localized to that file; `has()` calls become `includes()` or `new Set(favourites).has()` — search for all usages before editing |
| Catalog portion missing default → `calories_per_100g` null | Low | Service handles null explicitly; client materializes with `?? 0` |
| Name check silently skipped offline → duplicate names possible | Low | Acceptable per spec; no unique constraint on backend either |
| `pushProductRecent` fails silently | Low | Wrap in try/catch; do not block navigation |
