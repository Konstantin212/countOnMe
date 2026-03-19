---
type: feature
status: current
last-updated: 2026-03-19
related-features:
  - product-management
  - food-tracking
  - catalog-seeding
---

# Barcode Scanner & Track to Meal

## Overview

The barcode scanner feature allows users to scan a product barcode (EAN-13, EAN-8, UPC-A, UPC-E) to track food directly into a meal without saving to the product library first. The scanner uses a two-source lookup strategy: first queries the backend catalog API, then falls back to Open Food Facts (OFF) with a 3-second timeout. After a successful lookup, users are routed to ProductConfirmScreen where they select meal type, portion mode (per-serving or per-100g), and quantity before creating a food entry. ALL scanned products—including those from OFF—follow the unified Track Food flow; a synthetic per-100g portion is automatically created for OFF products if no catalog data exists. The feature is accessible from two entry points: the "Scan food" FAB on MyDay and MyPath screens.

## User Flows

### Primary: Scan → Lookup → Select Meal & Portion → Track

1. **Scan food FAB** — User taps "Scan food" FAB on MyDay or MyPath screen
2. **Permission request** — First launch: app requests camera permission. If denied, user sees permission-denied screen with link to settings
3. **Camera active** — Live camera feed with overlay rectangle (viewfinder), "Point camera at barcode" guidance text
4. **Barcode detected** — Camera fires `onBarcodeScanned` with barcode string; lookup begins
5. **Lookup in progress** — Loading spinner + "Looking up product..." text
6. **Found (2 outcomes)**:
   - **Catalog hit**: Backend returns product with portions list and default portion; all portions normalized to per-100g calories + macros
   - **OFF fallback hit**: Catalog returns 404 → OFF API returns product; extracted calories + macros converted to per-100g
7. **ProductConfirmScreen (Catalog)** — User sees:
   - Meal type selector (breakfast/lunch/dinner/snacks)
   - Portion picker showing all catalog portions
   - Two-mode input: **Serving mode** (quantity multiplier for selected portion) or **Weight mode** (grams/mg/kg input)
   - Real-time nutrition preview (calories + macros) calculated from selection
   - Favourite toggle (off by default)
   - "Track Food" button
8. **Create food entry** — Presses "Track Food"; app creates product (if new) and food entry for selected meal + date
9. **Return to MyDay** — Food entry saved; updated totals visible immediately

### Open Food Facts Products Use Unified Track Food Flow

For products found in Open Food Facts (not in catalog):

1. **Synthesized Portion** — A synthetic per-100g portion is created from OFF data (id: "off-100g", label: "100g", baseAmount: 100, baseUnit: "g", gramWeight: 100)
2. **ProductConfirmScreen (Unified)** — User sees the same Track Food flow as catalog products:
   - Meal type selector
   - Weight mode input (100g portion with unit selector)
   - Nutrition preview from OFF values
   - "Track Food" button (creates food entry directly)
3. **Create entry and return** — Same as catalog products; user returned to MyDay with entry saved

### Failure Path: Not Found or Error

1. **Not found** — Neither catalog nor OFF finds barcode; shows "Product not found" message
2. **Error** — Catalog or OFF throws (network, timeout); shows error message + "Retry" button
3. **Manual fallback options**:
   - "Return to meal builder" — Dismisses scanner, returns to previous screen
   - Implicit: User can search for product manually

### Edge Cases

- **Duplicate scans within 2s** — Ignored via cooldown; prevents accidental rapid re-scans
- **Offline** — Camera works; catalog lookup fails gracefully; OFF likely times out; manual search/entry always available
- **Permission denied** — User can grant permission or go to Settings to enable camera later
- **Catalog product with no default portion** — Skips to OFF fallback; if OFF also fails, product not found

## Entry Points

### MyDay Screen "Scan food" FAB
- **Location**: `client/src/screens/MyDayScreen.tsx`
- **Button**: Floating Action Button (FAB) with barcode icon
- **Route**: Navigates to `BarcodeScanner` in MyDay stack
- **Return**: On success, navigates to `ProductConfirm` in MyDay stack; on failure/cancel, returns to MyDay

### MyPath Screen "Scan food" FAB
- **Location**: `client/src/screens/MyPath/MyPathScreen.tsx`
- **Button**: Floating Action Button (FAB) with barcode icon
- **Route**: Navigates to `BarcodeScanner` in MyDay stack (cross-tab navigation)
- **Return**: On success, navigates to `ProductConfirm` in MyDay stack; user can return to MyPath via bottom tab

## Lookup Strategy

### Lookup Sequence

1. **Catalog API first** (backend-scoped)
   - Call `GET /v1/catalog/products/barcode/{barcode}`
   - If found & has default portion: load all portions and normalize calories/macros to per-100g; return result with `source: "catalog"` and `catalogPortions` array
   - If found but no default portion: skip to OFF
   - If 404: fall through to OFF

2. **Open Food Facts fallback** (public API)
   - Call `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`
   - 3-second timeout (AbortController)
   - If status=1 & product exists: extract calories from `nutriments['energy-kcal_100g']` and macros; return with `source: "off"` (no portions)
   - If status!=1 or timeout: return null (treated as not_found)

### Normalization to Per-100g

Catalog portions store nutrition data per base amount. Convert to per-100g using gram_weight:
```
caloriesPer100g = (portion.calories / portion.gram_weight) * 100
```

If `gram_weight` is null or ≤ 0, the function returns `0` rather than producing invalid values.

## Portion Modes

ProductConfirmScreen supports two user input modes for catalog and synthesized OFF portions:

### Serving Mode (Quantity Multiplier)
- **Trigger**: Portion with `baseAmount ≠ 100` or `baseUnit ≠ 'g'`
- **Input**: Quantity field (e.g., "2 servings")
- **Calculation**: `nutrition = portion * quantity`
- **Example**: "1 cup" → user enters "2.5" → calculates 2.5 cups

### Weight Mode (Per-100g with Unit Selector)
- **Trigger**: Portion with `baseAmount === 100` AND `baseUnit === 'g'`
- **Input**: Weight amount + unit selector (g, mg, kg)
- **Calculation**: `nutrition = portion * (convertedGrams / referenceGrams)`
  - Uses `portion.gramWeight` if available and > 0; otherwise falls back to `baseAmount`
- **Example**: 100g portion → user enters "250" + "g" → calculates (250/100) * portion values
- **OFF products always use weight mode** because synthetic portion has baseAmount=100, baseUnit="g", gramWeight=100

**Storage**: Food entries from serving mode always convert to grams: `amount = qty * gramWeight` and `unit = "g"`. This ensures backend stats calculation has consistent units.

Mode is determined by `classifyPortionMode()` utility in `nutrition.ts`; nullable macros (protein/carbs/fat) default to 0 in calculations.

## Barcode Deduplication

When a user scans and saves a product with a barcode, if another product with the same barcode already exists on the device, `addProduct()` updates the existing product with the latest scanned data (name, calories, macros) and returns it. This happens at two levels:

- **Client-side**: `useProducts` hook checks `products` array for matching barcode; if found, overwrites name + nutrition fields on the existing record
- **Backend-side**: `create_product()` service calls `get_product_by_barcode()` and returns existing record if found

Result: same barcode scanned twice = existing product updated with latest data (no duplication in library).

## Offline Behavior

- **Camera**: Works offline (local device hardware)
- **Lookup**: Catalog lookup fails silently; OFF likely times out; user sees "Lookup failed" error message
- **Fallback**: Manual entry buttons always available; users can create product by hand via ProductFormScreen
- **No blocking**: Users never stranded; can always fall back to manual entry

## Type Safety

All nutrition calculations and portion mode detection use TypeScript interfaces defined in hooks and utilities:

- `CatalogPortionData` — Portion object (id, label, baseAmount, baseUnit, gramWeight, calories, protein, carbs, fat, isDefault); macros are `number | null`
- `BarcodeLookupResult` — Result from lookup hook (code, name, brands, calories/macros per-100g, source, catalogProductId, catalogPortions)
- `ExternalProductParam` — Navigation param for ProductConfirm screen; mirrors BarcodeLookupResult structure
- `PortionMode` — Discriminated union: "serving" | "weight"
- `NutritionResult` — Calculation output (calories, protein, carbs, fat, totalGrams)

See `client/src/hooks/useBarcodeLookup.ts` and `client/src/services/utils/nutrition.ts` for definitions. API responses in `catalog.ts` use `parseNumeric()` transform layer to coerce Decimal strings to numbers.

## Analytics Events

Seven funnel events track the scan-to-track path: `scanner_opened`, `permission_denied`, `barcode_scanned`, `lookup_succeeded`, `lookup_not_found`, `lookup_failed`, `user_continued_via_manual_fallback`. Events logged via `logEvent()` in `client/src/services/analytics.ts`.

## Key Files

### Client

- `client/src/screens/BarcodeFlow/BarcodeScannerScreen.tsx` — Main scanner UI; camera view, permission handling, lookup orchestration, route to ProductConfirm on success
- `client/src/screens/ProductFlow/ProductConfirmScreen.tsx` — Confirmation screen with unified CatalogTrackScreen flow (meal type + portion mode + "Track Food"); synthesizes OFF portions as needed
- `client/src/screens/ProductFlow/components/confirmStyles.ts` — Shared styles for ProductConfirm flows
- `client/src/screens/BarcodeFlow/components/ScannerOverlay.tsx` — Transparent overlay with rectangular viewfinder cutout
- `client/src/screens/BarcodeFlow/components/LookupStatus.tsx` — Status display: loading spinner, error message with retry, or "not found" text
- `client/src/screens/BarcodeFlow/components/ManualFallback.tsx` — Fallback buttons for not-found/error states
- `client/src/hooks/useBarcodeLookup.ts` — Core lookup hook; orchestrates catalog → OFF fallback; returns result with catalogPortions if available; handles 2s cooldown
- `client/src/hooks/useBarcodeLookup.test.tsx` — Unit tests for lookup logic (catalog hit, OFF fallback, both miss, error, cooldown, reset)
- `client/src/hooks/useFoodEntries.ts` — Used by CatalogTrackScreen to create food entry via `saveMealToBackend()`
- `client/src/hooks/useProducts.ts` — Used by both flows to create product via `addProduct()`
- `client/src/services/utils/nutrition.ts` — Pure utilities: `calculateNutrition()` for nutrition values, `classifyPortionMode()` for mode detection
- `client/src/services/api/catalog.ts` — API wrapper for `GET /v1/catalog/products/barcode/{barcode}`; returns portions with per-100g normalized macros
- `client/src/services/openFoodFacts.ts` — OFF API with timeout: `getProductByBarcode()`, `extractCalories()`, `extractMacros()`
- `client/src/services/analytics.ts` — Analytics stub; `logEvent(name, params?)`
- `client/src/app/navigationTypes.ts` — Param lists: `BarcodeScanner: undefined`, `ProductConfirm: { externalProduct: ExternalProductParam }` in MyDay stack
- `client/src/app/AppNavigator.tsx` — Screen registration for BarcodeScanner and ProductConfirm
- `client/src/screens/MyDayScreen.tsx` — FAB wiring for "Scan food"
- `client/src/screens/MyPath/MyPathScreen.tsx` — FAB wiring for "Scan food"

### Backend

- `backend/app/features/catalog/router.py` — Route `GET /v1/catalog/products/barcode/{barcode}` (declared before `/{catalog_product_id}` to avoid UUID parsing conflict); returns CatalogBarcodeResponse with default_portion + all portions
- `backend/app/features/catalog/service.py` — Function `get_catalog_product_by_barcode()` queries catalog by barcode with eager-loaded portions
- `backend/app/features/catalog/models.py` — ORM model `CatalogProduct` with `barcode` column and index; `CatalogPortion` with gram_weight (nullable) and is_default
- `backend/app/features/catalog/schemas.py` — Response schema `CatalogBarcodeResponse` with default_portion and portions list
- `backend/app/features/meals/router.py` — Route `POST /v1/food-entries` receives food entry creation (uses existing endpoint, no barcode-specific changes)
- `backend/app/features/products/service.py` — Function `get_product_by_barcode()` and barcode dedup logic in `create_product()`
- `backend/app/features/products/models.py` — ORM model `Product` with `barcode` column (device-scoped)

## API Endpoints

See [`docs/api/catalog.md`](../api/catalog.md) for full endpoint documentation.

**Key endpoint:**
- `GET /v1/catalog/products/barcode/{barcode}` — Look up catalog product by barcode; returns `CatalogProductResponse` with portions, or 404 if not found. Requires device auth.

## Related Features

- [`product-management.md`](product-management.md) — Product CRUD and favorites/recents
- [`catalog-seeding.md`](catalog-seeding.md) — Global catalog data source
- [`device-auth.md`](device-auth.md) — Authentication for all backend lookups
