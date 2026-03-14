---
type: api
status: current
last-updated: 2026-03-14
related-features:
  - product-management
---

# Products API

Prefix: `/v1/products` | Auth: Bearer token required

## Endpoints

### `GET /v1/products`

List all products for the authenticated device. Soft-deleted excluded.

**Response** `200 OK` — `ProductResponse[]`

### `POST /v1/products`

Create a new product.

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | `UUID` | no | | Client-generated ID |
| `name` | `string` | yes | 1-200 chars | Product name |

**Response** `201 Created` — `ProductResponse`

### `GET /v1/products/{product_id}`

Get a single product. **Errors:** `404` if not found or wrong device.

**Response** `200 OK` — `ProductResponse`

### `PATCH /v1/products/{product_id}`

Update a product. Only `name` (string, 1-200 chars) is updatable.

**Response** `200 OK` — `ProductResponse`

### `DELETE /v1/products/{product_id}`

Soft-delete a product. **Response** `204 No Content`

### `GET /v1/products/check-name`

Check if a product name is available for the device.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | yes | 1-200 chars, case-insensitive |

**Response** `200 OK` — `{"available": true|false}`

### `GET /v1/products/search`

Unified search across user products and catalog.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `q` | `string` | yes | | Search term (1-200 chars) |
| `limit` | `int` | no | 35 | Max results (max 60) |

**Response** `200 OK` — `ProductSearchResultItem[]` (user results first, then catalog)

## Schemas

**ProductResponse**: `id`, `name`, `created_at`, `updated_at`

**ProductSearchResultItem**: `id`, `name`, `source` (user/catalog), `calories_per_100g`, `protein_per_100g`, `carbs_per_100g`, `fat_per_100g`, `catalog_id`

## Key Files

- `backend/app/api/routers/products.py` — Router
- `backend/app/services/products.py` — Service (CRUD, search, name check)
- `backend/app/models/product.py` — ORM model
- `backend/app/schemas/product.py` — Pydantic schemas
