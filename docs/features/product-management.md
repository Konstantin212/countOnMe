# Product Management

## Overview

Product management is the foundation of CountOnMe. Users build a personal database of food products with nutritional data (calories, protein, carbs, fat). Products are stored locally first (AsyncStorage) and synchronized to the backend via a deferred sync queue.

## User Flows

### Creating a Product Manually

1. **ProductsListScreen** -- The entry point. Displays all local products in a searchable list. Tap the "+" button to create a new product.
2. **ProductFormScreen** -- A form for entering product details: name, optional category, scale type, portion size, unit, and macros (calories, protein, carbs, fat per base portion). On submit, the product is saved to AsyncStorage and a `products.create` operation is enqueued for backend sync.

### Importing from Open Food Facts

1. **ProductSearchScreen** -- Users search the Open Food Facts database by product name. Results show product name, brand, and a thumbnail. The search calls `https://world.openfoodfacts.org/cgi/search.pl` with paged results (20 per page).
2. **ProductConfirmScreen** -- After selecting a result, users review the imported data before saving. Calories and macros are extracted from the `nutriments` field (per 100g values). Users can adjust values before confirming. The product is then saved locally through the same path as manual creation.

Barcode lookup is also supported via `getProductByBarcode()`, which calls `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`.

### Editing and Deleting

From the **ProductsListScreen**, users can navigate to **ProductDetailsScreen** to view a product's full details, then to **ProductFormScreen** to edit. Deleting a product removes it from the local list and enqueues a `products.delete` operation for backend sync.

## Data Model

### Client-Side Product Type

The `Product` type in `client/src/models/types.ts` carries two sets of nutritional fields:

**V2 fields (current):**
- `portionSize` -- The base amount (e.g., 100)
- `scaleType` -- One of `Solid`, `Liquid`, or `Dry`
- `scaleUnit` -- The unit for the base portion (e.g., `g`, `ml`, `cup`)
- `allowedUnits` -- Derived from `scaleType`/`scaleUnit`; the other units in the same scale group
- `caloriesPerBase`, `proteinPerBase`, `carbsPerBase`, `fatPerBase` -- Macros per `portionSize` of `scaleUnit`

**Legacy fields (V1, kept for backward compatibility):**
- `caloriesPer100g`, `proteinPer100g`, `carbsPer100g`, `fatPer100g` -- Always per 100g

When loading products, the storage layer auto-migrates V1 data to V2 by populating the new fields from the legacy ones (defaulting to `Solid`/`g`/`100`).

Additional fields: `id` (UUID), `name`, `category`, `createdAt`, `updatedAt`.

### Backend Product Model

The backend `products` table is intentionally simple:
- `id` (UUID, PK)
- `device_id` (UUID, FK to `devices`, indexed)
- `name` (text)
- `created_at`, `updated_at`, `deleted_at` (from `TimestampMixin`)

The rich nutritional data lives in the **product_portions** table (see Portions below).

## Scale System

Products use one of three scale types, each with its own unit set:

| Scale Type | Units         | Canonical Base |
|------------|---------------|----------------|
| Solid      | mg, g, kg     | grams (g)      |
| Liquid     | ml, l         | milliliters (ml)|
| Dry        | tsp, tbsp, cup| milliliters (ml)|

Unit conversion happens on both client and backend. The conversion tables are:

**Mass:** mg = 0.001g, g = 1g, kg = 1000g
**Volume:** ml = 1ml, l = 1000ml, tsp = 5ml, tbsp = 15ml, cup = 240ml

Cross-group conversions (e.g., grams to milliliters) are not supported and return `null`.

## Portions (Backend Sub-Resource)

Each product can have multiple **portions** in the backend. Portions carry the actual nutritional data used for calorie calculation.

### Portion Fields
- `id`, `device_id`, `product_id` -- Identity and scoping
- `label` -- Human-readable name (e.g., "100g", "1 cup")
- `base_amount` -- Numeric amount (e.g., 100)
- `base_unit` -- Unit enum (e.g., `g`)
- `calories`, `protein`, `carbs`, `fat` -- Macros for `base_amount` of `base_unit`
- `is_default` -- Boolean; exactly one portion per product should be the default

### Portion Endpoints
- `GET /v1/products/{product_id}/portions` -- List portions for a product
- `POST /v1/products/{product_id}/portions` -- Create a portion
- `GET /v1/portions/{portion_id}` -- Get a specific portion
- `PATCH /v1/portions/{portion_id}` -- Update a portion
- `DELETE /v1/portions/{portion_id}` -- Soft-delete a portion

When the food tracking flow needs a portion (e.g., to create a food entry), the client auto-creates a default portion from the product's local nutritional data if none exists.

## Hook: useProducts

The `useProducts` hook in `client/src/hooks/useProducts.ts` is the primary interface for product CRUD:

**State:** `products` (array), `loading` (boolean)

**Actions:**
- `refresh()` -- Reloads all products from AsyncStorage
- `addProduct(input)` -- Creates a new product with a UUID, saves to AsyncStorage, enqueues `products.create` to sync queue
- `updateProduct(id, patch)` -- Patches a product immutably, saves to AsyncStorage, enqueues `products.update`
- `deleteProduct(id)` -- Removes from local array, saves to AsyncStorage, enqueues `products.delete`

Input sanitization is applied: negative numbers become 0, names are trimmed (or default to "Untitled product"), and optional numeric fields are validated.

## Backend Endpoints

All product endpoints require device authentication (Bearer token).

- `GET /v1/products` -- List all products for the authenticated device
- `POST /v1/products` -- Create a product (accepts optional client-generated `id`)
- `GET /v1/products/{product_id}` -- Get a single product (404 if wrong device)
- `PATCH /v1/products/{product_id}` -- Update product name
- `DELETE /v1/products/{product_id}` -- Soft-delete (sets `deleted_at`)

All queries are scoped to `device_id`. Attempting to access another device's product returns 404.

## Favourites and Recents

Two local-only lists are stored in AsyncStorage:

- **Favourites** (`productFavourites`) -- An array of product IDs that the user has starred. Persisted under `@countOnMe/products-favourites/v1`.
- **Recents** (`productRecents`) -- An array of product IDs ordered by recent usage. Persisted under `@countOnMe/products-recents/v1`.

Both are simple ID arrays loaded and saved via `loadProductFavourites()`/`saveProductFavourites()` and `loadProductRecents()`/`saveProductRecents()` in the storage layer.

## Open Food Facts Integration

The `client/src/services/openFoodFacts.ts` module provides:

- `searchProducts(query, page)` -- Searches by name, returns paginated results with `code`, `product_name`, `brands`, `quantity`, `image_url`, and `nutriments`
- `getProductByBarcode(barcode)` -- Fetches a single product by barcode
- `extractCalories(product)` -- Reads `energy-kcal_100g` from nutriments
- `extractMacros(product)` -- Reads `proteins_100g`, `carbohydrates_100g`, `fat_100g` from nutriments

All values from Open Food Facts are per 100g, which maps directly to the legacy product fields and is auto-migrated to V2 on save.
