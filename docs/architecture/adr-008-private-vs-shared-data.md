---
type: adr
status: proposed
last-updated: 2026-03-25
related-features:
  - supabase-migration
  - data-model
  - future-social-features
---

# ADR-008: Private vs Shared Data Domains

## Status

Proposed

## Context

CountOnMe currently has two data domains with distinct ownership models:

1. **Private data** -- scoped by `device_id` (moving to `user_id` per ADR-005):
   - `products` -- user-created foods
   - `product_portions` -- portion definitions for user products
   - `food_entries` -- daily food log entries
   - `user_goals` -- calorie/macro targets
   - `body_weights` -- weight tracking
   - Water logs (client-only, no backend table yet)
   - Favourites and recents (client-only, AsyncStorage `string[]`)
   - Draft meal state (client-only, AsyncStorage)

2. **Global catalog data** -- no ownership, read-only:
   - `catalog_products` -- seeded from USDA + Open Food Facts (ADR-003, ADR-004)
   - `catalog_portions` -- portion definitions for catalog products

As the app evolves, a third domain will emerge: **shared/community data** where users contribute products, meal templates, or recipes that other users can discover and use. This ADR establishes the boundaries between these domains now, before the Supabase migration, to ensure the data model scales correctly.

## Decision

### 1. Three data domains with clear boundaries

| Domain | Ownership | Visibility | Mutability | Sync | Storage |
|---|---|---|---|---|---|
| **Private** | Single user (`user_id`) | Owner only | Full CRUD | Bidirectional (ADR-007) | Server Postgres + Client SQLite |
| **Catalog** | System (no owner) | All authenticated users | Read-only (seeded) | Not synced (API-fetched) | Server Postgres only |
| **Shared** (future) | Contributing user (`owner_user_id`) | Configurable | Owner can edit; others can copy | Server-only | Server Postgres only |

### 2. Private entities -- complete inventory

These entities are owned by a single user and synced between their devices:

| Entity | Server Table | Client SQLite Table | Key Fields | Notes |
|---|---|---|---|---|
| Products | `products` | `products` | `id`, `user_id`, `name`, `barcode` | User-created or copied from catalog |
| Product Portions | `product_portions` | `product_portions` | `id`, `user_id`, `product_id`, `label`, `base_amount`, `base_unit`, `calories`, macros | Exactly one `is_default=true` per product |
| Food Entries | `food_entries` | `food_entries` | `id`, `user_id`, `product_id`, `portion_id`, `day`, `meal_type`, `amount`, `unit` | Day is client-local date |
| User Goals | `user_goals` | `user_goals` | `id`, `user_id`, all metric/target fields | Typically one active goal |
| Body Weights | `body_weights` | `body_weights` | `id`, `user_id`, `day`, `weight_kg` | One entry per day |
| Water Logs | `water_logs` (NEW) | `water_logs` | `id`, `user_id`, `day`, `amount_ml` | New backend table, migrated from client-only |
| Favourites | n/a (stored in user preferences) | `favourites` | `user_id`, `product_id`, `position` | Currently AsyncStorage `string[]`, move to SQLite with ordering |
| Recents | n/a (ephemeral) | `recents` | `product_id`, `last_used_at` | Client-only, not synced, capped at 50 |
| Draft Meal | n/a | n/a (keep in AsyncStorage) | `mealType`, `itemsByMealType` | Ephemeral UI state, not synced |

### 3. Catalog entities -- unchanged

The existing catalog tables remain as-is from ADR-003 and ADR-004:

| Entity | Server Table | Ownership | Access Pattern |
|---|---|---|---|
| Catalog Products | `catalog_products` | System (no owner) | `GET /v1/catalog/products/search`, `GET /v1/catalog/products/{id}` |
| Catalog Portions | `catalog_portions` | System (no owner) | Returned with parent product |

Key characteristics:
- No `user_id`, no `device_id`, no `deleted_at`
- Populated via seed script (`backend/scripts/seed_catalog.py`)
- Unique constraint on `(source, source_id)` for idempotent seeding
- `search_vector` (tsvector) for full-text search
- Read-only from the client's perspective

When a user selects a catalog product, a **copy** is created in their private `products` table with `source = 'catalog'` and the catalog product's nutritional data. This is the existing pattern (see `ProductsListScreen` filtering by `source === "user"`).

### 4. Shared domain -- future design (not implemented now)

When community features are added, shared data will use **separate tables**, not mixed columns in private tables:

```sql
-- Future: shared_products (community-contributed foods)
CREATE TABLE shared_products (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id     UUID NOT NULL REFERENCES users(id),
    name              TEXT NOT NULL,
    -- ... nutritional fields ...
    visibility        TEXT NOT NULL DEFAULT 'private',  -- 'private' | 'unlisted' | 'public'
    moderation_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ
);

-- Future: shared_meal_templates
CREATE TABLE shared_meal_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id     UUID NOT NULL REFERENCES users(id),
    name              TEXT NOT NULL,
    items             JSONB NOT NULL,  -- array of {product_id, amount, unit}
    visibility        TEXT NOT NULL DEFAULT 'private',
    moderation_status TEXT NOT NULL DEFAULT 'pending',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ
);
```

Visibility model:
- **private**: only the owner can see it (default -- same as current behavior)
- **unlisted**: accessible via direct link/ID but not in search results
- **public**: appears in community search, subject to moderation

Moderation model:
- **pending**: newly shared, not yet reviewed (could be auto-approved based on user trust score)
- **approved**: visible in community search
- **rejected**: hidden from community, owner notified with reason

The owner can always edit or delete their shared items. Other users can "copy" a shared item into their private collection (same pattern as catalog products).

### 5. Why separate tables, not a visibility column on existing tables

The private `products` table has sync metadata (`is_dirty`, `last_synced_at`, `server_updated_at`) and is replicated to every client device via SQLite. Adding shared/community products to the same table would mean:
- Every user's SQLite DB would grow with community data they did not create
- Sync would need to distinguish "my rows" from "community rows I can see"
- Privacy bugs become more likely (a WHERE clause miss exposes other users' data)

Separate tables enforce the boundary at the schema level: private tables are always scoped by `user_id`, shared tables are always filtered by `visibility` + `moderation_status`.

### 6. Data flow between domains

```
┌──────────────┐     copy      ┌──────────────┐
│   Catalog    │──────────────►│   Private    │
│  (read-only) │               │  (user-owned)│
└──────────────┘               └──────┬───────┘
                                      │
                                share (future)
                                      │
                                      ▼
                               ┌──────────────┐
                               │    Shared    │
                               │ (community)  │
                               └──────┬───────┘
                                      │
                                copy (future)
                                      │
                                      ▼
                               ┌──────────────┐
                               │   Private    │
                               │ (other user) │
                               └──────────────┘
```

Data always flows via **copy**, never via reference. A private product that was copied from catalog does not maintain a live link to the catalog entry. If the catalog entry is updated (re-seeded), the user's copy is unaffected. This is intentional: the user may have customized the nutritional values for their specific brand/preparation.

### 7. Client-only vs synced data

| Data | Current Storage | Post-Migration Storage | Synced? |
|---|---|---|---|
| Products | AsyncStorage `@countOnMe/products/v2` | SQLite `products` | Yes |
| Meals (legacy) | AsyncStorage `@countOnMe/meals/v2` | Deprecated (food_entries replace) | No |
| Product Favourites | AsyncStorage `@countOnMe/products-favourites/v1` | SQLite `favourites` | Yes (lightweight) |
| Product Recents | AsyncStorage `@countOnMe/products-recents/v1` | SQLite `recents` | No (device-specific) |
| Goal | AsyncStorage `@countOnMe/goal/v1` | SQLite `user_goals` | Yes |
| Body Weights | AsyncStorage `@countOnMe/body-weights/v1` | SQLite `body_weights` | Yes |
| Water Logs | AsyncStorage `@countOnMe/water-logs/v1` | SQLite `water_logs` | Yes |
| Draft Meal | AsyncStorage `@countOnMe/draft-meal/v1` | AsyncStorage (unchanged) | No (ephemeral) |
| Theme Preference | AsyncStorage `@countOnMe/theme/v1` | AsyncStorage (unchanged) | No (device-specific) |
| Auth Tokens | AsyncStorage `device:token` | SecureStore (ADR-006) | No |

## Consequences

### Positive
- Clear ownership boundaries prevent privacy leaks at the schema level
- Separate tables for each domain allow independent indexing, caching, and access control strategies
- The copy-based data flow between domains is simple, predictable, and already implemented for catalog-to-private
- Future shared/community features can be added without modifying the private data schema
- Explicitly marking recents and draft meal as "not synced" avoids over-engineering sync for ephemeral data

### Negative
- Separate tables for shared data mean some column duplication (product fields appear in `products`, `catalog_products`, and future `shared_products`)
- The "copy" model means nutritional data can diverge between the catalog source and user's version (but this is intentional)
- Favourites ordering (5-slot system) adds a `position` column that must be kept consistent across devices

### Risks
- **Premature shared-domain design**: The shared tables are specified here but not implemented. If community features never ship, this design work is unused. Mitigation: the ADR only documents the intended approach; no tables are created until the feature is actually built.
- **Favourites sync conflicts**: Two devices reordering favourites simultaneously could produce inconsistent slot positions. Mitigation: favourites are a small dataset (max 5); last-write-wins with full replacement (push the entire array) is acceptable.
- **Legacy meals table**: The existing `meals` AsyncStorage data has no backend equivalent and no migration path to `food_entries`. Mitigation: the legacy meal format is already unused by the current AddMealFlow (which creates `food_entries` directly); the old data can be migrated or discarded during the storage transition.

## Alternatives Considered

### A. Single products table with visibility column
Rejected because: mixing private, catalog, and shared products in one table creates a security-critical WHERE clause dependency. Every query must include `WHERE (user_id = :me OR visibility = 'public')`, and a missing clause leaks data. Separate tables make this impossible by design.

### B. Sync recents and draft meal to server
Rejected because: recents are device-specific UX state (what was recently used on THIS device), and draft meal is ephemeral form state. Syncing them adds complexity and bandwidth for no user-facing benefit.

### C. Reference-based linking instead of copy
Rejected because: a live reference from private product to catalog entry would mean catalog re-seeds could change a user's historical food entries retroactively. Nutritional values for a meal logged on March 1 should not change when the catalog is updated on March 15.
