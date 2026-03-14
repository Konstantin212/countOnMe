---
type: api
status: current
last-updated: 2026-03-14
related-features:
  - goal-system
---

# Body Weights API

Prefix: `/v1/body-weights` | Auth: Bearer token required

## Endpoints

### `GET /v1/body-weights`

List weight entries with optional date range.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | `date` | no | Start day (inclusive) |
| `to` | `date` | no | End day (inclusive) |

**Response** `200 OK` — `BodyWeightResponse[]`

### `POST /v1/body-weights`

Create a weight entry.

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `day` | `date` | yes | YYYY-MM-DD | Calendar day |
| `weight_kg` | `Decimal` | yes | > 0 | Weight in kilograms |

**Response** `201 Created` — `BodyWeightResponse`

**Errors:** `409` if entry already exists for that day and device.

### `GET /v1/body-weights/{weight_id}`

Get a single entry. **Errors:** `404`

### `PATCH /v1/body-weights/{weight_id}`

Update weight. Required: `weight_kg` (Decimal, > 0).

**Response** `200 OK` — `BodyWeightResponse`

### `DELETE /v1/body-weights/{weight_id}`

Soft-delete. **Response** `204 No Content`

## Schemas

**BodyWeightResponse**: `id`, `day`, `weight_kg` (Decimal as string), `created_at`, `updated_at`

## Key Files

- `backend/app/features/weights/router.py` — Router
- `backend/app/features/weights/service.py` — Service (CRUD)
- `backend/app/features/weights/models.py` — ORM model
- `backend/app/features/weights/schemas.py` — Pydantic schemas
