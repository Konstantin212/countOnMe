---
name: coding-standards
description: Universal coding standards, best practices, and patterns for CountOnMe - TypeScript, React Native, and Python development.
---

# Coding Standards & Best Practices

Universal coding standards applicable across the CountOnMe project.

## Tech Stack

### Client (Mobile)
- Expo 54 / React Native 0.81
- React 19.1 + TypeScript 5.9
- React Navigation (bottom tabs, native stack)
- React Native Paper (UI components)
- React Hook Form + Zod (forms/validation)
- AsyncStorage (local persistence)
- Vitest (testing)

### Backend (API)
- Python 3.11+ / FastAPI 0.115
- SQLAlchemy 2.0 (async ORM)
- PostgreSQL (database)
- Alembic (migrations)
- pytest + pytest-asyncio (testing)
- Ruff (linting)

## Code Quality Principles

### 1. Readability First
- Code is read more than written
- Clear variable and function names
- Self-documenting code preferred over comments
- Consistent formatting

### 2. KISS (Keep It Simple, Stupid)
- Simplest solution that works
- Avoid over-engineering
- No premature optimization
- Easy to understand > clever code

### 3. DRY (Don't Repeat Yourself)
- Extract common logic into functions
- Create reusable components
- Share utilities across modules
- Avoid copy-paste programming

### 4. YAGNI (You Aren't Gonna Need It)
- Don't build features before they're needed
- Avoid speculative generality
- Add complexity only when required
- Start simple, refactor when needed

## TypeScript Standards (Client)

### Variable Naming

```typescript
// ✅ GOOD: Descriptive names
const productSearchQuery = 'chicken'
const isUserLoggedIn = true
const totalCalories = 1200

// ❌ BAD: Unclear names
const q = 'chicken'
const flag = true
const x = 1200
```

### Function Naming

```typescript
// ✅ GOOD: Verb-noun pattern
async function fetchProducts(deviceId: string) { }
function calculateCalories(kcalPer100g: number, grams: number) { }
function isValidProduct(product: unknown): product is Product { }

// ❌ BAD: Unclear or noun-only
async function products(id: string) { }
function calories(a, b) { }
function product(p) { }
```

### Immutability Pattern (CRITICAL)

```typescript
// ✅ ALWAYS use spread operator
const updatedProduct = {
  ...product,
  name: 'New Name'
}

const updatedMeals = [...meals, newMeal]

// ❌ NEVER mutate directly
product.name = 'New Name'  // BAD
meals.push(newMeal)        // BAD
```

### Type Safety

```typescript
// ✅ GOOD: Proper types
interface Product {
  id: string
  name: string
  caloriesPer100g: number
  createdAt: Date
}

function getProduct(id: string): Promise<Product> {
  // Implementation
}

// ❌ BAD: Using 'any'
function getProduct(id: any): Promise<any> {
  // Implementation
}
```

### Error Handling

```typescript
// ✅ GOOD: Comprehensive error handling
async function fetchProducts(): Promise<Product[]> {
  try {
    const response = await apiFetch<Product[]>('/products')
    return response
  } catch (error) {
    console.error('Failed to fetch products:', error)
    throw new Error('Failed to fetch products')
  }
}

// ❌ BAD: No error handling
async function fetchProducts() {
  const response = await apiFetch('/products')
  return response
}
```

### Async/Await Best Practices

```typescript
// ✅ GOOD: Parallel execution when possible
const [products, meals, stats] = await Promise.all([
  fetchProducts(),
  fetchMeals(),
  fetchStats()
])

// ❌ BAD: Sequential when unnecessary
const products = await fetchProducts()
const meals = await fetchMeals()
const stats = await fetchStats()
```

## Python Standards (Backend)

### Type Hints

```python
# ✅ GOOD: Type hints on all functions
async def get_product(
    product_id: UUID,
    device_id: UUID,
    session: AsyncSession
) -> Product | None:
    """Get a product by ID, scoped to device."""
    stmt = select(Product).where(
        Product.id == product_id,
        Product.device_id == device_id
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()

# ❌ BAD: No type hints
async def get_product(product_id, device_id, session):
    stmt = select(Product).where(
        Product.id == product_id,
        Product.device_id == device_id
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()
```

### Docstrings

```python
# ✅ GOOD: Clear docstrings for public functions
async def create_product(
    device_id: UUID,
    data: ProductCreate,
    session: AsyncSession
) -> Product:
    """
    Create a new product for a device.
    
    Args:
        device_id: ID of the owning device
        data: Product creation data (name, kcal_100g)
        session: Database session
    
    Returns:
        Created product with generated ID
    
    Raises:
        ValueError: If kcal_100g is negative
    """
    product = Product(device_id=device_id, **data.model_dump())
    session.add(product)
    await session.commit()
    return product
```

### Error Handling

```python
# ✅ GOOD: Specific exceptions
try:
    result = await fetch_data()
except HTTPError as e:
    logger.error(f"HTTP error: {e}")
    raise HTTPException(status_code=502, detail="External service error")
except ValidationError as e:
    logger.warning(f"Validation failed: {e}")
    raise HTTPException(status_code=400, detail="Invalid data")

# ❌ BAD: Bare except
try:
    result = await fetch_data()
except:
    return None
```

### No Mutable Default Arguments

```python
# ❌ BAD: Mutable default argument
def process_items(items: list = []):
    items.append("new")
    return items

# ✅ GOOD: Use None default
def process_items(items: list | None = None) -> list:
    if items is None:
        items = []
    items.append("new")
    return items
```

## React Native Best Practices

### Component Structure

```typescript
// ✅ GOOD: Functional component with types
interface ProductCardProps {
  product: Product
  onPress: (id: string) => void
  disabled?: boolean
}

export function ProductCard({
  product,
  onPress,
  disabled = false
}: ProductCardProps) {
  return (
    <Pressable
      testID="product-card"
      onPress={() => onPress(product.id)}
      disabled={disabled}
    >
      <Text>{product.name}</Text>
      <Text>{product.caloriesPer100g} kcal/100g</Text>
    </Pressable>
  )
}

// ❌ BAD: No types, unclear structure
export function ProductCard(props) {
  return <Pressable onPress={() => props.onPress(props.product.id)}>...</Pressable>
}
```

### Custom Hooks

```typescript
// ✅ GOOD: Reusable custom hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

// Usage
const debouncedQuery = useDebounce(searchQuery, 300)
```

### State Management

```typescript
// ✅ GOOD: Proper state updates
const [products, setProducts] = useState<Product[]>([])

// Functional update for state based on previous state
const addProduct = (product: Product) => {
  setProducts(prev => [...prev, product])
}

// ❌ BAD: Direct state reference
const addProduct = (product: Product) => {
  setProducts([...products, product])  // Can be stale in async scenarios
}
```

### useEffect Dependencies

```typescript
// ✅ GOOD: All dependencies included
useEffect(() => {
  loadProducts(filter)
}, [filter, loadProducts])

// ❌ BAD: Missing dependency
useEffect(() => {
  loadProducts(filter)
}, [])  // Missing 'filter' dependency
```

### Conditional Rendering

```typescript
// ✅ GOOD: Clear conditional rendering
{isLoading && <ActivityIndicator />}
{error && <ErrorMessage error={error} />}
{data && <ProductList data={data} />}

// ❌ BAD: Ternary hell
{isLoading ? <ActivityIndicator /> : error ? <ErrorMessage error={error} /> : data ? <ProductList data={data} /> : null}
```

## API Design Standards

### FastAPI Conventions

```python
# Router structure
GET    /v1/products              # List all products
GET    /v1/products/{id}         # Get specific product
POST   /v1/products              # Create new product
PUT    /v1/products/{id}         # Update product
DELETE /v1/products/{id}         # Soft delete product

# Query parameters for filtering
GET /v1/food-entries?date=2025-02-05&limit=50
```

### Response Format

```python
# ✅ GOOD: Consistent response schemas
from pydantic import BaseModel

class ProductRead(BaseModel):
    id: UUID
    name: str
    kcal_100g: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# Error responses use HTTPException
raise HTTPException(status_code=404, detail="Product not found")
raise HTTPException(status_code=400, detail="Invalid data")
```

### Input Validation (Zod - Client)

```typescript
import { z } from 'zod'

// ✅ GOOD: Schema validation
const ProductSchema = z.object({
  name: z.string().min(1).max(100),
  caloriesPer100g: z.number().int().min(0).max(1000),
})

export type ProductInput = z.infer<typeof ProductSchema>

// Usage in form
const result = ProductSchema.safeParse(formData)
if (!result.success) {
  setErrors(result.error.flatten().fieldErrors)
  return
}
```

### Input Validation (Pydantic - Backend)

```python
from pydantic import BaseModel, Field

class ProductCreate(BaseModel):
    """Schema for creating a product."""
    
    name: str = Field(..., min_length=1, max_length=100)
    kcal_100g: int = Field(..., ge=0, le=1000)
```

## File Organization

### Client Structure

```
client/src/
├── app/                    # Navigation setup
├── components/             # Shared UI components
│   ├── ProductCard.tsx
│   └── MealCard.tsx
├── hooks/                  # Custom React hooks
│   ├── useProducts.ts
│   └── useAsyncStorage.ts
├── models/                 # TypeScript types
│   ├── Product.ts
│   └── Meal.ts
├── particles/              # Atomic UI primitives
│   ├── Input.tsx
│   └── Button.tsx
├── screens/                # Screen components
│   ├── Products/
│   └── MyDay/
├── services/               # API & business logic
│   ├── api/
│   │   ├── http.ts        # HTTP wrapper
│   │   └── products.ts    # Products API
│   ├── utils/
│   │   └── calories.ts
│   └── validation/
│       └── schemas.ts
├── storage/                # AsyncStorage modules
│   ├── products.ts
│   └── device.ts          # Device identity
└── theme/                  # Styling
```

### Backend Structure

```
backend/app/
├── api/
│   ├── deps.py            # Dependency injection
│   └── routers/
│       ├── auth.py
│       └── products.py
├── db/
│   ├── engine.py
│   └── session.py
├── models/
│   ├── base.py
│   └── product.py
├── schemas/
│   ├── product.py
│   └── auth.py
├── services/
│   ├── auth.py
│   └── products.py
├── settings.py
└── main.py
```

### File Naming

```
components/ProductCard.tsx    # PascalCase for components
hooks/useProducts.ts          # camelCase with 'use' prefix
services/api/products.ts      # camelCase for modules
models/Product.ts             # PascalCase for types
```

## Comments & Documentation

### When to Comment

```typescript
// ✅ GOOD: Explain WHY, not WHAT
// Use exponential backoff to avoid overwhelming the API during outages
const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)

// Device scoping is critical for data privacy - never skip this check
if (product.deviceId !== currentDeviceId) {
  throw new Error('Access denied')
}

// ❌ BAD: Stating the obvious
// Increment counter by 1
count++

// Set name to product's name
name = product.name
```

### TSDoc for Public APIs

```typescript
/**
 * Calculates total calories for a given amount of food.
 *
 * @param caloriesPer100g - Calories in 100 grams of the food
 * @param grams - Amount of food in grams
 * @returns Total calories for the given amount
 * @throws Error if grams is negative
 *
 * @example
 * ```typescript
 * const calories = calculateCalories(165, 150)
 * // Returns 247.5 (chicken breast, 150g)
 * ```
 */
export function calculateCalories(caloriesPer100g: number, grams: number): number {
  if (grams < 0) throw new Error('Grams cannot be negative')
  return (caloriesPer100g * grams) / 100
}
```

## Performance Best Practices

### Memoization (React Native)

```typescript
import { useMemo, useCallback } from 'react'

// ✅ GOOD: Memoize expensive computations
const sortedProducts = useMemo(() => {
  return products.sort((a, b) => a.name.localeCompare(b.name))
}, [products])

// ✅ GOOD: Memoize callbacks passed to children
const handleProductPress = useCallback((id: string) => {
  navigation.navigate('ProductDetail', { id })
}, [navigation])
```

### Database Queries (Backend)

```python
# ✅ GOOD: Select only needed columns, use limit
stmt = (
    select(Product.id, Product.name, Product.kcal_100g)
    .where(Product.device_id == device_id)
    .limit(50)
)

# ❌ BAD: Select everything without limit
stmt = select(Product)
```

## Testing Standards

### Test Structure (AAA Pattern)

```typescript
// Client (Vitest)
it('calculates calories correctly', () => {
  // Arrange
  const caloriesPer100g = 165
  const grams = 150

  // Act
  const result = calculateCalories(caloriesPer100g, grams)

  // Assert
  expect(result).toBe(247.5)
})
```

```python
# Backend (pytest)
@pytest.mark.asyncio
async def test_create_product(session, device):
    # Arrange
    service = ProductService(session)
    data = ProductCreate(name="Test", kcal_100g=100)

    # Act
    product = await service.create(device.id, data)

    # Assert
    assert product.name == "Test"
    assert product.device_id == device.id
```

### Test Naming

```typescript
// ✅ GOOD: Descriptive test names
it('returns empty array when no products match query', () => { })
it('throws error when calories is negative', () => { })
it('persists product to AsyncStorage after creation', () => { })

// ❌ BAD: Vague test names
it('works', () => { })
it('test search', () => { })
```

## Code Smell Detection

### Long Functions (> 50 lines)
```typescript
// ❌ BAD: Split into smaller functions
function processProductData() {
  // 100 lines of code
}

// ✅ GOOD
function processProductData() {
  const validated = validateData()
  const transformed = transformData(validated)
  return saveData(transformed)
}
```

### Deep Nesting (> 3 levels)
```typescript
// ❌ BAD
if (user) {
  if (product) {
    if (product.isActive) {
      if (hasPermission) {
        // Do something
      }
    }
  }
}

// ✅ GOOD: Early returns
if (!user) return
if (!product) return
if (!product.isActive) return
if (!hasPermission) return

// Do something
```

### Magic Numbers
```typescript
// ❌ BAD
if (retryCount > 3) { }
setTimeout(callback, 500)

// ✅ GOOD
const MAX_RETRIES = 3
const DEBOUNCE_DELAY_MS = 500

if (retryCount > MAX_RETRIES) { }
setTimeout(callback, DEBOUNCE_DELAY_MS)
```

**Remember**: Code quality is not negotiable. Clear, maintainable code enables rapid development and confident refactoring.
