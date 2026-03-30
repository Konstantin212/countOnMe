---
type: api
status: current
last-updated: 2026-03-30
related-features:
  - supabase-auth
---

# Auth API

Prefix: `/v1/auth` | Auth: Supabase JWT (Bearer token) | Exception: `/v1/devices/register` (unauthenticated)

Manages user authentication, device linking, and account deletion. Legacy device registration endpoint is available for backward compatibility (disabled by default).

## Endpoints

### Device Registration (Legacy, Unauthenticated)

```
POST /v1/devices/register
Content-Type: application/json
Body: { device_id: UUID }
```

Register or re-register an anonymous device. Always issues a fresh token.

| Status | Response |
|--------|----------|
| 200 OK | `{ device_id, device_token }` |
| 429 Too Many Requests | Rate limited (10/min per IP) |
| 410 Gone | Legacy device auth disabled (via settings) |

### Link Device

```
POST /v1/auth/link-device
Authorization: Bearer {supabase_jwt}
Content-Type: application/json
Body: {
  device_id: UUID,
  device_name?: string,
  legacy_device_token?: string
}
```

Associate a device with the authenticated user. Optionally claim pre-login device data.

| Status | Response |
|--------|----------|
| 200 OK | `LinkDeviceWithClaimResponse` |
| 400 Bad Request | Invalid legacy token format |
| 403 Forbidden | Legacy token required to claim this device |
| 401 Unauthorized | Invalid JWT |

**Response:** Device info + claim counts (products, portions, food_entries, goals, body_weights).

### Claim Device Data

```
POST /v1/auth/claim-device-data
Authorization: Bearer {supabase_jwt}
Content-Type: application/json
Body: { device_id: UUID }
```

Claim all unclaimed data on a device for the authenticated user (idempotent).

| Status | Response |
|--------|----------|
| 200 OK | `{ claimed_counts: { products, portions, food_entries, goals, body_weights } }` |
| 404 Not Found | Device not linked to your account |
| 409 Conflict | Device data already claimed by another user |
| 401 Unauthorized | Invalid JWT |

### Get User Profile

```
GET /v1/auth/me
Authorization: Bearer {supabase_jwt}
```

Retrieve the authenticated user's profile with linked devices.

| Status | Response |
|--------|----------|
| 200 OK | `UserProfileResponse` |
| 404 Not Found | User not found |
| 401 Unauthorized | Invalid JWT |

**Response:** User id, email, created_at, devices (id, device_id, device_name, linked_at, last_seen_at).

### Delete Account

```
DELETE /v1/auth/account
Authorization: Bearer {supabase_jwt}
```

Soft-delete the user account. Removes device links and calls Supabase Admin API to delete auth record.

| Status | Response |
|--------|----------|
| 204 No Content | (empty) |
| 401 Unauthorized | Invalid JWT |

## Schemas

**DeviceRegisterRequest**: `device_id` (UUID)

**DeviceRegisterResponse**: `device_id` (UUID), `device_token` (string)

**LinkDeviceRequest**: `device_id`, `device_name?`, `legacy_device_token?`

**UserProfileResponse**: `id`, `email?`, `created_at`, `devices[]`

**ClaimDeviceDataResponse**: `claimed_counts` { products, portions, food_entries, goals, body_weights }

## Key Files

- `backend/app/features/auth/router.py` — Endpoint handlers
- `backend/app/features/auth/schemas.py` — Pydantic models
- `backend/app/features/auth/service.py` — JWT verification, user creation, device linking
- `backend/app/core/deps.py` — `get_current_user` dependency
