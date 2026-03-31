---
type: api
status: current
last-updated: 2026-03-31
related-features:
  - food-tracking
---

# Food Entries API

Prefix: `/v1/food-entries` | Auth: Bearer token required

## Endpoints

### `GET /v1/food-entries`

List food entries with optional date filters.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `day` | `date` | no | Filter by exact day |
| `from` | `date` | no | From day (inclusive) |
| `to` | `date` | no | To day (inclusive) |

**Response** `200 OK` — `FoodEntryResponse[]`

### `POST /v1/food-entries`

Create a new food entry. Accept one of two paths: private product (legacy) or catalog (new, per ADR-010).

**Private product path** (user-created products):

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `product_id` | `UUID` | yes | | Product reference |
| `portion_id` | `UUID` | yes | | Portion for nutrient calculation |
| `day` | `date` | yes | YYYY-MM-DD | Client-local calendar day |
| `meal_type` | `MealType` | yes | | Meal category |
| `amount` | `Decimal` | yes | > 0 | Quantity consumed |
| `unit` | `Unit` | yes | | Unit of the amount |

**Catalog path** (new, ADR-010):

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `catalog_portion_id` | `UUID` | yes | | Catalog portion reference (XOR with product_id/portion_id) |
| `day` | `date` | yes | YYYY-MM-DD | Client-local calendar day |
| `meal_type` | `MealType` | yes | | Meal category |
| `amount` | `Decimal` | yes | > 0 | Quantity consumed |
| `unit` | `Unit` | yes | | Unit of the amount |

**Validation:** Provide either `(product_id + portion_id)` OR `catalog_portion_id`, never both or neither.

**Response** `201 Created` — `FoodEntryResponse`

**Errors:** `404` if product, portion, or catalog portion not found or wrong device.

### `GET /v1/food-entries/{entry_id}`

Get a single entry. **Errors:** `404`

### `PATCH /v1/food-entries/{entry_id}`

Update an entry. Optional fields: `portion_id`, `meal_type`, `amount`, `unit`.

**Response** `200 OK` — `FoodEntryResponse`

### `DELETE /v1/food-entries/{entry_id}`

Soft-delete an entry. **Response** `204 No Content`

## Schemas

**FoodEntryResponse**: `id`, `product_id` (nullable), `portion_id` (nullable), `catalog_portion_id` (nullable), `day`, `meal_type`, `amount`, `unit`, `resolved_product_name` (nullable, enriched), `resolved_calories` (nullable, enriched), `created_at`, `updated_at`

## Key Files

- `backend/app/features/meals/router.py` — Router
- `backend/app/features/meals/service.py` — Service (CRUD, validation)
- `backend/app/features/meals/models.py` — ORM model
- `backend/app/features/meals/schemas.py` — Pydantic schemas
