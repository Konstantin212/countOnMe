---
type: feature
status: current
last-updated: 2026-03-30
related-features:
  - supabase-auth
  - moderation
---

# Shared Foods

## Overview

Shared foods is a community feature (Phases 4-7) where users can publish their personal food items to the community. Other users can discover, import, and build upon these items. The visibility model (private, draft, public) controls who can see and use shared foods. Moderation flags inappropriate items for admin review or user reports.

## Visibility & Moderation States

### Visibility Enum

- **private** — Only the owner sees it
- **draft** — Only the owner sees it (working copy)
- **public** — All authenticated users can discover and import

### Moderation Status Enum

- **pending** — Awaiting admin review (published but not visible)
- **approved** — Admin approved (visible to all)
- **rejected** — Admin rejected (owner only, cannot be re-published)
- **disabled** — Admin disabled (was approved, now hidden)

**Default:** Private (unpublished). When owner calls "publish", status moves from private → pending (awaiting moderation).

## Publish & Import Flow

### Publish (Owner Action)

Owner calls `POST /v1/shared/foods/{id}/publish`:

1. Change visibility from private → public
2. Set moderation_status to pending
3. Increment publish_count
4. Return the updated food

The food is not visible to others until an admin approves it.

### Search & Discover

Users call `GET /v1/shared/foods/search?q=...`:

- Returns only public foods with moderation_status = approved
- Filters out foods from blocked users
- Returns: id, display_name, brand, category, avg_rating, import_count

### Import to Private Collection

User calls `POST /v1/shared/foods/{id}/import` (auto-creates a private copy):

1. Fetch the shared food and all portions
2. Create a new local Product (user_id set, original source stored)
3. Copy all portions to the private product
4. Increment the shared food's import_count

## Data Model

**SharedFood table:**
- `id`, `owner_user_id`, `name`, `display_name`, `description`, `brand`, `barcode`, `category`
- `visibility` (private/draft/public)
- `moderation_status` (pending/approved/rejected/disabled)
- `publish_count` — How many times owner clicked publish
- `import_count` — How many times imported by others
- `avg_rating` — User rating (scale TBD)
- `created_at`, `updated_at`, `deleted_at`

**SharedFoodPortion table:**
- Same structure as ProductPortion (label, base_amount, base_unit, calories, macros)
- References shared_food_id

## Rate Limiting

**Publish limit:** 5 publishes per user per hour (prevents spam)

## Key Files

- `backend/app/features/shared/models.py` — SharedFood, SharedFoodPortion ORM models
- `backend/app/features/shared/router.py` — CRUD, publish, unpublish, search, import endpoints
- `backend/app/features/shared/schemas.py` — Pydantic request/response models
- `backend/app/features/shared/service.py` — Business logic: publish, import, search
- `client/src/screens/DiscoverFlow/` — Shared foods UI screens
- `client/src/hooks/useSharedFoodSearch.ts` — Search hook
- `client/src/hooks/useMySharedFoods.ts` — My shared foods hook
