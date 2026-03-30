---
type: api
status: current
last-updated: 2026-03-30
related-features:
  - shared-foods
---

# Shared Foods API

Prefix: `/v1/shared` | Auth: Supabase JWT (Bearer token)

Community food sharing API. Users can create, publish, search, and import shared foods. Moderation controls visibility and prevents abuse.

## Endpoints

### Create Shared Food

```
POST /v1/shared/foods
Authorization: Bearer {supabase_jwt}
Body: {
  name, display_name, description?, brand?, barcode?, category?
}
```

Create a new shared food (initially private, owned by authenticated user).

| Status | Response |
|--------|----------|
| 201 Created | `SharedFoodResponse` |
| 400 Bad Request | Validation error |
| 401 Unauthorized | Invalid JWT |

### Get Shared Food

```
GET /v1/shared/foods/{food_id}
Authorization: Bearer {supabase_jwt}
```

Retrieve a shared food. Only returns public+approved or owned foods.

| Status | Response |
|--------|----------|
| 200 OK | `SharedFoodResponse` |
| 404 Not Found | Food not found or not accessible |
| 401 Unauthorized | Invalid JWT |

### List My Shared Foods

```
GET /v1/shared/foods/mine?limit=50&offset=0
Authorization: Bearer {supabase_jwt}
```

List the authenticated user's shared foods (all visibility/status).

| Status | Response |
|--------|----------|
| 200 OK | `SharedFoodListItem[]` |
| 401 Unauthorized | Invalid JWT |

### Search Shared Foods

```
GET /v1/shared/foods/search?q=pizza&limit=50&offset=0
Authorization: Bearer {supabase_jwt}
```

Full-text search across public+approved shared foods (excludes blocked users).

| Status | Response |
|--------|----------|
| 200 OK | `SharedFoodListItem[]` |
| 401 Unauthorized | Invalid JWT |

### Update Shared Food

```
PATCH /v1/shared/foods/{food_id}
Authorization: Bearer {supabase_jwt}
Body: { name?, display_name?, ... }
```

Update shared food metadata. Only owner can update. Cannot update visibility/moderation_status via this endpoint.

| Status | Response |
|--------|----------|
| 200 OK | `SharedFoodResponse` |
| 403 Forbidden | Not the owner |
| 404 Not Found | Food not found |
| 401 Unauthorized | Invalid JWT |

### Publish Shared Food

```
POST /v1/shared/foods/{food_id}/publish
Authorization: Bearer {supabase_jwt}
```

Publish a private food. Changes visibility to public and sets moderation_status to pending.

| Status | Response |
|--------|----------|
| 200 OK | `SharedFoodResponse` |
| 403 Forbidden | Not the owner |
| 409 Conflict | Already published |
| 429 Too Many Requests | Rate limited (5/hour) |
| 401 Unauthorized | Invalid JWT |

### Unpublish Shared Food

```
POST /v1/shared/foods/{food_id}/unpublish
Authorization: Bearer {supabase_jwt}
```

Unpublish a public food (only owner, reverts to private).

| Status | Response |
|--------|----------|
| 200 OK | `SharedFoodResponse` |
| 403 Forbidden | Not the owner or already unpublished |
| 404 Not Found | Food not found |
| 401 Unauthorized | Invalid JWT |

### Import Shared Food

```
POST /v1/shared/foods/{food_id}/import
Authorization: Bearer {supabase_jwt}
```

Import a public+approved shared food as a new private product in your collection.

| Status | Response |
|--------|----------|
| 201 Created | `SharedFoodImportResponse` |
| 404 Not Found | Food not found or not accessible |
| 401 Unauthorized | Invalid JWT |

### Add Portion to Shared Food

```
POST /v1/shared/foods/{food_id}/portions
Authorization: Bearer {supabase_jwt}
Body: {
  label, base_amount, base_unit, calories, protein?, carbs?, fat?, is_default
}
```

Add a portion to a shared food (owner only).

| Status | Response |
|--------|----------|
| 201 Created | `SharedFoodPortionResponse` |
| 403 Forbidden | Not the owner |
| 404 Not Found | Food not found |
| 401 Unauthorized | Invalid JWT |

### Delete Shared Food

```
DELETE /v1/shared/foods/{food_id}
Authorization: Bearer {supabase_jwt}
```

Soft-delete a shared food (owner only).

| Status | Response |
|--------|----------|
| 204 No Content | (empty) |
| 403 Forbidden | Not the owner |
| 404 Not Found | Food not found |
| 401 Unauthorized | Invalid JWT |

## Schemas

**SharedFoodCreateRequest**: `name`, `display_name`, `description?`, `brand?`, `barcode?`, `category?`

**SharedFoodResponse**: `id`, `owner_user_id`, `name`, `display_name`, `description?`, `brand?`, `barcode?`, `category?`, `visibility`, `moderation_status`, `created_at`, `updated_at`, `portions[]`

**SharedFoodListItem**: `id`, `owner_user_id`, `name`, `display_name`, `brand?`, `barcode?`, `category?`, `visibility`, `moderation_status`, `default_portion?`

**SharedFoodImportResponse**: `product_id`, `portion_count`

**SharedFoodPortionResponse**: `id`, `shared_food_id`, `label`, `base_amount`, `base_unit`, `gram_weight?`, `calories`, `protein?`, `carbs?`, `fat?`, `is_default`

## Key Files

- `backend/app/features/shared/router.py` — Endpoints
- `backend/app/features/shared/schemas.py` — Request/response models
- `backend/app/features/shared/service.py` — Business logic
