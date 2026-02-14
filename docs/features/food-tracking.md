# Food Tracking

## Overview

Food tracking is the core daily activity in CountOnMe. Users log what they eat by selecting products, specifying amounts, and assigning entries to meal types. Unlike product management (which works offline-first), food tracking is backend-first -- entries are created directly via API calls, and the backend is the source of truth for all food entry data and daily statistics.

## Meal Types

Food entries are categorized into five meal types:

| Key        | Description            |
|------------|------------------------|
| breakfast  | Morning meal           |
| lunch      | Midday meal            |
| dinner     | Evening meal           |
| snacks     | Between-meal snacking  |
| water      | Water intake (mapped to `snacks` on backend) |

These are defined in `client/src/services/constants/mealTypes.ts` and mirrored in the backend `MealType` enum.

## User Flows

### Daily Overview (MyDayScreen)

The **MyDayScreen** is the home screen. It displays:
- Today's total macros (calories, protein, carbs, fat) at the top
- A card for each meal type showing that meal's macro totals
- Progress toward daily goals (if a goal is set)

Data is fetched via the `useDayStats` hook, which calls `GET /v1/stats/day/{YYYY-MM-DD}`.

From this screen, users can:
- Tap a meal type card to view its entries (**MealTypeEntriesScreen**)
- Tap "Add Food" to start the AddMeal flow

### Adding Food (AddMeal Flow)

The AddMeal flow uses a multi-screen wizard wrapped in a `DraftMealProvider` React context.

**Screen sequence:**
1. **AddMealScreen** -- Shows the current draft with items grouped by meal type. Users can switch between meal types (breakfast, lunch, dinner, snacks). Tap "Add Product" to pick a product. Tap "Save" to submit all items.
2. **SelectProductScreen** -- Browse/search the local product list. Tap a product to proceed.
3. **AddFoodScreen** -- Enter the amount and unit for the selected product. Confirm to add the item to the draft.

**DraftMealProvider** (in `client/src/screens/AddMealFlow/context.tsx`) holds the draft state:
- `mealType` -- Currently selected meal type (defaults to `breakfast`)
- `itemsByMealType` -- A record mapping each `MealTypeKey` to an array of `DraftMealItem` objects (each with `productId`, `amount`, `unit`)

Context actions:
- `setMealType(type)` -- Switch the active meal type
- `upsertItem(item)` -- Add or update an item for the current meal type (deduplicates by `productId`)
- `removeItem(productId)` -- Remove an item from the current meal type
- `reset()` -- Clear all draft items and reset to default meal type

### Saving a Meal

When the user taps "Save" in AddMealScreen, the `useFoodEntries` hook's `saveMealToBackend()` method is called. For each item in the draft:

1. **Ensure product exists in backend** -- Checks a local cache first. If the product is not cached as synced, it calls `GET /v1/products/{id}` to verify. If not found, it calls `POST /v1/products` to create it.
2. **Get or create a default portion** -- Checks a portion cache first. If not cached, calls `GET /v1/products/{id}/portions` to find a default or "100g" portion. If none exist, calls `POST /v1/products/{id}/portions` to create one using the product's local nutritional data.
3. **Create the food entry** -- Calls `POST /v1/food-entries` with `product_id`, `portion_id`, `day` (YYYY-MM-DD), `meal_type`, `amount`, and `unit`.

The saving process is guarded by a `savingRef` to prevent concurrent saves.

### Viewing and Editing Entries (MealTypeEntriesScreen)

The **MealTypeEntriesScreen** displays all food entries for a specific meal type on today's date. It uses the `useMealTypeEntries` hook, which:

1. Fetches entries from `GET /v1/food-entries?day={today}`
2. Filters by the target `meal_type`
3. Enriches each entry by resolving the product name and calculating macros

**Entry enrichment** produces an `EnrichedFoodEntry` with:
- Product name (looked up from local product list)
- Calculated calories, protein, carbs, fat (based on portion data and unit conversion)
- Allowed units for editing (compatible units in the same group)

**Inline editing:** Users can change an entry's amount or unit. The update is persisted to the database first (`PATCH /v1/food-entries/{id}`), then the local state is updated with recalculated macros.

**Deletion:** Users can delete an entry. The deletion is persisted first (`DELETE /v1/food-entries/{id}`, which is a soft delete), then removed from local state.

## Data Flow: How Macros Are Calculated

Macro calculation follows the same pattern on both client and backend:

1. Look up the portion's `base_amount` and `base_unit` (e.g., 100g)
2. Convert the entry's `amount`/`unit` to the portion's `base_unit` using unit conversion tables
3. Compute the ratio: `converted_amount / base_amount`
4. Multiply each macro by the ratio: `calories * ratio`, `protein * ratio`, etc.

**Client-side** (in `useMealTypeEntries`):
- Primary path: Fetch portion data from the backend, use portion's nutritional values
- Fallback path: If portion fetch fails, use the product's local nutritional data

**Backend-side** (in `app/services/calculation.py`):
- `calc_totals_for_entry()` performs the same conversion using `Decimal` arithmetic for precision
- Returns a `MacroTotals` dataclass with calories, protein, carbs, fat

## Hooks

### useFoodEntries

Located in `client/src/hooks/useFoodEntries.ts`. Manages food entry creation and retrieval.

**Actions:**
- `saveMealToBackend(mealType, items, products, day?)` -- Saves multiple food items as backend entries. Ensures products and portions exist before creating entries.
- `getEntriesForDay(day)` -- Fetches all entries for a given day from the backend
- `deleteEntry(entryId)` -- Deletes a single entry

Uses two in-memory caches to reduce API calls:
- `portionCache` (Map) -- Maps `productId` to `portionId`
- `productSyncedCache` (Set) -- Tracks which products have been verified in the backend

### useMealTypeEntries

Located in `client/src/hooks/useMealTypeEntries.ts`. Manages entries for a specific meal type and day.

**Params:** `mealType` (required), `day` (defaults to today)

**State:** `entries` (EnrichedFoodEntry[]), `loading`, `error`

**Actions:**
- `refresh()` -- Fetches, filters, and enriches entries from the backend
- `updateEntry(entryId, amount, unit)` -- Persists to DB, then updates local state with recalculated macros
- `deleteEntry(entryId)` -- Persists to DB, then removes from local state

Uses an LRU portion cache (max 100 entries) to avoid repeated portion API calls.

### useDayStats

Located in `client/src/hooks/useDayStats.ts`. Fetches aggregated macro totals for today.

**State:** `stats` (DayStats | null), `loading`, `error`

**Actions:**
- `refresh()` -- Calls `GET /v1/stats/day/{today}`, transforms string values to numbers

The `DayStats` type contains:
- `day` -- Date string (YYYY-MM-DD)
- `totals` -- Aggregated MacroTotals for the entire day
- `byMealType` -- Partial record mapping each meal type to its MacroTotals

On error, returns zero-valued stats so the UI can still render.

Helper: `getMealTypeTotals(stats, mealType)` returns the totals for a specific meal type, defaulting to zeros.

## Backend Endpoints

### Food Entries

All endpoints require device authentication and scope data to the authenticated `device_id`.

- `GET /v1/food-entries` -- List entries. Supports filters: `day` (single date), `from`/`to` (date range)
- `POST /v1/food-entries` -- Create an entry. Requires `product_id`, `portion_id`, `day`, `meal_type`, `amount`, `unit`
- `GET /v1/food-entries/{entry_id}` -- Get a specific entry
- `PATCH /v1/food-entries/{entry_id}` -- Update entry fields (`portion_id`, `meal_type`, `amount`, `unit`)
- `DELETE /v1/food-entries/{entry_id}` -- Soft-delete an entry

### Stats

- `GET /v1/stats/day/{day}` -- Returns macro totals for a single day, broken down by meal type. Joins `food_entries` with `product_portions` and uses unit conversion to calculate accurate totals.
- `GET /v1/stats/daily?from={date}&to={date}` -- Returns daily macro totals for a date range

### Food Entry Model (Backend)

The `food_entries` table:
- `id` (UUID, PK)
- `device_id` (UUID, FK to `devices`)
- `product_id` (UUID, FK to `products`)
- `portion_id` (UUID, FK to `product_portions`)
- `day` (date, indexed) -- The client-local calendar day
- `meal_type` (enum: breakfast, lunch, dinner, snacks, water)
- `amount` (Decimal, 12,3)
- `unit` (enum: mg, g, kg, ml, l, tsp, tbsp, cup)
- `created_at`, `updated_at`, `deleted_at` (from `TimestampMixin`)

The stats service queries this table joined with `product_portions` to compute macro totals. Entries with `deleted_at` set are excluded from all queries.
