---
type: feature
status: current
last-updated: 2026-03-15
related-features:
  - catalog-seeding
  - food-tracking
---

# Product Management

## Overview

Product management is the foundation of CountOnMe. Users build a personal database of food products with nutritional data (calories, protein, carbs, fat). Products come from two sources: **user-created products** (device-scoped) and **catalog products** (global, read-only). Products are stored locally first (AsyncStorage) and synchronized to the backend via a deferred sync queue.

## User Flows

### Creating a Custom Product

1. **ProductsListScreen** — Entry point. Displays user-created products only (source="user"). Tap "+" to create.
2. **ProductFormScreen** — Form for product details: name, category, scale type, portion size, unit, macros. On submit, product saved to AsyncStorage, enqueued for backend sync.
   - **Name uniqueness check**: debounced 400ms, calls `GET /v1/products/check-name?name=X` to validate the name is not already used by the device. Offline check is skipped silently. Inline error shown if name is taken.
   - **Auto-favorite on create**: after successful save, product ID is prepended to favorites list in AsyncStorage.

### Selecting a Product for a Meal

1. **SelectProductScreen** (Add Meal flow) — Search and select products. Two tabs: "All" (up to 5 favorites + 10 recents, capped at 15 total) and "Favourited" (starred products only). Tabs visible only when no search active.
2. **Search integration**:
   - Debounced 400ms → calls `GET /v1/products/search?q=X&limit=35`
   - Results are interleaved by relevance (starts-with matches first, then contains matches), sorted alphabetically within each tier
   - User products show "Favourite" or "Recent" badges when applicable; catalog products show "Catalog" badge
   - User products have `source="user"`, catalog results have `source="catalog"`
3. **Catalog item selection**:
   - Tapping a catalog result materializes it as a local user product
   - Product created with `source="catalog"`, macros copied from default portion
   - Auto-favorited after materialization
   - Navigates to AddFood with the new product ID
4. **User product selection**:
   - Tapping a user result navigates to AddFood
   - No automatic favorite (only manual products via ProductForm are auto-favorited)

### Adding to Meal (Recently-Used)

1. **AddFoodScreen** — User adds product to draft meal
   - On "Add" press, product ID is pushed to recents list via `pushProductRecent(productId)`
   - Prepends ID, deduplicates, caps at 50 items
   - Recents persist in AsyncStorage and feed the SelectProduct default list

### Viewing Today's Entries

1. **AddMeal screen** — When opened, fetches today's saved food entries for the device
2. **"Already logged today" section** — Displays saved entries per meal type above the draft items
   - Read-only display (no remove button)
   - Grouped by current draft meal type
   - Only visible when at least one entry exists for that meal type

### Resetting All Data

1. **ProfileScreen** — "Reset all data" button (styled in error color)
2. Confirmation Alert prevents accidental deletion
3. On confirm:
   - Calls `DELETE /v1/data/reset` to soft-delete all food entries for device
   - Clears `useFoodEntries` in-memory caches
   - Clears AsyncStorage (note: also clears theme preference and goal settings)

## Data Model

### Product Type

The `Product` type in `client/src/models/types.ts` carries nutritional and source information:

**Core fields:**
- `id` (UUID), `name`, `category`
- `source?: "user" | "catalog"` — optional; undefined treated as "user" for backward compatibility

**Nutrition fields (V2, current):**
- `portionSize`, `scaleType` (Solid/Liquid/Dry), `scaleUnit` (g/ml/cup/etc)
- `caloriesPerBase`, `proteinPerBase`, `carbsPerBase`, `fatPerBase` — macros per `portionSize` of `scaleUnit`
- `allowedUnits` — derived from scaleType/scaleUnit; other compatible units

**Nutrition fields (V1, legacy, kept for back-compat):**
- `caloriesPer100g`, `proteinPer100g`, `carbsPer100g`, `fatPer100g` — always per 100g
- On load, V1 data auto-migrates to V2 (defaulting to Solid/g/100)

**Timestamps:**
- `createdAt`, `updatedAt` (ISO 8601)

### Backend Product Model

The backend `products` table (device-scoped):
- `id` (UUID, PK), `device_id` (UUID, FK, indexed), `name` (text)
- `source?: "user" | "catalog"` — optional, undefined treated as "user"
- `created_at`, `updated_at`, `deleted_at` (soft delete)

**Catalog tables** (`catalog_products`, `catalog_portions`):
- No `device_id` — shared globally
- `catalog_products`: id, source_id (provider-specific stable ID), source (discriminator), name, category, created_at, updated_at
- `catalog_portions`: id, catalog_product_id, label, base_amount, base_unit, calories, protein, carbs, fat, is_default, gram_weight, created_at, updated_at

Macros in catalog portions are per `base_amount` of `base_unit`. Search results compute per 100g via the formula: `round(value / base_amount * 100, 2)`.

## Scale System

Products use one of three scale types with corresponding units:

| Scale Type | Units         | Canonical Base |
|------------|---------------|----------------|
| Solid      | mg, g, kg     | grams (g)      |
| Liquid     | ml, l         | milliliters (ml)|
| Dry        | tsp, tbsp, cup| milliliters (ml)|

Unit conversion is supported within scale groups. Cross-group conversions (e.g., g to ml) return `null`.

## Favorites and Recents (Local Only)

Two local-only lists in AsyncStorage:

- **Favorites** (`productFavourites`) — Array of product IDs, ordered by most-recent-favorite-first. Persisted under `@countOnMe/products-favourites/v1`.
  - Manual toggle via star icon in SelectProduct
  - Auto-added when creating a product via ProductFormScreen
  - Auto-added when selecting a catalog result
- **Recents** (`productRecents`) — Array of product IDs, ordered newest-first. Persisted under `@countOnMe/products-recents/v1`.
  - Auto-updated when product added to meal (via `pushProductRecent` in AddFoodScreen)
  - Capped at 50 items
  - Filtered out of favorites when rendering SelectProduct default list

Both are simple ID arrays. No backend sync for these; lost on device reinstall.

## Hook: useProducts

The `useProducts` hook in `client/src/hooks/useProducts.ts` is the primary interface:

**State:**
- `products` — array of local products
- `loading` — boolean

**Actions:**
- `refresh()` — reloads from AsyncStorage
- `addProduct(input)` — creates product, saves to AsyncStorage, enqueues `products.create` mutation. Returns the new product.
- `updateProduct(id, patch)` — patches product immutably, saves, enqueues `products.update`
- `deleteProduct(id)` — removes from array, saves, enqueues `products.delete`

Input sanitization: negative numbers become 0, names are trimmed (or default to "Untitled product"), optional numeric fields validated.

## API Endpoints

All endpoints require device authentication (Bearer token). See `docs/api/endpoints.md` for full schemas.

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/v1/products` | List user products (device-scoped, non-deleted) |
| `POST` | `/v1/products` | Create product (client-generated UUID accepted) → 201 |
| `GET`  | `/v1/products/{id}` | Get product → 404 if not found or cross-device |
| `PATCH` | `/v1/products/{id}` | Update product name → 200 |
| `DELETE` | `/v1/products/{id}` | Soft-delete → 204 |
| `GET`  | `/v1/products/check-name?name=X` | Check name availability → `{ "available": true/false }` |
| `GET`  | `/v1/products/search?q=X&limit=35` | Unified search (user + catalog); scores by starts-with then contains; returns `source`, per-100g macros, `catalog_id` |
| `DELETE` | `/v1/data/reset` | Soft-delete all food entries for device → 204 |

## Key Files

### Client

- `client/src/screens/ProductFlow/ProductFormScreen.tsx` — Product creation/edit form with name uniqueness check, auto-favorite
- `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx` — Product selection with default list (5 favs + 10 recents), search, catalog results
- `client/src/screens/AddMealFlow/components/AddFood/index.tsx` — Adds product to meal draft, updates recents
- `client/src/screens/AddMealFlow/components/AddMeal/index.tsx` — Displays today's saved entries per meal type
- `client/src/screens/ProductFlow/ProductsListScreen.tsx` — Lists user products (filters out catalog source)
- `client/src/screens/ProfileScreen.tsx` — "Reset all data" button with confirmation
- `client/src/hooks/useProducts.ts` — Product CRUD and state management
- `client/src/services/api/products.ts` — API calls: checkProductName, searchProducts
- `client/src/services/api/data.ts` — API call: resetDeviceData
- `client/src/storage/storage.ts` — Persistence: loadProductFavourites, saveProductFavourites, loadProductRecents, saveProductRecents, pushProductRecent
- `client/src/models/types.ts` — Product, ProductSearchResult, ProductSource types

### Backend

- `backend/app/features/products/router.py` — Endpoints: check-name, search, CRUD
- `backend/app/features/data/router.py` — Endpoint: DELETE /v1/data/reset
- `backend/app/features/products/service.py` — Service: check_product_name_available, search_products, create_product, get_product, update_product, soft_delete_product
- `backend/app/features/data/service.py` — Service: delete_all_food_entries
- `backend/app/features/products/schemas.py` — Pydantic models: ProductNameCheckResponse, ProductSearchResultItem
- `backend/app/features/products/models.py` — SQLAlchemy Product ORM model

## Related Features

- [`catalog-seeding.md`](catalog-seeding.md) — Global product catalog from USDA data
- [`food-tracking.md`](food-tracking.md) — Food entries and meal logging
- [`device-auth.md`](device-auth.md) — Device authentication for all endpoints
