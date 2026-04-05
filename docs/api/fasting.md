---
type: api
status: current
last-updated: 2026-04-05
---

# Fasting API

All endpoints require authentication (Supabase JWT via `get_current_user_id`). User is scoped to authenticated identity.

## Endpoints

### List Fasting Sessions

**Request**:
- **Method**: GET
- **Path**: `/v1/fasting-sessions`
- **Auth**: Required (Supabase JWT)
- **Query Params**:
  - `limit` (integer, 1–200, default 50) — Max results per page
  - `offset` (integer, ≥0, default 0) — Pagination offset

**Response**: 200 OK
```typescript
[
  {
    id: "uuid",
    technique: "16:8" | "18:6" | "20:4" | "custom",
    fasting_hours: number,
    started_at: "2026-04-05T10:00:00Z",
    target_end_at: "2026-04-06T02:00:00Z",
    ended_at: "2026-04-06T02:30:00Z" | null,
    completed: boolean,
    created_at: "2026-04-05T10:00:00Z",
    updated_at: "2026-04-05T10:05:00Z"
  }
]
```

---

### Start Fasting Session

**Request**:
- **Method**: POST
- **Path**: `/v1/fasting-sessions`
- **Auth**: Required
- **Body**:
  ```typescript
  {
    technique: "16:8" | "18:6" | "20:4" | "custom",  // required
    fasting_hours: number,                             // required, 1–72
    started_at: "2026-04-05T10:00:00Z"                // required, ISO 8601 UTC
  }
  ```

**Response**: 201 Created
```typescript
{
  id: "uuid",
  technique: "16:8",
  fasting_hours: 16,
  started_at: "2026-04-05T10:00:00Z",
  target_end_at: "2026-04-06T02:00:00Z",
  ended_at: null,
  completed: false,
  created_at: "2026-04-05T10:00:00Z",
  updated_at: "2026-04-05T10:00:00Z"
}
```

**Status Codes**:
- 201 Created — Session started successfully
- 400 Bad Request — Invalid technique, fasting_hours, or started_at timestamp
- 401 Unauthorized — Missing or invalid auth
- 409 Conflict — User already has an active fasting session (ended_at IS NULL)
- 429 Too Many Requests — Rate limit exceeded (20 writes/min per user)

---

### Get Active Fasting Session

**Request**:
- **Method**: GET
- **Path**: `/v1/fasting-sessions/active`
- **Auth**: Required

**Response**: 200 OK (same schema as Start response) or 404 Not Found

---

### Get Fasting Session

**Request**:
- **Method**: GET
- **Path**: `/v1/fasting-sessions/{session_id}`
- **Auth**: Required
- **Path Params**: `session_id` (UUID)

**Response**: 200 OK or 404 Not Found (if not owned by user or deleted)

---

### End Fasting Session

**Request**:
- **Method**: POST
- **Path**: `/v1/fasting-sessions/{session_id}/end`
- **Auth**: Required
- **Body**:
  ```typescript
  {
    ended_at: "2026-04-06T02:30:00Z"  // required, ISO 8601 UTC
  }
  ```

**Response**: 200 OK with updated session

**Status Codes**:
- 200 OK — Session ended (idempotent; returns as-is if already ended)
- 400 Bad Request — Invalid ended_at timestamp or ended_at < started_at
- 401 Unauthorized
- 404 Not Found — Session not found or not owned
- 429 Too Many Requests

---

### Update Fasting Session

**Request**: PATCH `/v1/fasting-sessions/{session_id}` — Body: `{ technique?, fasting_hours?, started_at?, ended_at? }`

**Response**: 200 OK with updated session. If `started_at` or `fasting_hours` changes, `target_end_at` is recalculated.

**Status Codes**: 200 OK, 400 Bad Request, 401 Unauthorized, 404 Not Found, 429 Too Many Requests

---

### Delete Fasting Session

**Request**:
- **Method**: DELETE
- **Path**: `/v1/fasting-sessions/{session_id}`
- **Auth**: Required

**Response**: 204 No Content (soft delete)

**Status Codes**:
- 204 No Content — Deleted (or already deleted)
- 401 Unauthorized
- 404 Not Found — Session not owned by user
- 429 Too Many Requests

---

## Schemas

**FastingStartRequest**: `{ technique, fasting_hours, started_at }`

**FastingEndRequest**: `{ ended_at }`

**FastingUpdateRequest**: `{ technique?, fasting_hours?, started_at?, ended_at? }` (all optional)

**FastingSessionResponse**: `{ id, technique, fasting_hours, started_at, target_end_at, ended_at, completed, created_at, updated_at }`
- `target_end_at` = `started_at + fasting_hours` (server-calculated)
- `completed` = boolean, true if `ended_at >= target_end_at`

## Constraints & Validation

- **Technique**: One of "16:8", "18:6", "20:4", or "custom" only
- **Fasting Hours**: 1–72 hours inclusive
- **Timestamp Bounds**: All timestamps must be within ±24 hours from now (future) or ±365 days (past)
- **One Active Session**: A user cannot have more than one non-ended, non-deleted session at a time (409 Conflict)
- **Ended After Start**: `ended_at` must be >= `started_at`
- **Completed Flag**: Automatically calculated server-side as `ended_at >= target_end_at`

## Rate Limiting

- **Limit**: 20 write requests (POST, PATCH, DELETE) per 60 seconds per user
- **Applies to**: POST /, POST /{id}/end, PATCH /{id}, DELETE /{id}
- **Status Code**: 429 Too Many Requests when exceeded

## Key Files

- `backend/app/features/fasting/router.py` — Endpoint handlers
- `backend/app/features/fasting/schemas.py` — Request/response Pydantic models
- `backend/app/features/fasting/service.py` — Business logic and validation
- `backend/app/features/fasting/models.py` — SQLAlchemy ORM model
