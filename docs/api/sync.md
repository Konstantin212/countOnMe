---
type: api
status: current
last-updated: 2026-03-14
related-features:
  - sync-system
---

# Sync API

Prefix: `/v1/sync` | Auth: Bearer token required

Cursor-based synchronization endpoint. Returns all records (including soft-deleted) updated since the cursor. Used for incremental client-side sync.

## Endpoints

### `GET /v1/sync/since`

Fetch records updated since a cursor position.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `cursor` | `string` | no | null | Cursor from previous response. Omit for initial full sync. |
| `limit` | `int` | no | 200 | Max records per entity type (1-500) |

**Cursor format:** `{ISO_8601_timestamp}|{UUID}` — encodes `(updated_at, id)` of last record seen. Records ordered by `(updated_at ASC, id ASC)` for stable pagination.

**Response** `200 OK` — `SyncSinceResponse`

**Sync pattern:**
1. Initial sync: call with no cursor to get all records
2. Incremental sync: pass cursor from previous response
3. Records with non-null `deleted_at` = soft-deleted (remove from client)
4. If any array has `limit` items, call again with returned cursor

## Schemas

**SyncSinceResponse**: `cursor?` (string), `products[]`, `portions[]`, `food_entries[]`

**SyncProduct**: `id`, `name`, `updated_at`, `deleted_at?`

**SyncPortion**: `id`, `product_id`, `label`, `base_amount`, `base_unit`, `calories`, `protein?`, `carbs?`, `fat?`, `is_default`, `updated_at`, `deleted_at?`

**SyncFoodEntry**: `id`, `product_id`, `portion_id`, `day`, `meal_type`, `amount`, `unit`, `updated_at`, `deleted_at?`

## Key Files

- `backend/app/features/sync/router.py` — Router
- `backend/app/features/sync/schemas.py` — Pydantic schemas
