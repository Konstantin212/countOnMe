---
type: feature
status: current
last-updated: 2026-03-30
related-features:
  - shared-foods
  - supabase-auth
---

# Moderation & Abuse Controls

## Overview

Moderation (Phase 8) allows users to report inappropriate shared foods and block other users. Admins review pending reports, approve/reject food items, and manage blocked users. Rate limiting prevents abuse of the report system.

## User Reporting

### Create Report

```
POST /v1/moderation/reports
Authorization: Bearer {supabase_jwt}
Body: { shared_food_id, reason }
```

User reports a shared food with a reason (spam, offensive, inaccurate, etc.).

**Validation:**
- User cannot report their own food (400 Bad Request)
- Shared food must exist and be visible to the reporter (404 if not)

**Rate limiting:** 10 reports per user per hour

### List My Reports

```
GET /v1/moderation/reports/mine?limit=50&offset=0
Authorization: Bearer {supabase_jwt}
```

Returns the authenticated user's submitted reports (any status: pending, resolved, etc.).

## User Blocking

### Block User

```
POST /v1/moderation/blocks
Authorization: Bearer {supabase_jwt}
Body: { target_user_id }
```

Block another user (cannot see their shared foods, they cannot see yours).

**Validation:**
- Cannot block yourself (400 Bad Request)
- Target user must exist (404)

### Unblock User

```
DELETE /v1/moderation/blocks/{target_user_id}
Authorization: Bearer {supabase_jwt}
```

Unblock a previously blocked user.

### List Blocked Users

```
GET /v1/moderation/blocks
Authorization: Bearer {supabase_jwt}
```

Returns the authenticated user's block list.

## Admin Moderation

### Approve Food

```
POST /v1/admin/moderation/foods/{food_id}/approve
Authorization: Bearer {admin_jwt}
```

Approves a pending shared food. Sets moderation_status to approved. Food becomes visible to all users.

### Reject Food

```
POST /v1/admin/moderation/foods/{food_id}/reject
Authorization: Bearer {admin_jwt}
Body: { reason? }
```

Rejects a pending shared food. Sets moderation_status to rejected. Food is hidden from all except the owner.

### Get Pending Reports

```
GET /v1/admin/moderation/reports?limit=50&offset=0
Authorization: Bearer {admin_jwt}
```

Returns reports awaiting admin action (status = pending).

### Resolve Report

```
POST /v1/admin/moderation/reports/{report_id}/resolve
Authorization: Bearer {admin_jwt}
Body: { resolution_note? }
```

Resolves a report. The resolution note is recorded for admin reference.

### Moderation Stats (Admin)

```
GET /v1/admin/moderation/stats
Authorization: Bearer {admin_jwt}
```

Returns counts: pending_reports, pending_foods.

## Auto-Hide Logic

When a food is rejected or reported X times (threshold TBD):

- Food visibility changes to **draft** (private) or **disabled** (public)
- Owner receives notification
- Food is no longer visible to other users

## Data Model

**Report table:**
- `id`, `reporter_user_id`, `shared_food_id`, `reason`, `status`
- `created_at`, `resolved_at`

**Block table:**
- `id`, `blocker_user_id`, `blocked_user_id`
- `created_at`

## Rate Limiting

- **Create report:** 10 per user per hour
- **Create block:** 100 per user per hour

## Key Files

- `backend/app/features/moderation/router.py` — Report, block, admin endpoints
- `backend/app/features/moderation/schemas.py` — Request/response models
- `backend/app/features/moderation/service.py` — Report/block creation, admin actions
- `backend/app/features/moderation/models.py` — Report, Block ORM models
- `backend/app/core/rate_limit.py` — Rate limiter implementation
