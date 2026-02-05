# CountOnMe Project Guidelines

Project-specific skill for CountOnMe: an offline-first calorie tracking mobile app with optional cloud sync.

---

## When to Use

Reference this skill when working on the CountOnMe project. This skill contains:
- Architecture overview
- File structure
- Code patterns
- Testing requirements
- Deployment workflow

---

## Architecture Overview

**Tech Stack:**
- **Mobile Client**: Expo 54, React Native 0.81, TypeScript 5.9
- **UI Components**: React Native Paper, React Navigation
- **Forms**: React Hook Form + Zod validation
- **Local Storage**: AsyncStorage (offline-first)
- **Backend**: FastAPI (Python 3.11+), async SQLAlchemy 2.0
- **Database**: PostgreSQL (Docker Compose locally)
- **Migrations**: Alembic
- **Auth**: Anonymous device tokens (no user accounts)
- **Testing**: Vitest (client), pytest + pytest-asyncio (backend)

**Services:**
```
┌─────────────────────────────────────────────────────────────┐
│                      Mobile Client                          │
│  Expo 54 + React Native 0.81 + TypeScript                  │
│  Local: AsyncStorage (offline-first)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                    (sync when online)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                             │
│  FastAPI + Python 3.11 + SQLAlchemy 2.0 (async)            │
│  Local: Docker Compose                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                       ┌──────────┐
                       │ Postgres │
                       │ Database │
                       └──────────┘
```

---

## File Structure

```
countOnMe/
├── client/
│   └── src/
│       ├── app/                 # Navigation setup
│       │   ├── AppNavigator.tsx
│       │   └── navigationTypes.ts
│       ├── components/          # Shared UI components
│       │   ├── MealItemRow.tsx
│       │   └── ProductListItem.tsx
│       ├── hooks/               # Custom React hooks
│       │   ├── useMeals.ts
│       │   ├── useProducts.ts
│       │   └── useTheme.ts
│       ├── models/              # TypeScript types
│       │   └── types.ts
│       ├── particles/           # Atomic UI primitives
│       │   ├── Button.tsx
│       │   ├── FormField.tsx
│       │   ├── Input.tsx
│       │   └── NumericInput.tsx
│       ├── screens/             # Screen components
│       │   ├── AddMealFlow/     # Multi-step meal creation
│       │   ├── MyDayScreen.tsx
│       │   ├── ProductsListScreen.tsx
│       │   └── ProfileScreen.tsx
│       ├── services/            # API, utils, schemas
│       │   ├── api/             # Backend API modules
│       │   │   ├── http.ts      # Fetch wrapper + auth
│       │   │   ├── products.ts
│       │   │   ├── portions.ts
│       │   │   ├── foodEntries.ts
│       │   │   └── stats.ts
│       │   ├── schemas/         # Zod validation schemas
│       │   └── utils/           # Helper functions
│       ├── storage/             # AsyncStorage + device identity
│       │   ├── device.ts        # Device ID + token
│       │   └── storage.ts       # Generic storage helpers
│       └── theme/               # Colors, theming
│           ├── colors.ts
│           └── ThemeContext.tsx
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py          # Dependencies (auth, session)
│   │   │   └── routers/         # FastAPI route handlers
│   │   │       ├── devices.py
│   │   │       ├── products.py
│   │   │       ├── portions.py
│   │   │       ├── food_entries.py
│   │   │       ├── stats.py
│   │   │       └── weights.py
│   │   ├── db/                  # Database wiring
│   │   │   ├── base.py
│   │   │   ├── engine.py
│   │   │   └── session.py
│   │   ├── models/              # SQLAlchemy ORM models
│   │   │   ├── device.py
│   │   │   ├── product.py
│   │   │   ├── product_portion.py
│   │   │   ├── food_entry.py
│   │   │   └── body_weight.py
│   │   ├── schemas/             # Pydantic request/response
│   │   │   ├── device.py
│   │   │   ├── product.py
│   │   │   ├── portion.py
│   │   │   ├── food_entry.py
│   │   │   └── stats.py
│   │   ├── services/            # Business logic
│   │   │   ├── auth.py          # Token issue + verify
│   │   │   ├── products.py
│   │   │   ├── portions.py
│   │   │   ├── food_entries.py
│   │   │   ├── stats.py
│   │   │   └── calculation.py
│   │   ├── main.py              # FastAPI app entry
│   │   └── settings.py          # Pydantic settings
│   ├── alembic/                 # Database migrations
│   │   └── versions/
│   ├── docker-compose.yml
│   └── pyproject.toml
│
└── .cursor/
    └── rules/                   # Cursor rules
```

---

## Code Patterns

### API HTTP Wrapper (Client)

```typescript
// client/src/services/api/http.ts
import { getDeviceToken } from '@/storage/device';

const BASE_URL = 'http://localhost:8000/v1';

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getDeviceToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}
```

### Device Registration (Client)

```typescript
// client/src/storage/device.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = 'device_id';
const DEVICE_TOKEN_KEY = 'device_token';

export async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = uuidv4();
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export async function getDeviceToken(): Promise<string | null> {
  return AsyncStorage.getItem(DEVICE_TOKEN_KEY);
}

export async function setDeviceToken(token: string): Promise<void> {
  await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
}
```

### FastAPI Router (Backend)

```python
# backend/app/api/routers/products.py
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_device, get_session
from app.schemas.product import ProductCreate, ProductUpdate, ProductOut
from app.services import products as product_service

router = APIRouter(prefix="/v1/products", tags=["products"])

@router.get("", response_model=list[ProductOut])
async def list_products(
    query: str | None = None,
    favourite: bool | None = None,
    session: AsyncSession = Depends(get_session),
    device_id: UUID = Depends(get_current_device),
):
    return await product_service.list_products(
        session, device_id, query=query, favourite=favourite
    )

@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    session: AsyncSession = Depends(get_session),
    device_id: UUID = Depends(get_current_device),
):
    return await product_service.create_product(session, device_id, data)
```

### Service Layer (Backend)

```python
# backend/app/services/products.py
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.schemas.product import ProductCreate

async def list_products(
    session: AsyncSession,
    device_id: UUID,
    query: str | None = None,
    favourite: bool | None = None,
) -> list[Product]:
    stmt = select(Product).where(
        Product.device_id == device_id,
        Product.deleted_at.is_(None),
    )
    if query:
        stmt = stmt.where(Product.name.ilike(f"%{query}%"))
    if favourite is not None:
        stmt = stmt.where(Product.is_favourite == favourite)

    result = await session.execute(stmt)
    return list(result.scalars().all())

async def create_product(
    session: AsyncSession,
    device_id: UUID,
    data: ProductCreate,
) -> Product:
    product = Product(device_id=device_id, **data.model_dump())
    session.add(product)
    await session.commit()
    await session.refresh(product)
    return product
```

### Zod Schema Validation (Client)

```typescript
// client/src/services/schemas/productFormSchema.ts
import { z } from 'zod';

export const productFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  calories: z.number().min(0, 'Calories must be positive'),
  protein_g: z.number().min(0).optional(),
  carbs_g: z.number().min(0).optional(),
  fat_g: z.number().min(0).optional(),
  is_favourite: z.boolean().default(false),
});

export type ProductFormData = z.infer<typeof productFormSchema>;
```

### Custom Hook with AsyncStorage

```typescript
// client/src/hooks/useProducts.ts
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/models/types';

const PRODUCTS_KEY = 'products';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const stored = await AsyncStorage.getItem(PRODUCTS_KEY);
    setProducts(stored ? JSON.parse(stored) : []);
    setLoading(false);
  }, []);

  const saveProduct = useCallback(async (product: Product) => {
    const updated = [...products, product];
    await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(updated));
    setProducts(updated);
  }, [products]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return { products, loading, saveProduct, loadProducts };
}
```

---

## Testing Requirements

### Backend (pytest)

```bash
# Run all tests
cd backend
poetry run pytest

# Run with coverage
poetry run pytest --cov=app --cov-report=html

# Run specific test file
poetry run pytest tests/test_products.py -v
```

**Test structure:**
```python
# backend/tests/test_products.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def auth_headers(client: AsyncClient):
    # Register device and get token
    response = await client.post(
        "/v1/devices/register",
        json={"device_id": "test-device-uuid"}
    )
    token = response.json()["device_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_create_product(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/v1/products",
        json={"name": "Apple", "category": "Fruit"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Apple"

@pytest.mark.asyncio
async def test_device_scoping(client: AsyncClient, auth_headers: dict):
    # Device A creates product
    resp = await client.post(
        "/v1/products",
        json={"name": "Secret"},
        headers=auth_headers,
    )
    product_id = resp.json()["id"]

    # Device B cannot access it
    resp_b = await client.post(
        "/v1/devices/register",
        json={"device_id": "device-b-uuid"}
    )
    token_b = resp_b.json()["device_token"]

    resp = await client.get(
        f"/v1/products/{product_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert response.status_code == 404
```

### Client (Vitest)

```bash
# Run tests
cd client
npm run test

# Run with watch mode
npx vitest
```

**Test structure:**
```typescript
// client/src/hooks/useProducts.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProducts } from './useProducts';

vi.mock('@react-native-async-storage/async-storage');

describe('useProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads products from storage', async () => {
    const mockProducts = [{ id: '1', name: 'Apple', calories: 52 }];
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify(mockProducts)
    );

    const { result } = renderHook(() => useProducts());

    await act(async () => {
      await result.current.loadProducts();
    });

    expect(result.current.products).toEqual(mockProducts);
    expect(result.current.loading).toBe(false);
  });

  it('saves product to storage', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue('[]');
    vi.mocked(AsyncStorage.setItem).mockResolvedValue();

    const { result } = renderHook(() => useProducts());

    await act(async () => {
      await result.current.loadProducts();
    });

    const newProduct = { id: '2', name: 'Banana', calories: 89 };

    await act(async () => {
      await result.current.saveProduct(newProduct);
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'products',
      JSON.stringify([newProduct])
    );
  });
});
```

---

## Deployment Workflow

### Pre-Deployment Checklist

- [ ] All tests passing locally
- [ ] `npm run test` passes (client)
- [ ] `poetry run pytest` passes (backend)
- [ ] `alembic upgrade head` runs without errors
- [ ] No hardcoded secrets
- [ ] Environment variables documented in `.env.example`

### Local Development

```bash
# Start backend (Postgres + FastAPI)
cd backend
docker compose up -d
poetry install
alembic upgrade head
poetry run uvicorn app.main:app --reload

# Start client (Expo)
cd client
npm install
npm run start
```

### Environment Variables

```bash
# backend/.env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/countonme
SECRET_KEY=your-secret-key-here

# backend/docker-compose.yml provides:
# - POSTGRES_USER=postgres
# - POSTGRES_PASSWORD=postgres
# - POSTGRES_DB=countonme
```

### Database Migrations

```bash
cd backend

# Create new migration after model changes
alembic revision --autogenerate -m "add new table"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

---

## Critical Rules

1. **Offline-first**: Client must work without network; local storage is source of truth
2. **Device scoping**: All data must be scoped by `device_id`; no cross-device access
3. **Soft deletes**: Use `deleted_at` timestamp; never hard delete
4. **Routers never run SQL**: Business logic belongs in services
5. **One default portion**: Exactly one `is_default=true` per product (transactional)
6. **No user accounts**: Anonymous device tokens only
7. **Many small files**: High cohesion, low coupling
8. **Type safety**: Pydantic (backend) + Zod (client) for validation

---

## Related Skills

- `coding-standarts/SKILL.md` - General coding best practices
- `backend-patterns/SKILL.md` - FastAPI + SQLAlchemy patterns
- `postgress-patterns/SKILL.md` - PostgreSQL query patterns
