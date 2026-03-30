---
type: api
status: current
last-updated: 2026-03-30
related-features:
  - moderation
---

# Moderation API

Prefix: `/v1/moderation` | Auth: Supabase JWT (Bearer token), admin for admin endpoints

User reporting, blocking, and admin moderation of shared foods.

## Endpoints

### Create Report

```
POST /v1/moderation/reports
Authorization: Bearer {supabase_jwt}
Body: {
  target_shared_food_id: UUID,
  reason: "spam" | "offensive" | "inaccurate" | "other",
  detail?: string
}
```

Report a shared food item for policy violation.

| Status | Response |
|--------|----------|
| 201 Created | `ReportResponse` |
| 400 Bad Request | Cannot report own food |
| 404 Not Found | Food not found |
| 429 Too Many Requests | Rate limited (10/hour) |
| 401 Unauthorized | Invalid JWT |

### List My Reports

```
GET /v1/moderation/reports/mine?limit=50&offset=0
Authorization: Bearer {supabase_jwt}
```

List reports submitted by the authenticated user (all statuses).

| Status | Response |
|--------|----------|
| 200 OK | `ReportListItem[]` |
| 401 Unauthorized | Invalid JWT |

### Create Block

```
POST /v1/moderation/blocks
Authorization: Bearer {supabase_jwt}
Body: { blocked_user_id: UUID }
```

Block a user (prevents them from seeing your shared foods and vice versa).

| Status | Response |
|--------|----------|
| 201 Created | `BlockResponse` |
| 400 Bad Request | Cannot block yourself |
| 404 Not Found | User not found |
| 429 Too Many Requests | Rate limited (100/hour) |
| 401 Unauthorized | Invalid JWT |

### Unblock User

```
DELETE /v1/moderation/blocks/{blocked_user_id}
Authorization: Bearer {supabase_jwt}
```

Unblock a previously blocked user.

| Status | Response |
|--------|----------|
| 204 No Content | (empty) |
| 404 Not Found | Block not found |
| 401 Unauthorized | Invalid JWT |

### List Blocked Users

```
GET /v1/moderation/blocks?limit=50&offset=0
Authorization: Bearer {supabase_jwt}
```

List users blocked by the authenticated user.

| Status | Response |
|--------|----------|
| 200 OK | `BlockResponse[]` |
| 401 Unauthorized | Invalid JWT |

## Admin Endpoints

### Get Pending Reports

```
GET /v1/admin/moderation/reports?limit=50&offset=0
Authorization: Bearer {admin_jwt}
```

List reports awaiting admin action (status = pending).

| Status | Response |
|--------|----------|
| 200 OK | `ReportResponse[]` |
| 403 Forbidden | Admin access required |
| 401 Unauthorized | Invalid JWT |

### Resolve Report

```
POST /v1/admin/moderation/reports/{report_id}/resolve
Authorization: Bearer {admin_jwt}
Body: {
  resolution_note?: string
}
```

Admin resolves a pending report.

| Status | Response |
|--------|----------|
| 200 OK | `ReportResponse` |
| 403 Forbidden | Admin access required |
| 404 Not Found | Report not found |
| 401 Unauthorized | Invalid JWT |

### Approve Food

```
POST /v1/admin/moderation/foods/{food_id}/approve
Authorization: Bearer {admin_jwt}
```

Approve a pending shared food (make it visible).

| Status | Response |
|--------|----------|
| 200 OK | `SharedFoodResponse` |
| 403 Forbidden | Admin access required |
| 404 Not Found | Food not found |
| 401 Unauthorized | Invalid JWT |

### Reject Food

```
POST /v1/admin/moderation/foods/{food_id}/reject
Authorization: Bearer {admin_jwt}
Body: { reason?: string }
```

Reject a pending shared food (hide it, owner only).

| Status | Response |
|--------|----------|
| 200 OK | `SharedFoodResponse` |
| 403 Forbidden | Admin access required |
| 404 Not Found | Food not found |
| 401 Unauthorized | Invalid JWT |

### Moderation Stats

```
GET /v1/admin/moderation/stats
Authorization: Bearer {admin_jwt}
```

Admin dashboard statistics.

| Status | Response |
|--------|----------|
| 200 OK | `ModerationStatsResponse` |
| 403 Forbidden | Admin access required |
| 401 Unauthorized | Invalid JWT |

**Response:** pending_reports, pending_foods

## Schemas

**ReportCreateRequest**: `target_shared_food_id`, `reason`, `detail?`

**ReportResponse**: `id`, `reporter_user_id`, `target_shared_food_id`, `reason`, `detail?`, `created_at`, `resolved_at?`, `resolved_by_user_id?`, `resolution_note?`

**BlockCreateRequest**: `blocked_user_id`

**BlockResponse**: `id`, `blocker_user_id`, `blocked_user_id`, `created_at`

**ResolveReportRequest**: `resolution_note?`

## Key Files

- `backend/app/features/moderation/router.py` — Endpoints
- `backend/app/features/moderation/schemas.py` — Request/response models
- `backend/app/features/moderation/service.py` — Report/block logic, admin actions
