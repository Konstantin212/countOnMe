# Implementation Plan: Barcode Scan to Meal Tracking

## Overview

Transform the barcode scan flow from "save product to My Products" into "track food entry directly". Currently, scanning a barcode leads to `ProductConfirmScreen` which saves a product to the user's local product list. The new flow lets the user select a meal type, choose a portion mode (per-serving or per-100g), enter a quantity, and create a food entry in the backend -- making the scanned food appear immediately in My Day stats, meal type entries, and the Add Meal screen. Additionally, barcode scanning is removed from the Profile stack entirely and wired up in MyDay and MyPath FABs.

## Success Criteria

- [ ] After scanning, user sees meal type selector (breakfast/lunch/dinner/snacks), portion selector with two modes (per-serving and per-100g), quantity/amount input, favourite toggle, and "Track Food" button
- [ ] Per-serving mode: user picks a serving portion (e.g., "30g serving"), enters quantity (2, 3, etc.), nutritional values = serving * quantity
- [ ] Per-100g mode: user picks the 100g portion, selects a unit (g/mg/kg defaulting to catalog's base_unit), enters a raw amount (e.g., 150), nutritional values = proportional calculation
- [ ] If product has BOTH serving and per-100g portions, both options are shown
- [ ] Pressing "Track Food" creates a food entry in the backend (product + portion + food entry)
- [ ] My Day screen reflects the new entry in macro balance rings and meal type calorie bars
- [ ] MealTypeEntries screen shows the scanned product in its food entry list
- [ ] AddMeal screen shows the scanned product under "Already logged today" for the correct meal type
- [ ] Profile > My Products does NOT show catalog-sourced products (already works via `source === "user"` filter)
- [ ] Favourite toggle persists selection to product favourites storage
- [ ] Navigation returns to MyDay after successful tracking
- [ ] "Scan food" FAB button works on both MyDay and MyPath screens
- [ ] No barcode scanning is accessible from the Profile stack
- [ ] OFF fallback: products from Open Food Facts (not in catalog) still use the original "Save Product" flow

## Assumptions

- **Backend needs no changes** -- validated by reading `backend/app/features/meals/service.py`: `create_food_entry` accepts any `product_id` + `portion_id` as long as the product/portion exist for the device. The client must ensure the product and portion are synced to the backend before creating the food entry.
- **Catalog products must be "imported" as user products** -- validated by reading `meals/service.py` line 48: `get_product(session, device_id=device_id, product_id=product_id)` checks the `products` table (device-scoped). Catalog products live in `catalog_products` (global). So we must create a user product + portion from catalog data before creating a food entry. This is the same pattern `SelectProductScreen.handleCatalogSelect` uses.
- **ProductsListScreen already excludes catalog products** -- validated at line 19-22: `products.filter((p) => p.source === "user")`. Products created with `source: "catalog"` are excluded. No change needed.
- **Client `CatalogPortionResponse.name` should be `label`** -- The backend sends `label` (see `catalog/schemas.py` line 12) but the client type maps it to `name` (see `catalog.ts` line 5). This field is never read in the current flow but will be needed to display portion names. Must fix.
- **The barcode endpoint returns ALL portions** -- validated by reading `catalog/router.py` line 83: the `/barcode/{barcode}` endpoint returns `portions: [CatalogPortionResponse]` array including per-100g and per-serving portions.
- **MyPath FAB already cross-navigates to MyDay stack** -- validated at `MyPathScreen.tsx` line 297-300: "Add meal" uses `navigation.getParent().navigate("MyDayTab", { screen: "AddMeal" })`. "Scan food" can use the same pattern to navigate to `BarcodeScanner`.

## Architecture Changes

Three categories of change:

1. **Remove barcode from Profile stack**: Delete `BarcodeScanner` and `ProductConfirm` routes from `ProfileStackParamList`, remove their screen registrations from `AppNavigator`, remove the "Scan Barcode" button from `ProductSearchScreen`, and simplify `BarcodeScannerScreen` and `ProductConfirmScreen` to only accept `MyDayStackParamList` props.

2. **Wire up FABs**: Connect the empty `onPress: () => {}` handlers for "Scan food" on both `MyDayScreen` and `MyPathScreen` to navigate to the barcode scanner.

3. **Rewrite ProductConfirmScreen**: Replace "Save Product" with "Track Food" featuring two-mode portion selection (per-serving and per-100g).

## Files Affected

### Modified Files

| # | File | Change Scope | Description |
|---|------|-------------|-------------|
| 1 | `client/src/services/api/catalog.ts` | Small | Fix `CatalogPortionResponse.name` to `label`; make `gram_weight` nullable |
| 2 | `client/src/hooks/useBarcodeLookup.ts` | Small | Extend `BarcodeLookupResult` with `catalogProductId` and `catalogPortions` |
| 3 | `client/src/app/navigationTypes.ts` | Medium | Expand `ExternalProductParam` with catalog fields; remove `BarcodeScanner` and `ProductConfirm` from `ProfileStackParamList` |
| 4 | `client/src/app/AppNavigator.tsx` | Medium | Remove `BarcodeScanner` and `ProductConfirm` screen registrations from ProfileStack |
| 5 | `client/src/screens/BarcodeFlow/BarcodeScannerScreen.tsx` | Medium | Remove `ProfileProps` type union; simplify to MyDay-only; pass catalog data in nav params |
| 6 | `client/src/screens/ProductFlow/ProductSearchScreen.tsx` | Small | Remove "Scan Barcode" button and related styles |
| 7 | `client/src/screens/ProductFlow/ProductConfirmScreen.tsx` | **Major** | Rewrite: remove `ProfileProps` type union; add meal type selector, two-mode portion picker, quantity/amount input, favourite toggle, "Track Food" button |
| 8 | `client/src/screens/MyDayScreen.tsx` | Small | Wire "Scan food" FAB `onPress` to navigate to `BarcodeScanner` |
| 9 | `client/src/screens/MyPath/MyPathScreen.tsx` | Small | Wire "Scan food" FAB `onPress` to cross-navigate to `MyDayTab` > `BarcodeScanner` |
| 10 | `client/src/services/analytics.ts` | Small | Add `food_tracked_via_barcode` event to `AnalyticsEvent` union |
| 11 | `client/src/hooks/useBarcodeLookup.test.tsx` | Medium | Update mock catalog responses and assertions for new fields |

**Total: 11 files modified, 0 new files.**

## Implementation Steps

### Phase 1: Remove Barcode from Profile Stack (4 files)

This phase cleanly removes all barcode scanning capability from the Profile stack. Must be done first because later phases simplify the BarcodeScannerScreen and ProductConfirmScreen types to be MyDay-only.

1. **Remove BarcodeScanner and ProductConfirm from ProfileStackParamList** (`client/src/app/navigationTypes.ts`)
   - Action: Delete these two entries from `ProfileStackParamList`:
     ```
     ProductConfirm: { externalProduct: ExternalProductParam };
     BarcodeScanner: undefined;
     ```
   - Why: Profile stack should no longer host barcode scanning.
   - Dependencies: None
   - Risk: Medium -- any Profile-stack code referencing these routes will fail type-check, which is what we want (it exposes all removal points).
   - Test: `npx tsc --noEmit` will show errors in files that still reference these routes. Fix them in the next steps.

2. **Remove BarcodeScanner and ProductConfirm screens from ProfileStackNavigator** (`client/src/app/AppNavigator.tsx`)
   - Action: Delete these two `<ProfileStack.Screen>` entries (lines 92-100):
     ```
     <ProfileStack.Screen name="ProductConfirm" ... />
     <ProfileStack.Screen name="BarcodeScanner" ... />
     ```
   - Why: No barcode screens in Profile stack.
   - Dependencies: Phase 1 Step 1
   - Risk: Low -- just removing screen registrations.
   - Test: Types compile (no more type errors from AppNavigator).

3. **Remove "Scan Barcode" button from ProductSearchScreen** (`client/src/screens/ProductFlow/ProductSearchScreen.tsx`)
   - Action: Delete the third `<TouchableOpacity>` in the button row (lines 300-312) that navigates to `BarcodeScanner`. Also delete the unused `scanIcon` style. The button row will have only "Add New Product" and "Add New Meal".
   - Why: Profile stack no longer has barcode scanning.
   - Dependencies: Phase 1 Step 1
   - Risk: Low -- removing a UI element.
   - Test: `npx tsc --noEmit` passes.

4. **Simplify BarcodeScannerScreen to MyDay-only** (`client/src/screens/BarcodeFlow/BarcodeScannerScreen.tsx`)
   - Action: Remove the `ProfileProps` type (lines 22-25) and the `Props = MyDayProps | ProfileProps` union (line 26). Change `Props` to just `NativeStackScreenProps<MyDayStackParamList, "BarcodeScanner">`. Remove the `ProfileStackParamList` import. The `(navigation as MyDayProps["navigation"])` cast on line 69 can become a direct `navigation` call since it's no longer a union type.
   - Why: Simplifies type handling. The scanner only lives in MyDay stack now.
   - Dependencies: Phase 1 Steps 1 and 2
   - Risk: Low -- removing type complexity.
   - Test: `npx tsc --noEmit` passes.

**Phase 1 Verification**: `cd client && npx tsc --noEmit && pnpm test`

### Phase 2: Data Layer -- Fix Types & Extend Barcode Result (3 files)

This phase ensures the catalog portion data flows correctly from API to the confirm screen.

1. **Fix CatalogPortionResponse type** (`client/src/services/api/catalog.ts`)
   - Action: In the `CatalogPortionResponse` type, rename `name: string` to `label: string`. Change `gram_weight: number` to `gram_weight: number | null` (the backend `CatalogPortion.gram_weight` is `Decimal | None`).
   - Why: The backend sends `label` not `name`. The field is needed to display portion names in the selector. `gram_weight` is nullable for dimensionless units (e.g., "pcs").
   - Dependencies: None
   - Risk: Low -- `name` is not read anywhere in the current codebase. The only consumer of `gram_weight` is `catalogToResult` in `useBarcodeLookup.ts` which already handles the value numerically (divides by it), and `normalizePer100g` already guards `gramWeight <= 0`.
   - Test: `cd client && npx tsc --noEmit` passes.

2. **Extend BarcodeLookupResult** (`client/src/hooks/useBarcodeLookup.ts`)
   - Action:
     - Define a new exported type `CatalogPortionData`:
       ```typescript
       export type CatalogPortionData = {
         id: string;
         label: string;
         baseAmount: number;
         baseUnit: string;
         gramWeight: number | null;
         calories: number;
         protein: number;
         carbs: number;
         fat: number;
         isDefault: boolean;
       };
       ```
     - Add two optional fields to `BarcodeLookupResult`:
       ```typescript
       catalogProductId?: string;
       catalogPortions?: CatalogPortionData[];
       ```
     - In `catalogToResult()`, populate the new fields by mapping `product.portions` to `CatalogPortionData[]` (converting `snake_case` to `camelCase`: `base_amount` -> `baseAmount`, `base_unit` -> `baseUnit`, `gram_weight` -> `gramWeight`, `is_default` -> `isDefault`). Set `catalogProductId` to `product.id`.
     - Remove the `console.warn` debug logging statements scattered throughout `lookup()` (lines 101-147). These are development leftovers.
   - Why: The confirm screen needs the full list of portions to let the user choose, plus the catalog product ID for logging.
   - Dependencies: Phase 2 Step 1 (fixed `CatalogPortionResponse` type -- uses `label` field now)
   - Risk: Low -- additive change, no existing consumers read these fields.
   - Test: Existing `useBarcodeLookup.test.tsx` still passes (optional fields, existing assertions untouched).

3. **Extend ExternalProductParam** (`client/src/app/navigationTypes.ts`)
   - Action: Import `CatalogPortionData` from `@hooks/useBarcodeLookup`. Add optional fields to `ExternalProductParam`:
     ```typescript
     catalogProductId?: string;
     catalogPortions?: CatalogPortionData[];
     ```
   - Why: Navigation params carry the catalog data from barcode scanner to confirm screen. React Navigation requires all params to be serialisable (no functions/classes), which these are.
   - Dependencies: Phase 2 Step 2 (exports `CatalogPortionData` type)
   - Risk: Low -- optional fields, no existing consumers affected.
   - Test: `cd client && npx tsc --noEmit` passes.

**Phase 2 Verification**: `cd client && npx tsc --noEmit && pnpm test`

### Phase 3: Wire Up FABs & Navigation (3 files)

1. **Pass catalog data in BarcodeScannerScreen navigation** (`client/src/screens/BarcodeFlow/BarcodeScannerScreen.tsx`)
   - Action: In the `useEffect` that navigates to ProductConfirm when `status === "found"` (line 64-80), add the new fields to the `externalProduct` param:
     ```typescript
     catalogProductId: result.catalogProductId,
     catalogPortions: result.catalogPortions,
     ```
   - Why: Connects the extended data from Phase 2 to the confirm screen.
   - Dependencies: Phase 2 Steps 2 and 3
   - Risk: Low -- additive fields on an existing navigation call.
   - Test: `cd client && npx tsc --noEmit` passes.

2. **Wire MyDay FAB "Scan food" button** (`client/src/screens/MyDayScreen.tsx`)
   - Action: Change the "Scan food" FAB action `onPress` from `() => {}` (line 458) to `() => navigation.navigate("BarcodeScanner")`.
   - Why: Users need to launch barcode scanner from MyDay.
   - Dependencies: None (BarcodeScanner route already exists in MyDayStackParamList)
   - Risk: Low -- single-line change.
   - Test: `cd client && npx tsc --noEmit` passes.

3. **Wire MyPath FAB "Scan food" button** (`client/src/screens/MyPath/MyPathScreen.tsx`)
   - Action: Change the "Scan food" FAB action `onPress` from `() => {}` (line 308) to:
     ```typescript
     () => navigation
       .getParent<BottomTabNavigationProp<RootTabParamList>>()
       ?.navigate("MyDayTab", { screen: "BarcodeScanner" })
     ```
     This follows the same cross-tab navigation pattern already used by "Add meal" on lines 297-300.
   - Why: Users need to launch barcode scanner from MyPath. The scanner lives in the MyDay stack, so we cross-navigate.
   - Dependencies: None
   - Risk: Low -- follows existing pattern on the same screen.
   - Test: `cd client && npx tsc --noEmit` passes.

**Phase 3 Verification**: `cd client && npx tsc --noEmit && pnpm test`

### Phase 4: ProductConfirmScreen Rewrite (1 file, major)

This is the core of the feature. The screen currently shows product info + amount selector + "Save Product" button. It needs to become a food tracking screen with two portion modes.

1. **Rewrite ProductConfirmScreen** (`client/src/screens/ProductFlow/ProductConfirmScreen.tsx`)

   **Type changes:**
   - Remove `ProfileProps` type and `Props = ProfileProps | MyDayProps` union. Change to: `type Props = NativeStackScreenProps<MyDayStackParamList, "ProductConfirm">`.
   - Remove `ProfileStackParamList` import.

   **Branching logic (top of component):**
   - Read `externalProduct.catalogPortions` from route params.
   - If `catalogPortions` is defined and non-empty, render the new "Track Food" UI (catalog path).
   - If `catalogPortions` is undefined/empty (OFF source), render the existing "Save Product" UI unchanged. This preserves backward compatibility for Open Food Facts products.

   **Catalog path -- new state:**
   - `mealType: MealTypeKey` -- default `"breakfast"`, controlled by `SegmentedButtons`
   - `selectedPortionId: string` -- ID of the selected catalog portion, default to the `isDefault === true` portion's ID (or first portion)
   - `portionMode: "serving" | "weight"` -- derived from selected portion (see below)
   - `quantity: string` -- default `"1"`, for serving mode (how many servings)
   - `weightAmount: string` -- default `"100"`, for weight mode (raw grams/mg/kg)
   - `weightUnit: Scale` -- default to catalog portion's `baseUnit` (typically `"g"`)
   - `isFavourite: boolean` -- default `false`
   - `saving: boolean` -- loading state

   **Portion classification logic:**
   Each catalog portion is classified as either "serving" or "weight" based on heuristics:
   - A portion is **per-100g** (weight mode) if `baseAmount === 100` AND `baseUnit === "g"`.
   - All other portions are **per-serving** (serving mode) -- e.g., "1 serving (30g)", "1 piece (25g)".
   - The `selectedPortionId` determines which mode is active. When the user taps a portion card, `portionMode` updates automatically.

   **UI Sections (top to bottom, catalog path):**

   A. **Header** -- Back button + "Track Food" title.

   B. **Product info card** -- Name and brand. Same as current.

   C. **Meal type selector** -- `SegmentedButtons` with the 4 non-water meal types: breakfast, lunch, dinner, snacks. Use `MEAL_TYPE_KEYS.filter(k => k !== "water")` and `MEAL_TYPE_LABEL`.

   D. **Portion selector** -- Render each catalog portion as a pressable card. Each card shows:
      - Portion label (e.g., "100g", "1 serving (30g)")
      - Calories per portion (e.g., "165 kcal")
      - Visual highlight (primary border) when selected
      If only 1 portion exists, show it as a static selected card.

   E. **Amount input** -- Depends on `portionMode`:
      - **Serving mode**: Label "How many?", numeric `TextInput` for quantity (default "1"). Display: "2 x 30g serving = 60g".
      - **Weight mode**: Label "Amount", numeric `TextInput` for weight amount (default "100"), plus `SCALE_OPTIONS` buttons for unit (mg/g/kg). This reuses the existing scale button UI from the current ProductConfirmScreen.

   F. **Nutritional preview** -- Calculated values card showing calories, protein, carbs, fat for the current selection:
      - Serving mode: `portion.calories * quantity`, etc.
      - Weight mode: `portion.calories * (toGrams(weightAmount, weightUnit) / portion.gramWeight)` when `gramWeight` is available; fall back to `(toGrams(weightAmount, weightUnit) / (portion.baseAmount * gramMultiplier))` otherwise. Extract this logic as a pure function `calculateNutrition(portion, mode, quantity, weightAmount, weightUnit)` for testability.

   G. **Favourite toggle** -- Pressable row with star icon and "Add to favourites" label.

   H. **Footer** -- "Track Food" button (disabled while saving).

   **handleTrackFood logic (catalog path):**
   ```
   1. Validate amount: serving mode -> quantity > 0; weight mode -> weightAmount > 0
   2. Get the selected catalog portion from catalogPortions array by selectedPortionId
   3. Build product name: brands ? `${name} (${brands})` : name
   4. Call addProduct({ name, barcode: code, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, source: "catalog" })
      - useProducts.addProduct handles barcode dedup (returns existing product if barcode matches)
   5. Compute food entry amount and unit:
      - Serving mode: amount = quantity * portion.baseAmount, unit = portion.baseUnit
      - Weight mode: amount = parseFloat(weightAmount), unit = weightUnit
   6. Build MealItem: { productId: product.id, amount, unit }
   7. Call saveMealToBackend(mealType, [mealItem], [product])
      - This handles: ensureProductInBackend -> getOrCreateDefaultPortion -> createFoodEntry
   8. If isFavourite, load current favourites, prepend product.id, save
   9. Call pushProductRecent(product.id)
   10. Log analytics event "food_tracked_via_barcode"
   11. Navigate: navigation.replace("MyDay")
   ```

   **OFF fallback path (non-catalog):**
   If `catalogPortions` is undefined/empty, render the existing screen UI exactly as-is (product info, amount/scale selector, nutritional preview, "Save Product" button). The only change is removing the `ProfileProps` type union.

   - Why: This is the entire feature UX. The two-mode portion system matches the user's mental model: "I ate 2 servings" vs "I ate 150g".
   - Dependencies: Phases 1-3 (types, navigation, FAB wiring)
   - Risk: **High** -- largest single file change. Screen goes from ~480 lines to ~550-600 lines. Mitigation: (1) OFF fallback path preserved nearly verbatim, (2) calculation logic extracted as a pure function for testability, (3) exhaustive manual testing checklist.
   - Test: Manual verification + unit test for `calculateNutrition` pure function.

**Phase 4 Verification**: `cd client && npx tsc --noEmit && pnpm test`, then manual testing.

### Phase 5: Analytics & Tests (2 files)

1. **Add analytics event** (`client/src/services/analytics.ts`)
   - Action: Add `"food_tracked_via_barcode"` to the `AnalyticsEvent` union type (line 4-11).
   - Why: Tracking conversion from scan to food entry.
   - Dependencies: None
   - Risk: Low
   - Test: `cd client && npx tsc --noEmit` passes.

2. **Update useBarcodeLookup tests** (`client/src/hooks/useBarcodeLookup.test.tsx`)
   - Action:
     - In `makeCatalogResponse()`, update the mock `default_portion` to use `label` instead of `name` (line 31). Add a `portions` array with multiple items (one per-100g and one per-serving) to the mock response.
     - Add new assertions to the "lookup calls catalog API first" test: verify `result.current.result?.catalogProductId === "cat-1"` and `result.current.result?.catalogPortions` is an array with correct length and field names.
     - Add a new test: "OFF lookup does not include catalogPortions" -- verify that when the OFF path is used, `catalogPortions` is `undefined`.
     - In "catalog portion calories normalized to per-100g" test, update the mock portion to use `label` instead of `name`.
   - Why: Tests must cover the new data flow.
   - Dependencies: Phase 2
   - Risk: Low
   - Test: `cd client && pnpm test -- useBarcodeLookup`

**Phase 5 Verification**: `cd client && npx tsc --noEmit && pnpm test`

## Testing Strategy

- **Unit tests**:
  - Update `useBarcodeLookup.test.tsx` for new return shape and `label` field fix.
  - Extract `calculateNutrition()` from ProductConfirmScreen as a pure function. Test it with: serving mode (quantity * portion), weight mode (proportional from gram_weight), weight mode with null gram_weight fallback, edge cases (zero amount, zero gram_weight).
- **Integration tests**: The `useFoodEntries.test.tsx` tests already cover `saveMealToBackend` -- verify they still pass unchanged.
- **Manual verification checklist**:
  1. Scan a known barcode (catalog product with per-100g AND per-serving portions)
  2. Verify portion selector shows all portions with labels and calorie values
  3. Tap a per-serving portion -- verify quantity input appears, nutritional preview updates correctly
  4. Set quantity to 2, verify nutrition = 2x serving values
  5. Tap the per-100g portion -- verify weight amount input and unit selector appear
  6. Enter 150g, verify nutrition = 1.5x the 100g values
  7. Switch between mg/g/kg units, verify nutrition recalculates
  8. Select "Lunch" meal type
  9. Toggle favourite ON
  10. Tap "Track Food", verify saving indicator, then navigation to MyDay
  11. On MyDay: verify macro rings and calorie bar for "Lunch" updated
  12. Tap "Lunch" row -- verify scanned product appears in MealTypeEntries with correct amount
  13. Open Add Meal, select Lunch tab -- verify "Already logged today" shows the product
  14. Navigate to Profile > My Products -- verify catalog product does NOT appear
  15. Scan a product from Open Food Facts (not in catalog) -- verify fallback "Save Product" flow works
  16. Tap "Scan food" FAB on MyDay -- verify scanner opens
  17. Tap "Scan food" FAB on MyPath -- verify scanner opens (via cross-tab navigation)
  18. Navigate to Profile > Add Product -- verify "Scan Barcode" button is gone

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| ProductConfirmScreen rewrite is large (~550-600 lines) | High | OFF fallback path preserved nearly verbatim. Calculation logic extracted as pure testable function. Incremental manual testing after each section. |
| `saveMealToBackend` requires product+portion to exist in backend | Medium | The existing `ensureProductInBackend` + `getOrCreateDefaultPortion` logic in `useFoodEntries.ts` handles this. The scanned product is first saved locally via `addProduct()`, then `saveMealToBackend` syncs it to the backend. |
| Catalog portion `gram_weight` can be null (for dimensionless units like "pcs") | Medium | Per-100g mode only shown for portions where `baseAmount === 100 && baseUnit === "g"`. Serving mode doesn't need `gram_weight` -- it multiplies portion nutrition by quantity. Weight mode only applies to the per-100g portion which always has `gram_weight === 100`. |
| Removing Profile stack barcode routes could break deep-links or other references | Medium | After removal, run `npx tsc --noEmit` -- TypeScript will flag ALL references to the removed routes. Grep for `"BarcodeScanner"` and `"ProductConfirm"` across the Profile-related screens. The only references found are: `ProductSearchScreen.tsx` (removed in Phase 1 Step 3) and `AppNavigator.tsx` (removed in Phase 1 Step 2). |
| Cross-tab navigation from MyPath to MyDay BarcodeScanner might not auto-dismiss FAB | Low | The FAB already has `blur` and `tabPress` listeners that call `setFabOpen(false)` (MyPathScreen lines 86-99). Cross-tab navigation triggers `blur`, which closes the FAB. |
| `CatalogPortionResponse.name` -> `label` rename breaks existing mock in test | Low | Fix the mock in `useBarcodeLookup.test.tsx` in Phase 5 Step 2. The mock currently uses `name` which would mismatch the type after the fix -- TypeScript will catch this. |
| Two-mode portion UI could be confusing for products with only 1 portion | Low | If only 1 portion exists, show it as a single pre-selected card. The mode (serving vs weight) is determined automatically. No mode toggle needed. |
