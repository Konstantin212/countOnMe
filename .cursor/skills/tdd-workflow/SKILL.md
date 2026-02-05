---
name: tdd-workflow
description: Use this skill when writing new features, fixing bugs, or refactoring code. Enforces test-driven development with 80%+ coverage using Vitest (client) and pytest (backend).
---

# Test-Driven Development Workflow

This skill ensures all code development follows TDD principles with comprehensive test coverage.

## Tech Stack

### Client Testing
- **Vitest** - Fast unit test runner
- **React Testing Library** - Component testing
- **Detox** - E2E testing for React Native

### Backend Testing
- **pytest** - Test framework
- **pytest-asyncio** - Async test support
- **pytest-cov** - Coverage reporting
- **httpx** - Async API testing

## When to Activate

- Writing new features or functionality
- Fixing bugs or issues
- Refactoring existing code
- Adding API endpoints
- Creating new components
- Adding business logic (calorie calculations)

## Core Principles

### 1. Tests BEFORE Code
ALWAYS write tests first, then implement code to make tests pass.

### 2. Coverage Requirements
- Minimum 80% coverage (unit + integration)
- All edge cases covered
- Error scenarios tested
- Boundary conditions verified

### 3. Test Types

#### Unit Tests
- Individual functions and utilities
- Component logic
- Service layer methods
- Calorie calculations

#### Integration Tests
- API endpoints
- Database operations
- AsyncStorage operations
- Service interactions

#### E2E Tests (Detox)
- Critical user flows
- Product creation workflow
- Meal logging workflow
- Data persistence verification

## TDD Workflow Steps

### Step 1: Write User Journeys
```
As a [role], I want to [action], so that [benefit]

Example:
As a user, I want to create a product with calories,
so that I can track my daily calorie intake.
```

### Step 2: Generate Test Cases
For each user journey, create comprehensive test cases:

```typescript
// client/src/services/utils/calories.test.ts
import { describe, it, expect } from 'vitest'
import { calculateCalories } from './calories'

describe('calculateCalories', () => {
  it('calculates calories for given grams', () => {
    // Test basic calculation
  })

  it('returns 0 for 0 grams', () => {
    // Test edge case
  })

  it('throws for negative grams', () => {
    // Test error case
  })

  it('handles decimal values', () => {
    // Test precision
  })
})
```

### Step 3: Run Tests (They Should Fail)
```bash
# Client
cd client
npm test

# Backend
cd backend
poetry run pytest
```

### Step 4: Implement Code
Write minimal code to make tests pass.

### Step 5: Run Tests Again
```bash
# Tests should now pass
npm test
poetry run pytest
```

### Step 6: Refactor
Improve code quality while keeping tests green.

### Step 7: Verify Coverage
```bash
# Client
npm test -- --coverage

# Backend
poetry run pytest --cov=app --cov-report=term-missing
```

## Client Testing Patterns (Vitest)

### Test File Structure
```
client/src/
├── services/
│   ├── utils/
│   │   ├── calories.ts
│   │   └── calories.test.ts     # Co-located test
│   └── api/
│       ├── products.ts
│       └── products.test.ts
├── hooks/
│   ├── useProducts.ts
│   └── useProducts.test.ts
└── components/
    ├── ProductCard.tsx
    └── ProductCard.test.tsx
```

### Unit Test Example

```typescript
// client/src/services/utils/calories.test.ts
import { describe, it, expect } from 'vitest'
import { calculateCalories, calculateMealTotal } from './calories'

describe('calculateCalories', () => {
  it('calculates calories for given grams', () => {
    // Arrange
    const caloriesPer100g = 165
    const grams = 150

    // Act
    const result = calculateCalories(caloriesPer100g, grams)

    // Assert
    expect(result).toBe(247.5)
  })

  it('returns 0 for 0 grams', () => {
    expect(calculateCalories(100, 0)).toBe(0)
  })

  it('handles decimal values', () => {
    expect(calculateCalories(165, 33.5)).toBeCloseTo(55.275)
  })

  it('throws for negative grams', () => {
    expect(() => calculateCalories(100, -50)).toThrow('Grams cannot be negative')
  })
})

describe('calculateMealTotal', () => {
  it('sums calories from multiple items', () => {
    const items = [
      { productId: '1', grams: 100, caloriesPer100g: 165 },
      { productId: '2', grams: 200, caloriesPer100g: 130 },
    ]

    const total = calculateMealTotal(items)

    expect(total).toBe(425) // 165 + 260
  })

  it('returns 0 for empty array', () => {
    expect(calculateMealTotal([])).toBe(0)
  })
})
```

### Component Test Example

```typescript
// client/src/components/ProductCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ProductCard } from './ProductCard'

describe('ProductCard', () => {
  const mockProduct = {
    id: '123',
    name: 'Chicken Breast',
    caloriesPer100g: 165,
  }

  it('displays product name', () => {
    render(<ProductCard product={mockProduct} onPress={vi.fn()} />)
    
    expect(screen.getByText('Chicken Breast')).toBeTruthy()
  })

  it('displays calories per 100g', () => {
    render(<ProductCard product={mockProduct} onPress={vi.fn()} />)
    
    expect(screen.getByText('165 kcal/100g')).toBeTruthy()
  })

  it('calls onPress when tapped', () => {
    const onPress = vi.fn()
    render(<ProductCard product={mockProduct} onPress={onPress} />)
    
    fireEvent.press(screen.getByTestId('product-card'))
    
    expect(onPress).toHaveBeenCalledWith('123')
  })
})
```

### Custom Hook Test Example

```typescript
// client/src/hooks/useProducts.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react-native'
import { useProducts } from './useProducts'
import * as storage from '@/storage/products'

vi.mock('@/storage/products')

describe('useProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads products on mount', async () => {
    const mockProducts = [
      { id: '1', name: 'Product 1', caloriesPer100g: 100 },
    ]
    vi.mocked(storage.getProducts).mockResolvedValue(mockProducts)

    const { result } = renderHook(() => useProducts())

    await waitFor(() => {
      expect(result.current.products).toEqual(mockProducts)
    })
  })

  it('handles loading state', async () => {
    vi.mocked(storage.getProducts).mockResolvedValue([])

    const { result } = renderHook(() => useProducts())

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('adds product and refreshes list', async () => {
    vi.mocked(storage.getProducts).mockResolvedValue([])
    vi.mocked(storage.saveProduct).mockResolvedValue(undefined)

    const { result } = renderHook(() => useProducts())

    await act(async () => {
      await result.current.addProduct({
        name: 'New Product',
        caloriesPer100g: 150,
      })
    })

    expect(storage.saveProduct).toHaveBeenCalled()
  })
})
```

### API Module Test Example

```typescript
// client/src/services/api/products.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProducts, createProduct } from './products'
import * as http from './http'

vi.mock('./http')

describe('products API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getProducts', () => {
    it('fetches products from API', async () => {
      const mockProducts = [{ id: '1', name: 'Test', kcal_100g: 100 }]
      vi.mocked(http.apiFetch).mockResolvedValue(mockProducts)

      const result = await getProducts()

      expect(http.apiFetch).toHaveBeenCalledWith('/products')
      expect(result).toEqual(mockProducts)
    })
  })

  describe('createProduct', () => {
    it('POSTs product to API', async () => {
      const newProduct = { name: 'New', caloriesPer100g: 100 }
      const created = { id: '1', ...newProduct }
      vi.mocked(http.apiFetch).mockResolvedValue(created)

      const result = await createProduct(newProduct)

      expect(http.apiFetch).toHaveBeenCalledWith('/products', {
        method: 'POST',
        body: JSON.stringify(newProduct),
      })
      expect(result).toEqual(created)
    })
  })
})
```

## Backend Testing Patterns (pytest)

### Test File Structure
```
backend/
├── app/
│   ├── api/
│   ├── models/
│   ├── services/
│   └── schemas/
└── tests/
    ├── conftest.py           # Fixtures
    ├── test_products.py
    ├── test_portions.py
    ├── test_food_entries.py
    └── test_auth.py
```

### conftest.py (Fixtures)

```python
# backend/tests/conftest.py
import pytest
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.device import Device

DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def engine():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def session(engine):
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session


@pytest.fixture
async def device(session):
    """Create a test device."""
    device = Device(
        id=uuid4(),
        token_hash="$2b$12$test_hash",
    )
    session.add(device)
    await session.commit()
    return device
```

### Service Layer Tests

```python
# backend/tests/test_product_service.py
import pytest
from uuid import uuid4
from app.services.products import ProductService
from app.schemas.product import ProductCreate


@pytest.mark.asyncio
async def test_create_product(session, device):
    """Should create a product for device."""
    service = ProductService(session)
    data = ProductCreate(name="Chicken", kcal_100g=165)

    product = await service.create(device.id, data)

    assert product.name == "Chicken"
    assert product.kcal_100g == 165
    assert product.device_id == device.id
    assert product.deleted_at is None


@pytest.mark.asyncio
async def test_list_only_own_device(session, device):
    """Should only return products for requesting device."""
    service = ProductService(session)
    other_device_id = uuid4()
    
    # Create products for both devices
    await service.create(device.id, ProductCreate(name="My Product", kcal_100g=100))
    await service.create(other_device_id, ProductCreate(name="Other", kcal_100g=100))

    products = await service.list(device.id)

    assert len(products) == 1
    assert products[0].name == "My Product"


@pytest.mark.asyncio
async def test_get_returns_none_for_other_device(session, device):
    """Should return None for other device's products."""
    service = ProductService(session)
    other_device_id = uuid4()
    
    other_product = await service.create(
        other_device_id, 
        ProductCreate(name="Other", kcal_100g=100)
    )

    result = await service.get(device.id, other_product.id)

    assert result is None


@pytest.mark.asyncio
async def test_soft_delete(session, device):
    """Should soft delete, not hard delete."""
    service = ProductService(session)
    product = await service.create(
        device.id,
        ProductCreate(name="To Delete", kcal_100g=100)
    )

    success = await service.delete(device.id, product.id)

    assert success is True
    
    # Should not appear in list
    products = await service.list(device.id)
    assert len(products) == 0
    
    # But should still exist in DB with deleted_at
    await session.refresh(product)
    assert product.deleted_at is not None
```

### API Router Tests

```python
# backend/tests/test_products_api.py
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_product(authenticated_client: AsyncClient):
    """Should create product via POST /v1/products."""
    payload = {"name": "Rice", "kcal_100g": 130}

    response = await authenticated_client.post("/v1/products", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Rice"
    assert data["kcal_100g"] == 130


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    """Should return 401 without auth token."""
    response = await client.post("/v1/products", json={"name": "Test", "kcal_100g": 100})

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_validation_error(authenticated_client: AsyncClient):
    """Should return 422 for invalid data."""
    payload = {"name": "", "kcal_100g": -50}

    response = await authenticated_client.post("/v1/products", json=payload)

    assert response.status_code == 422
```

## E2E Testing Patterns (Detox)

### Test File Structure
```
client/e2e/
├── jest.config.js
├── firstTest.e2e.ts
├── products.e2e.ts
└── meals.e2e.ts
```

### E2E Test Example

```typescript
// client/e2e/products.e2e.ts
import { device, element, by, expect } from 'detox'

describe('Product Management', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await device.reloadReactNative()
  })

  it('should create a new product', async () => {
    // Navigate to products
    await element(by.id('tab-products')).tap()
    
    // Tap add button
    await element(by.id('add-product-button')).tap()
    
    // Fill form
    await element(by.id('product-name-input')).typeText('Chicken Breast')
    await element(by.id('product-calories-input')).typeText('165')
    
    // Save
    await element(by.id('save-product-button')).tap()
    
    // Verify product appears in list
    await expect(element(by.text('Chicken Breast'))).toBeVisible()
  })

  it('should persist products after app restart', async () => {
    // Create product
    await element(by.id('tab-products')).tap()
    await element(by.id('add-product-button')).tap()
    await element(by.id('product-name-input')).typeText('Test Product')
    await element(by.id('product-calories-input')).typeText('100')
    await element(by.id('save-product-button')).tap()
    
    // Restart app
    await device.reloadReactNative()
    
    // Verify product still exists
    await element(by.id('tab-products')).tap()
    await expect(element(by.text('Test Product'))).toBeVisible()
  })
})
```

## Coverage Thresholds

### Vitest Configuration
```typescript
// client/vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
})
```

### pytest Configuration
```ini
# backend/pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"

[tool.coverage.report]
fail_under = 80
```

## Common Testing Mistakes

### ❌ WRONG: Testing Implementation Details
```typescript
// Don't test internal state
expect(component.state.count).toBe(5)
```

### ✅ CORRECT: Test Observable Behavior
```typescript
// Test what users see
expect(screen.getByText('Count: 5')).toBeTruthy()
```

### ❌ WRONG: No Test Isolation
```typescript
// Tests depend on each other
test('creates product', () => { /* ... */ })
test('updates same product', () => { /* depends on previous test */ })
```

### ✅ CORRECT: Independent Tests
```typescript
test('creates product', () => {
  const product = createTestProduct()
  // Test logic
})

test('updates product', () => {
  const product = createTestProduct()  // Fresh data
  // Update logic
})
```

## Success Metrics

- 80%+ code coverage achieved
- All tests passing (green)
- No skipped or disabled tests
- Fast test execution (< 30s for unit tests)
- E2E tests cover critical user flows
- Tests catch bugs before production

---

**Remember**: Tests are not optional. They are the safety net that enables confident refactoring, rapid development, and production reliability.
