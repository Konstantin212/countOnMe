# CountOnMe Architecture Overview

## 1. System Overview

CountOnMe is an offline-first calorie tracking mobile application. Users create products (with nutritional data), log food entries against those products, set daily calorie/macro goals, and view intake statistics. The system operates without user accounts -- devices authenticate anonymously using a UUID-based token scheme.

**Primary components:**

| Component | Technology | Role |
|-----------|-----------|------|
| Mobile Client | Expo 54 / React Native 0.81 / TypeScript 5.9 | UI, offline storage, API sync |
| Backend API | FastAPI 0.115 / Python 3.11+ / Uvicorn | Business logic, persistence, auth |
| Database | PostgreSQL (Docker Compose locally) | Relational data store |
| External API | Open Food Facts | Product search by name/barcode |

## 2. Architecture Diagram

```
+-----------------------------------------------------------+
|                     Mobile Client                         |
|              (Expo / React Native / TS)                   |
|                                                           |
|  +------------+   +-----------+   +--------------------+  |
|  |  Screens   |-->|   Hooks   |-->|   Storage Layer    |  |
|  | (UI layer) |   | (state +  |   |  (AsyncStorage)    |  |
|  +------------+   |  effects) |   +--------------------+  |
|                   +-----------+                           |
|                        |                                  |
|                        v                                  |
|              +-------------------+                        |
|              |    API Client     |                        |
|              | (services/api/)   |                        |
|              +-------------------+                        |
|                   |          |                             |
+-------------------|----------|-----------------------------+
                    |          |
          HTTP/JSON |          | HTTP/JSON
                    v          v
   +----------------+    +---------------------+
   | FastAPI Backend |   | Open Food Facts API  |
   |   (Python)      |   | (world.openfoodfacts |
   |                 |   |         .org)        |
   +--------+--------+   +---------------------+
            |
            v
   +------------------+
   |   PostgreSQL      |
   | (Docker Compose)  |
   +------------------+
```

**Data flow paths:**

1. **Online (backend-first):** Screen -> Hook -> API Client -> FastAPI -> PostgreSQL
2. **Offline (local-first):** Screen -> Hook -> AsyncStorage (immediate) -> SyncQueue (deferred backend push)
3. **Product search:** Screen -> Open Food Facts API -> User confirms -> local product + backend sync

## 3. Client Architecture

### 3.1 Navigation Structure

Three bottom tabs, each containing a native stack navigator:

```
Bottom Tabs
+-- MyDayTab (calendar icon)
|   +-- MyDay                  (daily overview: goals, meal type cards)
|   +-- AddMeal                (select meal type, view draft entries)
|   +-- SelectProduct          (search/pick product for a food entry)
|   +-- AddFood                (set amount/portion for selected product)
|   +-- MealTypeEntries        (view all entries for a meal type)
|   +-- ProductForm            (quick-add new product inline)
|
+-- MyPathTab (trending-up icon)
|   +-- MyPath                 (future: analytics & trends)
|
+-- ProfileTab (person icon)
    +-- ProfileMenu            (settings hub)
    +-- ProductsList            (browse all products)
    +-- ProductDetails          (view product + portions)
    +-- ProductForm             (add/edit product)
    +-- ProductSearch           (search Open Food Facts)
    +-- ProductConfirm          (confirm OFF product import)
    +-- MealsList               (legacy meal templates)
    +-- MealBuilder             (build meal template)
    +-- MealDetails             (view meal template)
    +-- GoalSetup               (choose goal method)
    +-- GoalCalculated          (enter body metrics)
    +-- GoalCalculatedResult    (review calculated goal)
    +-- GoalManual              (enter calories/macros manually)
```

The MyDay stack is wrapped in a `DraftMealProvider` context that holds in-progress food entries during the add-meal flow.

### 3.2 Hooks (State Management)

Hooks own all state and side effects. Screens never talk to storage or APIs directly.

| Hook | Data Source | Strategy |
|------|------------|----------|
| `useProducts` | AsyncStorage + API | **Offline-first.** Loads from local storage immediately, syncs mutations to backend via SyncQueue. |
| `useFoodEntries` | API | **Backend-first.** All CRUD goes through the API; no local cache. |
| `useMealTypeEntries` | API + products | **Backend-first.** Fetches food entries for a day, enriches each with product/portion data. |
| `useGoal` | AsyncStorage + API | **Offline-first with backend sync.** Loads local goal first, then tries to fetch remote. Saves to both. |
| `useDayStats` | API | **Backend-first.** Fetches aggregated calorie/macro totals for a given day. |
| `useMeals` | AsyncStorage | **Local-only (legacy).** Meal templates stored locally. |
| `useSyncStatus` | NetInfo + SyncQueue | **Network monitoring.** Tracks online/offline state and pending sync operations. |
| `useTheme` | AsyncStorage | **Local-only.** Persists light/dark/system preference. |

### 3.3 Storage Layer

**AsyncStorage keys:**

| Key Pattern | Data |
|-------------|------|
| `@countOnMe/products/v2` | Product list (with v1 -> v2 migration) |
| `@countOnMe/meals/v2` | Meal templates (with v1 -> v2 migration) |
| `@countOnMe/goal/v1` | Current user goal |
| `@countOnMe/theme/v1` | Theme preference |
| `@countOnMe/products-favourites/v1` | Favourite product IDs |
| `@countOnMe/products-recents/v1` | Recently used product IDs |
| `device:id` | Device UUID (generated once) |
| `device:token` | Bearer token for API auth |
| `syncQueue:v1` | Pending sync operations |
| `syncQueue:lastSyncAt` | Timestamp of last successful sync |
| `syncQueue:lastError` | Last sync error message |

### 3.4 API Client

Centralized in `services/api/http.ts`. The `apiFetch<T>()` function handles:

1. **Auto-registration:** If no device token exists, registers the device and stores the token before the first request.
2. **Bearer auth:** Every request includes `Authorization: Bearer {device_id}.{secret}`.
3. **401 retry:** On 401 response, clears the token, re-registers, and retries the request once.
4. **Concurrent registration guard:** A singleton promise prevents multiple simultaneous device registrations.
5. **JSON serialization:** Automatic `Content-Type: application/json` and body serialization.

### 3.5 Open Food Facts Integration

The client integrates directly with the Open Food Facts public API (`world.openfoodfacts.org`) for:

- **Product search by name:** `GET /cgi/search.pl` with search terms
- **Product lookup by barcode:** `GET /api/v2/product/{barcode}.json`

Returned data includes product name, brand, image, and per-100g nutriments (calories, protein, carbs, fat). Users confirm the import before the product is saved locally.

## 4. Backend Architecture

### 4.1 Layered Design

```
Request -> Router -> Service -> SQLAlchemy ORM -> PostgreSQL
                        |
                   (business rules,
                    device scoping,
                    calculations)
```

**Strict separation:**
- **Routers** (`app/api/routers/`): Parse inputs via Pydantic, call services, return responses. No SQL, no business logic.
- **Services** (`app/services/`): All business logic, domain rules, query orchestration, and calculations.
- **Models** (`app/models/`): SQLAlchemy ORM definitions only.
- **Schemas** (`app/schemas/`): Pydantic request/response models only.
- **Dependencies** (`app/api/deps.py`): Auth resolution, DB session injection.

### 4.2 Authentication Model

Anonymous device-token authentication with no user accounts:

```
1. Client generates UUID (device_id) on first launch
2. Client calls POST /v1/devices/register { device_id }
3. Backend issues token: "{device_id}.{secret}" where secret = 32-byte URL-safe random
4. Backend stores only SHA-256(secret + pepper) -- never the raw token
5. Client stores full token in AsyncStorage
6. All subsequent requests: Authorization: Bearer {device_id}.{secret}
7. Backend parses token, looks up device, verifies hash with HMAC-safe comparison
8. Backend updates device.last_seen_at on each authenticated request
```

Row locking (`SELECT ... FOR UPDATE`) prevents race conditions during concurrent device registrations.

### 4.3 Routers

All routers are mounted under the `/v1` prefix:

| Router | Prefix | Auth | Purpose |
|--------|--------|------|---------|
| devices | `/v1/devices` | None | Device registration |
| products | `/v1/products` | Bearer | Product CRUD |
| portions | `/v1/products/{id}/portions`, `/v1/portions` | Bearer | Product portion CRUD |
| food-entries | `/v1/food-entries` | Bearer | Daily food entry CRUD |
| goals | `/v1/goals` | Bearer | Goal CRUD + calculation |
| stats | `/v1/stats` | Bearer | Day stats, daily trends, weight trends |
| sync | `/v1/sync` | Bearer | Cursor-based incremental sync |
| weights | `/v1/body-weights` | Bearer | Body weight CRUD |
| (health) | `/health` | None | Health check (unversioned) |

### 4.4 Services

| Service | Responsibility |
|---------|---------------|
| `auth` | Token issuance, parsing, verification (SHA-256 + pepper), device lookup |
| `products` | Product CRUD with device scoping and soft deletes |
| `portions` | Portion CRUD, enforces exactly one `is_default=true` per product |
| `food_entries` | Food entry CRUD, validates portion belongs to product and same device |
| `goals` | Goal CRUD, stores calculated and manual goals |
| `goal_calculation` | BMR (Mifflin-St Jeor), TDEE, macro splits, BMI, healthy weight range |
| `stats` | Aggregated calorie/macro totals per day and per meal type |
| `weights` | Body weight record CRUD |
| `calculation` | Utility calculation functions |

### 4.5 Database Models

All domain models (except Device) use `TimestampMixin` which provides `created_at`, `updated_at`, and `deleted_at` (soft delete).

| Model | Table | Key Columns | Scoping |
|-------|-------|-------------|---------|
| Device | `devices` | id (UUID PK), token_hash, last_seen_at | Self (root entity) |
| Product | `products` | id, device_id (FK), name | device_id |
| ProductPortion | `product_portions` | id, device_id (FK), product_id (FK), label, base_amount, base_unit, calories, protein, carbs, fat, is_default | device_id |
| FoodEntry | `food_entries` | id, device_id (FK), product_id (FK), portion_id (FK), day, meal_type, amount, unit | device_id |
| UserGoal | `user_goals` | id, device_id (FK), goal_type, body metrics, calculated values, macro targets | device_id |
| BodyWeight | `body_weights` | id, device_id (FK), day, weight_kg | device_id |

### 4.6 Migrations

Six Alembic migrations in order:

| # | Migration | Description |
|---|-----------|-------------|
| 0001 | `devices_and_enums` | Creates `devices` table, `unit_enum`, `meal_type_enum` |
| 0002 | `products` | Creates `products` table with device FK |
| 0003 | `product_portions` | Creates `product_portions` table |
| 0004 | `food_entries` | Creates `food_entries` table |
| 0005 | `body_weights` | Creates `body_weights` table |
| 0006 | `user_goals` | Creates `user_goals` table |

## 5. Client-Backend Integration Map

### Devices

| Client Function | Method | Endpoint |
|----------------|--------|----------|
| `registerDevice(deviceId)` | POST | `/v1/devices/register` |

### Products

| Client Function | Method | Endpoint |
|----------------|--------|----------|
| `listProducts()` | GET | `/v1/products` |
| `createProduct({id, name})` | POST | `/v1/products` |
| `getProduct(id)` | GET | `/v1/products/{id}` |
| `updateProduct(id, {name})` | PATCH | `/v1/products/{id}` |
| `deleteProduct(id)` | DELETE | `/v1/products/{id}` |

### Portions

| Client Function | Method | Endpoint |
|----------------|--------|----------|
| `listPortions(productId)` | GET | `/v1/products/{product_id}/portions` |
| `createPortion(productId, body)` | POST | `/v1/products/{product_id}/portions` |
| `getPortion(id)` | GET | `/v1/portions/{id}` |
| `updatePortion(id, body)` | PATCH | `/v1/portions/{id}` |
| `deletePortion(id)` | DELETE | `/v1/portions/{id}` |

### Food Entries

| Client Function | Method | Endpoint |
|----------------|--------|----------|
| `listFoodEntries({day, from, to})` | GET | `/v1/food-entries` |
| `createFoodEntry(body)` | POST | `/v1/food-entries` |
| `getFoodEntry(id)` | GET | `/v1/food-entries/{id}` |
| `updateFoodEntry(id, body)` | PATCH | `/v1/food-entries/{id}` |
| `deleteFoodEntry(id)` | DELETE | `/v1/food-entries/{id}` |

### Goals

| Client Function | Method | Endpoint |
|----------------|--------|----------|
| `calculateGoal(body)` | POST | `/v1/goals/calculate` |
| `getCurrentGoal()` | GET | `/v1/goals/current` |
| `getGoal(id)` | GET | `/v1/goals/{id}` |
| `createCalculatedGoal(body)` | POST | `/v1/goals/calculated` |
| `createManualGoal(body)` | POST | `/v1/goals/manual` |
| `updateGoal(id, body)` | PATCH | `/v1/goals/{id}` |
| `deleteGoal(id)` | DELETE | `/v1/goals/{id}` |

### Stats

| Client Function | Method | Endpoint |
|----------------|--------|----------|
| `getDayStats(day)` | GET | `/v1/stats/day/{day}` |
| `getDailyStats(from, to)` | GET | `/v1/stats/daily?from=&to=` |
| `getWeightStats(from, to)` | GET | `/v1/stats/weight?from=&to=` |

### Sync

| Client Function | Method | Endpoint |
|----------------|--------|----------|
| (sync client) | GET | `/v1/sync/since?cursor=&limit=` |

### Data Transformation

The API client layer handles camelCase (client) to snake_case (backend) conversion. The goals API module (`services/api/goals.ts`) is the primary example, with explicit `transformGoalResponse()` and `transformCalculateResponse()` functions. Other endpoints use snake_case field names directly since their responses are simpler.

## 6. Data Synchronization Strategy

### Sync Modes by Data Type

| Data | Strategy | Source of Truth | Offline Behavior |
|------|----------|----------------|------------------|
| Products | Offline-first | AsyncStorage | Full CRUD locally, backend mutations queued |
| Food Entries | Backend-first | PostgreSQL | Not available offline |
| Goals | Offline-first + sync | AsyncStorage (primary) | Full CRUD locally, synced to backend when online |
| Day Stats | Backend-first | PostgreSQL (computed) | Not available offline |
| Meals (legacy) | Local-only | AsyncStorage | Always available |
| Theme/Favourites/Recents | Local-only | AsyncStorage | Always available |

### SyncQueue Mechanism

The `SyncQueue` (`storage/syncQueue.ts`) handles deferred backend mutations for offline-first data:

```
1. Hook performs local mutation (AsyncStorage)
2. Hook enqueues operation: { resource, action, payload }
3. SyncQueue persists to AsyncStorage (survives app restart)
4. flush() checks network connectivity (NetInfo)
5. If online: iterates queue, calls corresponding API function
6. On success: removes operation from queue
7. On failure: increments attempts, schedules retry with exponential backoff
   - Base delay: 1.5s, max: 60s, exponential cap at 6 attempts
8. Skips operations whose nextAttemptAt is in the future
```

**Supported resources:** `products`, `goals`

**Supported actions:** `create`, `update`, `delete`

### Incremental Sync (Backend)

The `/v1/sync/since` endpoint supports cursor-based incremental sync:

- Client sends a cursor (timestamp + UUID composite)
- Backend returns all products, portions, and food entries updated after the cursor
- Response includes a `next_cursor` for subsequent calls
- Soft-deleted records are included (so clients can remove them locally)

## 7. Key Design Decisions

### Anonymous Device Auth
No user accounts or sign-up. A device generates a UUID on first launch, registers with the backend, and receives a token. This eliminates authentication friction while still scoping data per device. Token rotation happens automatically on 401 responses.

### Soft Deletes
Every domain entity has a `deleted_at` column. Records are never physically deleted from PostgreSQL. Services filter out soft-deleted records by default. This supports data recovery, audit trails, and sync (clients need to know when records are removed).

### Device Scoping
All data rows are scoped to a `device_id` via foreign key. Services always filter by the authenticated device's ID. Cross-device access returns 404 (not 403), preventing device enumeration.

### Dual Storage
AsyncStorage provides instant local reads and offline resilience. PostgreSQL is the durable backend store. The SyncQueue bridges the two for offline-first entities. This means the app is usable even with no network, and data eventually syncs when connectivity returns.

### camelCase / snake_case Boundary
The client uses camelCase (TypeScript convention). The backend uses snake_case (Python convention). The API client layer in `services/api/` handles the transformation. Simple endpoints pass snake_case through; complex ones (goals) use explicit transform functions.

### Portion-Based Nutrition Model
Products do not directly store calorie data. Instead, each product has one or more `ProductPortion` records (e.g., "100g", "1 cup", "1 tbsp"), each with its own calorie and macro values. Exactly one portion per product is marked `is_default=true`. Food entries reference both a product and a specific portion.

### Open Food Facts for Product Discovery
Rather than maintaining a proprietary food database, the app integrates with the open-source Open Food Facts API for product search and barcode scanning. Users search, review nutrient data, and confirm before importing into their local product list.
