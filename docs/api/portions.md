---
type: api
status: current
last-updated: 2026-03-14
related-features:
  - product-management
---

# Portions API

Auth: Bearer token required

Portions are nested under products for creation and listing, but accessed directly by `portion_id` for get/update/delete.

## Endpoints

### `GET /v1/products/{product_id}/portions`

List all portions for a product. Soft-deleted excluded.

**Response** `200 OK` — `PortionResponse[]`

### `POST /v1/products/{product_id}/portions`

Create a new portion for a product.

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `label` | `string` | yes | 1-200 chars | Portion label (e.g., "100g", "1 cup") |
| `base_amount` | `Decimal` | yes | > 0 | Base serving amount |
| `base_unit` | `Unit` | yes | | Unit of measurement |
| `calories` | `Decimal` | yes | >= 0 | Calories per base amount |
| `protein` | `Decimal` | no | >= 0 | Protein grams per base amount |
| `carbs` | `Decimal` | no | >= 0 | Carbs grams per base amount |
| `fat` | `Decimal` | no | >= 0 | Fat grams per base amount |
| `is_default` | `bool` | no | default: false | Mark as default portion |

**Response** `201 Created` — `PortionResponse`

### `GET /v1/portions/{portion_id}`

Get a single portion. **Errors:** `404` if not found or wrong device.

### `PATCH /v1/portions/{portion_id}`

Update a portion. All fields optional. **Errors:** `404`, `409` on conflict.

### `DELETE /v1/portions/{portion_id}`

Soft-delete a portion. **Errors:** `404`, `409` if referenced by entries.

## Schemas

**PortionResponse**: `id`, `product_id`, `label`, `base_amount`, `base_unit`, `calories`, `protein?`, `carbs?`, `fat?`, `is_default`, `created_at`, `updated_at`

## Key Files

- `backend/app/features/portions/router.py` — Router
- `backend/app/features/portions/service.py` — Service (CRUD, default enforcement)
- `backend/app/features/portions/models.py` — ORM model
- `backend/app/features/portions/schemas.py` — Pydantic schemas
