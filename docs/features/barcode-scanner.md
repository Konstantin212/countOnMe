---
type: feature
status: current
last-updated: 2026-03-15
related-features:
  - product-management
  - catalog-seeding
---

# Barcode Scanner

## Overview

The barcode scanner feature allows users to scan a product barcode (EAN-13, EAN-8, UPC-A, UPC-E) to quickly look up and add products without manual search. The scanner uses a two-source lookup strategy: first queries the backend catalog API, then falls back to Open Food Facts (OFF) with a 3-second timeout. After a successful lookup, users are routed to product confirmation where they can review nutrition info and save to their library. The feature is accessible from two entry points: the Add Meal flow (SelectProductScreen) and the Product Management flow (ProductSearchScreen).

## User Flows

### Primary: Scan → Lookup → Confirm → Save

1. **BarcodeScanner entry** — User taps barcode icon on SelectProductScreen or ProductSearchScreen
2. **Permission request** — First launch: app requests camera permission. If denied, user sees permission-denied screen with link to settings
3. **Camera active** — Live camera feed with overlay rectangle (viewfinder), "Point camera at barcode" guidance text
4. **Barcode detected** — Camera fires `onBarcodeScanned` with barcode string; lookup begins
5. **Lookup in progress** — Loading spinner + "Looking up product..." text
6. **Found (2 outcomes)**:
   - **Catalog hit**: Backend returns product with default portion; normalized to per-100g calories + macros
   - **OFF fallback hit**: Catalog returns 404 → OFF API returns product; extracted calories + macros
7. **ProductConfirmScreen** — Auto-navigates to confirmation with product data; user sets amount/scale, reviews calculated nutrition, saves
8. **Saved** → Returns to product list

### Failure Path: Not Found or Error

1. **Not found** — Neither catalog nor OFF finds barcode; shows "Product not found" message
2. **Error** — Catalog or OFF throws (network, timeout); shows error message + "Retry" button
3. **Manual fallback options**:
   - **Search by name** — Tap to return to SelectProduct/ProductSearch, user can search manually
   - **Enter manually** — Tap to open ProductFormScreen, user creates product by hand

### Edge Cases

- **Duplicate scans within 2s** — Ignored via cooldown; prevents accidental rapid re-scans
- **Offline** — Camera works; catalog lookup fails gracefully; OFF likely returns null; manual fallback available
- **Permission denied** — User can grant permission or go to Settings to enable camera later

## Entry Points

### SelectProductScreen (Add Meal Flow)
- **Location**: `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx`
- **Button**: Barcode icon in header row, tap navigates to `BarcodeScanner` in MyDay stack

### ProductSearchScreen (Profile → Products Flow)
- **Location**: `client/src/screens/ProductFlow/ProductSearchScreen.tsx`
- **Button**: "Scan Barcode" text + barcode icon in button row, tap navigates to `BarcodeScanner` in Profile stack

Both stacks have `BarcodeScanner: undefined` in their param lists; each routes back to its own stack on fallback (goBack → original screen).

## Lookup Strategy

### Lookup Sequence

1. **Catalog API first** (backend-scoped)
   - Call `GET /v1/catalog/products/barcode/{barcode}`
   - If found & has default portion: normalize calories/macros to per-100g; return result with `source: "catalog"`
   - If found but no default portion: skip to OFF
   - If 404: fall through to OFF

2. **Open Food Facts fallback** (public API)
   - Call `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`
   - 3-second timeout (AbortController)
   - If status=1 & product exists: extract calories from `nutriments['energy-kcal_100g']` and macros; return with `source: "off"`
   - If status!=1 or timeout: return null (treated as not_found)

### Normalization

Catalog portions store nutrition data per base amount. Convert to per-100g:
```
caloriesPer100g = (portion.calories / portion.gram_weight) * 100
```

If `gram_weight` is zero or negative, the function returns `0` rather than producing invalid values.

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

## Analytics Events

Seven funnel events fired to track product discovery path:

| Event | When | Params |
|-------|------|--------|
| `scanner_opened` | Screen mount | — |
| `permission_denied` | Camera permission denied | — |
| `barcode_scanned` | Barcode detected | `{ barcode: string }` |
| `lookup_succeeded` | Product found (catalog or OFF) | `{ source: "catalog" \| "off" }` |
| `lookup_not_found` | Neither source found product | — |
| `lookup_failed` | Network/timeout error during lookup | — |
| `user_continued_via_manual_fallback` | User taps "Search by name" or "Enter manually" | — |

Events logged via `logEvent()` in `client/src/services/analytics.ts` (lightweight stub; console.logs in dev, no-op in production).

## Key Files

### Client

- `client/src/screens/BarcodeFlow/BarcodeScannerScreen.tsx` — Main scanner UI; camera view, permission handling, lookup orchestration, route to ProductConfirm on success
- `client/src/screens/BarcodeFlow/components/ScannerOverlay.tsx` — Transparent overlay with rectangular viewfinder cutout
- `client/src/screens/BarcodeFlow/components/LookupStatus.tsx` — Status display: loading spinner, error message with retry, or "not found" text
- `client/src/screens/BarcodeFlow/components/ManualFallback.tsx` — Two buttons: "Search by name" (goBack), "Enter manually" (navigate to ProductForm)
- `client/src/hooks/useBarcodeLookup.ts` — Core lookup hook; orchestrates catalog → OFF fallback; returns result, status, error; handles 2s cooldown
- `client/src/hooks/useBarcodeLookup.test.tsx` — Unit tests for lookup logic (catalog hit, OFF fallback, both miss, error, cooldown, reset)
- `client/src/services/api/catalog.ts` — API wrapper for `GET /v1/catalog/products/barcode/{barcode}`
- `client/src/services/openFoodFacts.ts` — OFF API with timeout: `getProductByBarcode()`, `extractCalories()`, `extractMacros()`
- `client/src/services/analytics.ts` — Analytics stub; `logEvent(name, params?)`
- `client/src/app/navigationTypes.ts` — Param lists: `BarcodeScanner: undefined` in both MyDay and Profile stacks; `ProductConfirm` in MyDay stack
- `client/src/app/AppNavigator.tsx` — Screen registration for both stacks
- `client/src/screens/ProductFlow/ProductConfirmScreen.tsx` — Confirmation screen; receives `externalProduct` param from scanner

### Backend

- `backend/app/features/catalog/router.py` — Route `GET /v1/catalog/products/barcode/{barcode}` (declared before `/{catalog_product_id}` to avoid UUID parsing conflict)
- `backend/app/features/catalog/service.py` — Function `get_catalog_product_by_barcode()` queries by barcode with eager-loaded portions
- `backend/app/features/catalog/models.py` — ORM model `CatalogProduct` with `barcode` column and index
- `backend/app/features/catalog/schemas.py` — Response schema `CatalogProductResponse` with portions
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
