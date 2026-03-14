---
type: plan
status: completed
created: 2026-03-14
---

# Bug Fix Plan: CountOnMe — 6 Bugs

## Overview

Six bugs spanning client and backend. Fixes are grouped into five self-contained phases. Phases 1, 2, and 4 are frontend-only. Phase 3 (Bug 4 BE) and Phase 4 (Bug 4 FE) have a hard dependency — Phase 3 must ship first. All other phases are independent and can run in parallel.

---

## Parallelism Map

```
Phase 1 (Bugs 2+3)   ──────────────────────── independent
Phase 2 (Bug 1)      ──────────────────────── independent
Phase 3 (Bug 4 BE)   ──────────────┐
Phase 4 (Bug 4 FE)   (after P3)   ┘          sequential
Phase 5 (Bug 5)      ──────────────────────── independent
Phase 6 (Bug 6)      ──────────────────────── independent
```

Phases 1, 2, 3, 5, and 6 can start simultaneously. Phase 4 must wait for Phase 3 to be merged.

---

## Phase 1 — Bugs 2 & 3: Remove premature favorite from catalog select (FE)

**Bugs fixed:** Bug 2 (item favorited before user saves), Bug 3 (catalog item shows as starred instead of recent)

**Root cause:** `handleCatalogSelect` in `SelectProduct/index.tsx` calls `saveProductFavourites` before the user confirms in `AddFood`. This both corrupts the favorites list and causes the wrong icon to render after the user does confirm.

### Files Modified

- `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx`

### Tasks

1. **Remove favorite mutation from `handleCatalogSelect`**
   - Action: Delete lines 150-151 (`const existing = await loadProductFavourites()` and `await saveProductFavourites([newProduct.id, ...existing])`).
   - The function should only call `addProduct(...)` to materialize the product in local storage, then `navigation.navigate("AddFood", { productId: newProduct.id })`.
   - After this change the import of `saveProductFavourites` from `@storage/storage` is no longer used inside `handleCatalogSelect`. Check whether it is used anywhere else in the file — it is not (only `loadProductFavourites` is used, for `toggleFavourite`). Remove the `saveProductFavourites` named import.

2. **Render refresh icon for recents-only items in `renderUserRow`**
   - Action: In `renderUserRow`, replace the static `star` / `star-outline` icon logic with a three-state icon:
     - Item is in `favouriteSet`: render `star` (warning color) — existing behavior.
     - Item is NOT in `favouriteSet` but IS in the `recents` array: render `refresh-circle-outline` (textSecondary color).
     - Item is in neither: render `star-outline` (textSecondary color) — existing fallback.
   - The `recents` state array is already loaded in this component. Convert it to a `Set` (`const recentSet = useMemo(() => new Set(recents), [recents])`) alongside the existing `favouriteSet` memo.
   - The `onPress` of the icon button still calls `toggleFavourite(item.id)` for all three states — the icon is a visual indicator only.

### Verification

```bash
cd client && npx tsc --noEmit
cd client && pnpm test
```

Manual: Search for a catalog item, navigate to AddFood, press back. Confirm item is not in favorites. Search again, confirm in AddFood and press Add. Confirm item shows refresh icon (not star) in the default list.

---

## Phase 2 — Bug 1: Restore All/Favourited tabs to SelectProduct (FE)

**Bug fixed:** Bug 1 (missing All/Favourited tabs)

**Root cause:** Tabs were removed in a prior refactor. The default list currently shows favorites + recents interleaved. The required UX is two explicit tabs: "All" (all local products) and "Favourited" (favorited products only). These tabs are only visible when no search query is active.

### Files Modified

- `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx`

### Tasks

1. **Add tab state**
   - Action: Add `const [tab, setTab] = useState<"all" | "favourited">("all")` near the other `useState` calls.

2. **Compute tab-specific list**
   - Action: Replace the `defaultList` memo with two separate memos:
     - `allList`: `products` array sorted alphabetically by name (mirrors the current flat product list).
     - `favouritedList`: `favourites.map(id => productMap.get(id)).filter(Boolean)` (ordered by favorite order, top 50 or all).
   - Keep the combined `defaultList` name as a derived value: `const defaultList = tab === "all" ? allList : favouritedList`.

3. **Render tab bar**
   - Action: Below the search `TextInput` and above the "Create new product" button, render a tab bar using `SegmentedButtons` from `react-native-paper` (already installed and imported in `AddFood`). Add the import to `SelectProduct`.
     - `buttons`: `[{ value: "all", label: "All" }, { value: "favourited", label: "Favourited" }]`
     - `value`: `tab`
     - `onValueChange`: `(v) => setTab(v as "all" | "favourited")`
   - The tab bar is only visible when `!isSearchActive` — wrap it in a conditional or apply `display: none` via style.

4. **Wire list to tab**
   - Action: The existing `FlatList` in the non-search branch already uses `defaultList`. With the new memo it will automatically reflect the active tab — no change needed to the `FlatList` itself.

### Verification

```bash
cd client && npx tsc --noEmit
cd client && pnpm test
```

Manual: Open SelectProduct. Confirm two tabs appear. "All" shows all products. "Favourited" shows only starred products. Tabs disappear when typing in search.

---

## Phase 3 — Bug 4 (BE): Add macros to product search response (BE)

**Bug fixed:** Bug 4, backend half

**Root cause:** `ProductSearchResultItem` schema and `search_products` service only return `calories_per_100g`. The `CatalogPortion` model has `protein`, `carbs`, `fat` columns. They need to be computed and returned the same way calories are.

### Files Modified

- `backend/app/schemas/product.py`
- `backend/app/services/products.py`
- `backend/tests/services/test_products_db.py`
- `backend/tests/api/test_products_api.py`

### Tasks

1. **Extend `ProductSearchResultItem` schema**
   - File: `backend/app/schemas/product.py`
   - Action: Add three optional fields to `ProductSearchResultItem`:
     ```
     protein_per_100g: float | None = None
     carbs_per_100g: float | None = None
     fat_per_100g: float | None = None
     ```

2. **Add macro computation helper in service**
   - File: `backend/app/services/products.py`
   - Action: The existing `_compute_calories_per_100g(calories, base_amount)` helper is a pure function. Add a parallel `_compute_macro_per_100g(macro: Decimal | None, base_amount: Decimal) -> float | None` helper:
     - Returns `None` if `macro` is `None` or `base_amount == 0`.
     - Otherwise: `round(float(macro) / float(base_amount) * 100, 2)`.

3. **Populate macros in `search_products` for catalog results**
   - File: `backend/app/services/products.py`
   - Action: In the catalog loop, after computing `calories_per_100g`, compute:
     ```python
     protein_per_100g = _compute_macro_per_100g(default_portion.protein, default_portion.base_amount) if default_portion else None
     carbs_per_100g   = _compute_macro_per_100g(default_portion.carbs,   default_portion.base_amount) if default_portion else None
     fat_per_100g     = _compute_macro_per_100g(default_portion.fat,     default_portion.base_amount) if default_portion else None
     ```
     Pass all three to `ProductSearchResultItem(...)` when appending to `catalog_results`.
   - For user products (`user_results` list), keep `protein_per_100g=None`, `carbs_per_100g=None`, `fat_per_100g=None` (user products have no macro data in the backend at this time).

4. **Add / update backend tests**
   - File: `backend/tests/services/test_products_db.py`
   - Action: Add a test `test_search_macros_per_100g_computed` that:
     - Creates a `CatalogProduct` with a default `CatalogPortion` having known `protein`, `carbs`, `fat`, and `base_amount`.
     - Calls `search_products(...)` and asserts the returned item has correct `protein_per_100g`, `carbs_per_100g`, `fat_per_100g` rounded to 2 dp.
   - Add a test `test_search_catalog_no_macro_data_null` that sets `protein=None` on the portion and confirms the returned field is `None`.
   - File: `backend/tests/api/test_products_api.py`
   - Action: In the existing `test_search_source_tags` test (or a new companion test), assert that a catalog result includes `protein_per_100g`, `carbs_per_100g`, `fat_per_100g` keys in the JSON response. Presence check is sufficient if seeded macro data is not available in the test fixture.

### Verification

```bash
cd backend && ruff check app/
cd backend && pytest tests/services/test_products_db.py tests/api/test_products_api.py --cov=app/services/products --cov-report=term-missing
```

---

## Phase 4 — Bug 4 (FE): Consume macros from search response (FE)

**Depends on:** Phase 3 (backend must return macro fields before this is useful)

**Bug fixed:** Bug 4, frontend half — macro balance chart empty for catalog items

### Files Modified

- `client/src/services/api/products.ts`
- `client/src/models/types.ts`
- `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx`

### Tasks

1. **Extend `ProductSearchResultResponse` API type**
   - File: `client/src/services/api/products.ts`
   - Action: Add to `ProductSearchResultResponse`:
     ```ts
     protein_per_100g: number | null;
     carbs_per_100g: number | null;
     fat_per_100g: number | null;
     ```

2. **Extend `ProductSearchResult` domain type**
   - File: `client/src/models/types.ts`
   - Action: Add to `ProductSearchResult`:
     ```ts
     proteinPer100g: number | null;
     carbsPer100g: number | null;
     fatPer100g: number | null;
     ```

3. **Map macro fields in `runSearch`**
   - File: `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx`
   - Action: In the `data.map(...)` inside `runSearch`, extend the mapped object:
     ```ts
     proteinPer100g: item.protein_per_100g,
     carbsPer100g: item.carbs_per_100g,
     fatPer100g: item.fat_per_100g,
     ```

4. **Pass macros from `handleCatalogSelect` to `addProduct`**
   - File: `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx`
   - Action: In `handleCatalogSelect`, when calling `addProduct({...})`, add:
     ```ts
     caloriesPer100g: item.caloriesPer100g ?? 0,
     proteinPer100g: item.proteinPer100g ?? undefined,
     carbsPer100g: item.carbsPer100g ?? undefined,
     fatPer100g: item.fatPer100g ?? undefined,
     ```
   - `NewProductInput` in `useProducts.ts` already accepts `proteinPer100g`, `carbsPer100g`, `fatPer100g` — no change needed there.
   - `createProductRecord` already maps these to `proteinPer100g`, `carbsPer100g`, `fatPer100g` on the stored `Product` — no change needed there.

### Verification

```bash
cd client && npx tsc --noEmit
cd client && pnpm test
```

Manual: Search a catalog item with known macros. Select it, confirm Add. Open the macro chart for that product's meal entry and verify it is non-empty.

---

## Phase 5 — Bug 5: Persist draft meal across Add Meal sessions (FE)

**Bug fixed:** Bug 5 — draft cleared on close; re-opening Add Meal shows empty state

**Root cause:** `DraftMealContext` is pure React state with no AsyncStorage backing. `reset()` clears state but not storage. On remount the state initializes empty.

### Files Modified

- `client/src/storage/storage.ts`
- `client/src/screens/AddMealFlow/context.tsx`

### Tasks

1. **Add storage key and draft persistence functions**
   - File: `client/src/storage/storage.ts`
   - Action:
     - Add `draftMeal: \`${STORAGE_PREFIX}/draft-meal/${STORAGE_VERSION_V1}\`` to `STORAGE_KEYS`.
     - Import `DraftMealState` from `@screens/AddMealFlow/context` — but this would create a circular import since `context.tsx` imports from `@models/types`. To avoid the circular dependency, use the inline shape: the stored type is `{ mealType: string; itemsByMealType: Record<string, { productId: string; amount: number; unit: string }[]> }`. Alternatively, define a `StoredDraftMeal` type locally in `storage.ts` that mirrors the shape. Use `unknown` with a type guard, or simply cast via `JSON.parse` to `DraftMealState` with a comment noting the trust boundary.
     - Add `loadDraftMeal(): Promise<DraftMealState | null>` — reads `STORAGE_KEYS.draftMeal`, parses JSON, returns null on missing or error.
     - Add `saveDraftMeal(draft: DraftMealState): Promise<void>` — writes JSON to `STORAGE_KEYS.draftMeal`.
     - Add `clearDraftMeal(): Promise<void>` — removes `STORAGE_KEYS.draftMeal`.
   - Import `MealItem` and `MealTypeKey` from `@models/types` for the `DraftMealState` shape (these are already in scope in storage.ts).

2. **Hydrate draft from storage on provider mount**
   - File: `client/src/screens/AddMealFlow/context.tsx`
   - Action: Import `loadDraftMeal`, `saveDraftMeal`, `clearDraftMeal` from `@storage/storage`.
   - Add a `useEffect` inside `DraftMealProvider` that runs once on mount:
     ```ts
     useEffect(() => {
       loadDraftMeal().then((stored) => {
         if (stored) setDraft(stored);
       }).catch(() => { /* non-blocking */ });
     }, []);
     ```
   - Add `const [hydrated, setHydrated] = useState(false)` and set it to true after the load completes if you want to gate rendering (optional — mark as low priority if it causes complexity).

3. **Persist draft on every mutation**
   - File: `client/src/screens/AddMealFlow/context.tsx`
   - Action: After each `setDraft(...)` call in `setMealType`, `upsertItem`, and `removeItem`, schedule a non-blocking save. Because `setDraft` is async in effect (state updates are batched), use a `useEffect` that watches `draft` and saves:
     ```ts
     useEffect(() => {
       saveDraftMeal(draft).catch(() => { /* non-blocking */ });
     }, [draft]);
     ```
     This is simpler than calling save inside each callback and avoids stale closure issues. The effect fires after every render where `draft` changed.
   - Do NOT save on the initial render before hydration completes. Gate with the `hydrated` flag: `if (!hydrated) return;` at the top of the save effect.

4. **Clear storage on `reset()`**
   - File: `client/src/screens/AddMealFlow/context.tsx`
   - Action: In the `reset` callback, after `setDraft({ mealType: DEFAULT_MEAL_TYPE, ... })`, call `void clearDraftMeal()`.

### Verification

```bash
cd client && npx tsc --noEmit
cd client && pnpm test -- --testPathPattern storage
```

Manual: Add products to Add Meal, close the screen (go back), reopen Add Meal. Products should still be listed. Save the meal. Reopen Add Meal — draft should be empty.

---

## Phase 6 — Bug 6: Hide catalog-materialized products from My Products list (FE)

**Bug fixed:** Bug 6 — catalog items appear in the user's product list

**Root cause:** `Product` type has no `source` field. All materialized products (from catalog or user-created) are stored in the same list with no way to distinguish them. `ProductsListScreen` renders everything.

### Files Modified

- `client/src/models/types.ts`
- `client/src/hooks/useProducts.ts`
- `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx`
- `client/src/screens/ProductFormScreen.tsx`

### Files to Check (likely no change needed, verify)

- `client/src/screens/ProductsListScreen.tsx` — add filter here

### Tasks

1. **Add `source` to `Product` type**
   - File: `client/src/models/types.ts`
   - Action: Add optional field to `Product`:
     ```ts
     source?: "user" | "catalog";
     ```
     Optional (not required) so existing stored products without the field are backward-compatible. Absence means "user".

2. **Add `source` to `NewProductInput`**
   - File: `client/src/hooks/useProducts.ts`
   - Action: Add `source?: "user" | "catalog"` to `NewProductInput`. Default to `"user"` in `createProductRecord` when not provided:
     ```ts
     source: input.source ?? "user",
     ```

3. **Pass `source: "catalog"` from `handleCatalogSelect`**
   - File: `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx`
   - Action: In `handleCatalogSelect`, add `source: "catalog"` to the `addProduct(...)` call:
     ```ts
     const newProduct = await addProduct({
       name: item.name,
       caloriesPer100g: item.caloriesPer100g ?? 0,
       source: "catalog",
       // macros added in Phase 4
     });
     ```

4. **Pass `source: "user"` from `ProductFormScreen.onSubmit`**
   - File: `client/src/screens/ProductFormScreen.tsx`
   - Action: Find the `addProduct(...)` call in the form submit handler. Add `source: "user"` to the input object. Existing products created before this fix have `source: undefined`, which is treated as "user" by the filter in step 5.

5. **Filter catalog products in `ProductsListScreen`**
   - File: `client/src/screens/ProductsListScreen.tsx` (read the file first to find the render location)
   - Action: Where `products` from `useProducts()` is passed to the list, apply:
     ```ts
     const userProducts = products.filter((p) => p.source !== "catalog");
     ```
     Use `userProducts` as the `data` prop for the `FlatList`. No other changes needed.

### Verification

```bash
cd client && npx tsc --noEmit
cd client && pnpm test
```

Manual: Search a catalog item and add it to a meal. Navigate to My Products (Products tab). Confirm the catalog item does not appear. Create a product via the form. Confirm it does appear.

---

## Success Criteria

- [ ] Selecting a catalog item then pressing back does not add it to favorites (Bug 2)
- [ ] After adding a catalog item via AddFood, it shows a refresh icon, not a star (Bug 3)
- [ ] SelectProduct shows All and Favourited tabs when no search is active (Bug 1)
- [ ] Product search results include `protein_per_100g`, `carbs_per_100g`, `fat_per_100g` from backend (Bug 4 BE)
- [ ] Catalog items materialized via search carry macro data into the stored Product (Bug 4 FE)
- [ ] Reopening Add Meal restores the in-progress draft (Bug 5)
- [ ] My Products list excludes catalog-materialized items (Bug 6)
- [ ] `tsc --noEmit` passes with zero errors after all phases
- [ ] `ruff check app/` passes after Phase 3
- [ ] All existing tests remain green after each phase

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Circular import: `storage.ts` importing from `context.tsx` for `DraftMealState` type | Medium | Define the draft shape inline in storage.ts using `MealItem` and `MealTypeKey` from `@models/types` directly, without importing from context |
| Existing stored products with no `source` field break filtering | Low | Field is optional in type; filter uses `!== "catalog"` so `undefined` is treated as "user" |
| Draft save effect fires before hydration completes, overwriting restored state | Medium | Gate the save effect with the `hydrated` boolean flag; skip save on first render |
| `test_search_macros_per_100g_computed` needs a seeded catalog product with a default portion | Medium | Follow the pattern in `test_search_calories_per_100g_computed` in `test_products_db.py` which already creates catalog fixtures |
| Phase 4 ships before Phase 3, causing TS errors on new type fields | Low | Phase 4 is explicitly blocked on Phase 3; enforce in PR order |
