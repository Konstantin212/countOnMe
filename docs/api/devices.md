---
type: api
status: current
last-updated: 2026-03-14
related-features:
  - device-auth
---

# Devices API

Prefix: `/v1/devices` | Auth: None (registration is unauthenticated)

## Endpoints

### `POST /v1/devices/register`

Register or re-register a device. Always issues a fresh token.

Rate limited: 10 requests per minute per client IP (sliding window).

Uses `SELECT ... FOR UPDATE` to prevent race conditions on concurrent registrations.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_id` | `UUID` | yes | Client-generated device identifier |

**Response** `200 OK`

| Field | Type | Description |
|-------|------|-------------|
| `device_id` | `UUID` | The registered device ID |
| `device_token` | `string` | Bearer token (`{device_id}.{secret}`) |

**Status codes:** `409` registration conflict, `422` invalid device_id, `429` rate limited

## Key Files

- `backend/app/features/auth/router.py` — Router
- `backend/app/features/auth/service.py` — Token issuance and verification
- `backend/app/features/auth/models.py` — Device ORM model
- `backend/app/features/auth/schemas.py` — Pydantic schemas
