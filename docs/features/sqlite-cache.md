---
type: feature
status: current
last-updated: 2026-03-30
related-features:
  - sync-system
---

# SQLite Local Cache

## Overview

Phase 6 introduced a SQLite-backed cache layer to replace AsyncStorage. The local database stores a user-scoped copy of backend data (products, portions, food entries, goals, body weights, water logs) with change tracking (dirty flags, timestamps) to support offline-first workflows and efficient delta-based sync.

## Architecture

### Motivation

AsyncStorage is key-value, untyped, and inefficient for complex queries. SQLite enables:

- Typed schema with indexes
- Efficient local queries (filter, sort, aggregate)
- Transaction support for multi-entity operations
- Change tracking via dirty flags (`is_dirty`, `created_on_device_id`, `updated_on_device_id`)
- Atomic sync: fetch latest from backend, merge locally, mark clean

### Storage Strategy

| Data | Storage | Primary | Scope |
|------|---------|---------|-------|
| Products | SQLite | User | User-scoped (user_id column) |
| Portions | SQLite | User | User-scoped |
| Food Entries | SQLite | User | User-scoped |
| Goals | SQLite | User | User-scoped |
| Body Weights | SQLite | User | User-scoped |
| Water Logs | SQLite | User | User-scoped |
| Auth Token | AsyncStorage | Device | Device-scoped |

## Schema

**SCHEMA_V1** in `client/src/storage/database.ts`:

```
- products: id, user_id, name, barcode, calories_per_100g, is_dirty, deleted_at
- product_portions: id, product_id, label, calories, is_dirty, deleted_at
- food_entries: id, product_id, portion_id, day, meal_type, amount, unit, is_dirty
- user_goals: id, goal_type, value, is_dirty, deleted_at
- body_weights: id, day, weight_kg, is_dirty, deleted_at
- water_logs: id, day, amount_ml, is_dirty, deleted_at
```

All tables include:
- `user_id` — Scope by authenticated user
- `is_dirty` — 1 if local changes not yet synced; 0 if in sync with backend
- `created_at`, `updated_at` — Local timestamps
- `deleted_at` — Soft delete marker
- `created_on_device_id`, `updated_on_device_id` — Device metadata for sync

Indexes on user_id and is_dirty for efficient queries and dirty-tracking.

## Repository Pattern

Repositories provide type-safe, async access to SQLite:

**Example: `ProductRepository`**

```typescript
class ProductRepository {
  async getAll(userId: string): Promise<Product[]>
  async getById(userId: string, id: string): Promise<Product | null>
  async create(userId: string, data: ProductInput): Promise<Product>
  async update(userId: string, id: string, data: Partial<ProductInput>)
  async delete(userId: string, id: string): Promise<void>
  async getDirty(userId: string): Promise<Product[]>  // For sync
}
```

Repositories:
- Accept the database instance and user_id for every operation
- Return strongly-typed objects, not raw rows
- Set `is_dirty = 1` on CREATE/UPDATE/DELETE
- Handle transactions for multi-entity operations

## Dirty Tracking & Sync

When a user makes a local change (create/update/delete product):

1. Repository updates the local row and sets `is_dirty = 1`
2. Change is immediately visible to the UI
3. On next sync:
   - Client calls `GET /v1/sync/pull` to fetch server state
   - Merges with local dirty rows using LWW (last-write-wins on updated_at)
   - Sends dirty rows via `POST /v1/sync/push`
   - Backend updates and returns new server_updated_at
   - Client sets `is_dirty = 0` for synced rows

## Migration from AsyncStorage

Old AsyncStorage-based products are migrated on first app launch via a one-time migration script. No user action required.

## Key Files

- `client/src/storage/database.ts` — Database interface, schema, initialization
- `client/src/storage/DatabaseProvider.tsx` — React Provider for DI
- `client/src/storage/repositories/ProductRepository.ts` — Product CRUD + dirty tracking
- `client/src/storage/repositories/PortionRepository.ts` — Portion CRUD
- `client/src/storage/repositories/FoodEntryRepository.ts` — Food entry CRUD
- `client/src/hooks/useSync.ts` — Sync engine using pull/push endpoints
