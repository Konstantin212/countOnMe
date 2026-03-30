---
type: api
status: current
last-updated: 2026-03-30
related-features:
  - water-tracking
---

# Water Logs API

Prefix: `/v1/water-logs` | Auth: Supabase JWT (Bearer token)

Track water intake by day. Part of the water tracking feature.

## Endpoints

### List Water Logs

```
GET /v1/water-logs?from=2026-03-01&to=2026-03-31
Authorization: Bearer {supabase_jwt}
```

List water logs for the authenticated user, optionally filtered by date range.

**Query Params:**
- `from` (optional) — Start date (ISO 8601)
- `to` (optional) — End date (ISO 8601)

| Status | Response |
|--------|----------|
| 200 OK | `WaterLogResponse[]` |
| 401 Unauthorized | Invalid JWT |

### Create Water Log

```
POST /v1/water-logs
Authorization: Bearer {supabase_jwt}
X-Device-Id: {device_id}
Body: { day: date, amount_ml: int }
```

Create a new water log entry.

**Headers:**
- `X-Device-Id` (optional) — Device ID for offline-first tracking

| Status | Response |
|--------|----------|
| 201 Created | `WaterLogResponse` |
| 400 Bad Request | Invalid input (amount_ml must be positive) |
| 401 Unauthorized | Invalid JWT |

### Get Water Log

```
GET /v1/water-logs/{water_log_id}
Authorization: Bearer {supabase_jwt}
```

Retrieve a specific water log entry.

| Status | Response |
|--------|----------|
| 200 OK | `WaterLogResponse` |
| 404 Not Found | Water log not found |
| 401 Unauthorized | Invalid JWT |

### Update Water Log

```
PATCH /v1/water-logs/{water_log_id}
Authorization: Bearer {supabase_jwt}
X-Device-Id: {device_id}
Body: { amount_ml?: int }
```

Update a water log entry.

| Status | Response |
|--------|----------|
| 200 OK | `WaterLogResponse` |
| 400 Bad Request | Invalid input |
| 404 Not Found | Water log not found |
| 401 Unauthorized | Invalid JWT |

### Delete Water Log

```
DELETE /v1/water-logs/{water_log_id}
Authorization: Bearer {supabase_jwt}
```

Soft-delete a water log entry.

| Status | Response |
|--------|----------|
| 204 No Content | (empty) |
| 404 Not Found | Water log not found |
| 401 Unauthorized | Invalid JWT |

## Schemas

**WaterLogCreateRequest**: `day` (date), `amount_ml` (int, > 0)

**WaterLogUpdateRequest**: `amount_ml?` (int, > 0)

**WaterLogResponse**: `id`, `day`, `amount_ml`, `created_at`, `updated_at`

## Key Files

- `backend/app/features/water/router.py` — Endpoints
- `backend/app/features/water/schemas.py` — Request/response models
- `backend/app/features/water/service.py` — Business logic
