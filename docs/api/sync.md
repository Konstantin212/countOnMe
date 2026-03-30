---
type: api
status: current
last-updated: 2026-03-30
related-features:
  - sync-system
  - sqlite-cache
---

# Sync API

Prefix: `/v1/sync` | Auth: Supabase JWT (Bearer token)

Delta-based sync endpoints. Client pulls changes since the last sync version and pushes local dirty rows. Uses last-write-wins (LWW) for conflict resolution.

## Endpoints

### Pull (Fetch Server Changes)

```
GET /v1/sync/pull?since_version=0&limit=500
Authorization: Bearer {supabase_jwt}
```

Fetch records updated since the last sync version. Returns all entity types grouped as upserts (full rows) and deletes (IDs only).

**Query Params:**
- `since_version` (default: 0) — Sync version from previous response
- `limit` (default: 500, max: 500) — Max rows per entity type

| Status | Response |
|--------|----------|
| 200 OK | `SyncPullResponse` |
| 401 Unauthorized | Invalid JWT |

**Response:** All entity types (products, portions, food_entries, goals, body_weights, water_logs) with upserts, deletes, sync_version, and has_more flag.

**Conflict resolution:** LWW using `updated_at`. If server's `updated_at` is newer, overwrite local; otherwise, local version (dirty) will be pushed.

### Push (Send Local Changes)

```
POST /v1/sync/push
Authorization: Bearer {supabase_jwt}
X-Device-Id: {device_id}
Body: {
  products: { upserts: [...], deletes: [...] },
  portions: { upserts: [...], deletes: [...] },
  food_entries: { upserts: [...], deletes: [...] },
  goals: { upserts: [...], deletes: [...] },
  body_weights: { upserts: [...], deletes: [...] },
  water_logs: { upserts: [...], deletes: [...] }
}
```

Send local dirty rows to the server.

**Headers:**
- `X-Device-Id` (optional) — Device ID for metadata (created_on_device_id, updated_on_device_id)

| Status | Response |
|--------|----------|
| 200 OK | `SyncPushResponse` |
| 400 Bad Request | Invalid input |
| 401 Unauthorized | Invalid JWT |

**Response:** For each entity type, returns the list of successfully upserted/deleted rows with updated server_updated_at values.

## Schemas

**SyncPullResponse**: All entity type changes

**SyncPushRequest**: All entity type upserts/deletes

**SyncProduct**: `id`, `name`, `barcode?`, `created_at`, `updated_at`, `deleted_at?`

**SyncPortion**: `id`, `product_id`, `label`, `base_amount`, `base_unit`, `calories`, `protein?`, `carbs?`, `fat?`, `is_default`, `created_at`, `updated_at`, `deleted_at?`

**SyncFoodEntry**: `id`, `product_id`, `portion_id`, `day`, `meal_type`, `amount`, `unit`, `created_at`, `updated_at`, `deleted_at?`

**SyncUserGoal**: `id`, `goal_type`, `value`, `created_at`, `updated_at`, `deleted_at?`

**SyncBodyWeight**: `id`, `day`, `weight_kg`, `created_at`, `updated_at`, `deleted_at?`

**SyncWaterLog**: `id`, `day`, `amount_ml`, `created_at`, `updated_at`, `deleted_at?`

## Key Files

- `backend/app/features/sync/router.py` — Pull/push endpoints
- `backend/app/features/sync/schemas.py` — Request/response models
- `backend/app/features/sync/service.py` — Sync logic (pull, push, merge)
