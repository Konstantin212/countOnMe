---
name: security-review
description: Use this skill when implementing authentication, handling user input, working with device tokens, creating API endpoints, or accessing sensitive data. Provides comprehensive security checklist and patterns for CountOnMe.
---

# Security Review Skill

This skill ensures all code follows security best practices for the CountOnMe calorie tracking app.

## Tech Stack Context

### Client (React Native)
- AsyncStorage for local persistence
- Anonymous device authentication
- Bearer token for API requests

### Backend (FastAPI/Python)
- bcrypt for token hashing
- Device-scoped data access
- Pydantic input validation
- SQLAlchemy ORM (SQL injection prevention)

## When to Activate

- Implementing device authentication
- Handling user input or form data
- Creating new API endpoints
- Working with device tokens
- Storing or accessing calorie/health data
- Integrating with backend API

## Security Checklist

### 1. Device Token Management

#### ✅ CORRECT: Secure Token Storage
```typescript
// client/src/storage/device.ts
import AsyncStorage from '@react-native-async-storage/async-storage'

const DEVICE_TOKEN_KEY = '@countonme/device_token'

export async function storeDeviceToken(token: string): Promise<void> {
  // AsyncStorage is encrypted on iOS, uses SharedPreferences on Android
  await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token)
}

export async function getDeviceToken(): Promise<string | null> {
  return await AsyncStorage.getItem(DEVICE_TOKEN_KEY)
}

export async function clearDeviceToken(): Promise<void> {
  await AsyncStorage.removeItem(DEVICE_TOKEN_KEY)
}
```

#### ❌ NEVER Store Tokens Like This
```typescript
// DANGER: Never store in plain memory variables that persist
let globalToken = 'token-value'

// DANGER: Never log tokens
console.log('Token:', token)

// DANGER: Never include in URLs
fetch(`/api/products?token=${token}`)
```

#### Verification Steps
- [ ] Tokens stored in AsyncStorage (not in state/memory)
- [ ] Tokens never logged to console
- [ ] Tokens sent only in Authorization header
- [ ] Token cleared on logout/reset

### 2. Input Validation

#### Client-Side Validation (Zod)
```typescript
// client/src/services/validation/schemas.ts
import { z } from 'zod'

export const ProductSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .regex(/^[a-zA-Z0-9\s\-]+$/, 'Invalid characters'),
  caloriesPer100g: z.number()
    .int('Must be a whole number')
    .min(0, 'Cannot be negative')
    .max(1000, 'Exceeds maximum'),
})

// Validate before sending to API
export function validateProduct(data: unknown) {
  const result = ProductSchema.safeParse(data)
  if (!result.success) {
    return { valid: false, errors: result.error.flatten() }
  }
  return { valid: true, data: result.data }
}
```

#### Backend Validation (Pydantic)
```python
# backend/app/schemas/product.py
from pydantic import BaseModel, Field, field_validator
import re


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    kcal_100g: int = Field(..., ge=0, le=1000)
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        # Prevent injection via product names
        if not re.match(r'^[a-zA-Z0-9\s\-]+$', v):
            raise ValueError('Invalid characters in name')
        return v.strip()
```

#### Verification Steps
- [ ] All user inputs validated with Zod (client) and Pydantic (backend)
- [ ] Numeric inputs bounded (min/max)
- [ ] String inputs length-limited
- [ ] Special characters handled/rejected
- [ ] Error messages don't leak sensitive info

### 3. SQL Injection Prevention

#### ✅ CORRECT: Use SQLAlchemy ORM
```python
# backend/app/services/products.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.product import Product

async def get_product(
    product_id: UUID,
    device_id: UUID,
    session: AsyncSession
) -> Product | None:
    # Safe: SQLAlchemy handles parameterization
    stmt = select(Product).where(
        Product.id == product_id,
        Product.device_id == device_id,
        Product.deleted_at.is_(None)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()
```

#### ❌ NEVER Do This
```python
# DANGER: SQL injection vulnerability
async def search_products(name: str, session: AsyncSession):
    # String concatenation = SQL injection risk
    query = f"SELECT * FROM products WHERE name LIKE '%{name}%'"
    return await session.execute(text(query))
```

#### Verification Steps
- [ ] All database queries use SQLAlchemy ORM
- [ ] No string concatenation in SQL
- [ ] No raw SQL with user input
- [ ] All query parameters properly escaped

### 4. Device Scoping (CRITICAL)

This is the most important security control in CountOnMe. **ALL data access MUST be scoped by device_id**.

#### ✅ CORRECT: Device-Scoped Query
```python
# backend/app/services/products.py
async def list_products(
    device_id: UUID,
    session: AsyncSession
) -> list[Product]:
    """List products - ALWAYS filter by device_id."""
    stmt = select(Product).where(
        Product.device_id == device_id,  # CRITICAL
        Product.deleted_at.is_(None)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
```

#### ❌ WRONG: Missing Device Scope (DATA LEAK)
```python
# DANGER: Returns ALL users' products!
async def list_products(session: AsyncSession):
    stmt = select(Product)  # Missing device_id filter
    result = await session.execute(stmt)
    return list(result.scalars().all())
```

#### Verification Steps for Device Scoping
- [ ] **ALL** queries filter by device_id
- [ ] Foreign device IDs return 404 (not 403)
- [ ] Products, portions, entries are all scoped
- [ ] Soft-deleted items excluded from queries
- [ ] Device ID comes from verified auth token

### 5. Authentication & Authorization

#### Device Registration Flow
```python
# backend/app/services/auth.py
import secrets
from passlib.hash import bcrypt
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.device import Device


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def register_device(self, device_id: UUID) -> str:
        """Register device and return bearer token."""
        # Generate cryptographically secure token
        token = secrets.token_urlsafe(32)
        
        # Store only the hash
        token_hash = bcrypt.hash(token)
        
        device = Device(id=device_id, token_hash=token_hash)
        self.session.add(device)
        await self.session.commit()
        
        return token  # Return plain token to client
    
    async def verify_token(self, token: str) -> Device | None:
        """Verify token and return device."""
        stmt = select(Device).where(Device.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        devices = result.scalars().all()
        
        for device in devices:
            if bcrypt.verify(token, device.token_hash):
                return device
        
        return None
```

#### API Endpoint Protection
```python
# backend/app/api/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer

security = HTTPBearer()


async def get_current_device_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> UUID:
    """Verify token and extract device ID."""
    token = credentials.credentials
    
    auth_service = AuthService(session)
    device = await auth_service.verify_token(token)
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    return device.id


# Usage in router
@router.get("/products")
async def list_products(
    device_id: UUID = Depends(get_current_device_id),  # Auth required
    session: AsyncSession = Depends(get_session),
):
    # device_id is guaranteed valid here
    pass
```

#### Verification Steps
- [ ] All protected endpoints use `Depends(get_current_device_id)`
- [ ] Token hashed with bcrypt before storage
- [ ] Plain token never stored in database
- [ ] 401 returned for invalid/missing tokens
- [ ] 404 (not 403) for cross-device access attempts

### 6. Sensitive Data Exposure

#### ❌ WRONG: Logging Sensitive Data
```python
# DANGER: Token in logs
logger.info(f"User authenticated with token: {token}")

# DANGER: Full request body with potentially sensitive data
logger.debug(f"Request data: {request_body}")
```

#### ✅ CORRECT: Safe Logging
```python
# Log identifiers, not secrets
logger.info(f"Device {device_id} authenticated successfully")

# Redact sensitive fields
logger.debug(f"Request for product {product_id}")
```

#### ❌ WRONG: Detailed Error Messages
```python
# DANGER: Exposes database schema
except SQLAlchemyError as e:
    raise HTTPException(status_code=500, detail=str(e))
```

#### ✅ CORRECT: Generic Error Messages
```python
# Safe: Generic message, detailed log
except SQLAlchemyError as e:
    logger.error(f"Database error: {e}")  # Internal log only
    raise HTTPException(
        status_code=500,
        detail="An error occurred. Please try again."
    )
```

#### Verification Steps
- [ ] No tokens or secrets in logs
- [ ] Error messages generic for users
- [ ] Detailed errors only in server logs
- [ ] No stack traces exposed to clients

### 7. Client Security (React Native)

#### API HTTP Wrapper Security
```typescript
// client/src/services/api/http.ts
import { getDeviceToken } from '@/storage/device'

const BASE_URL = __DEV__ 
  ? 'http://localhost:8000/v1'
  : 'https://api.countonme.app/v1'

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getDeviceToken()
  
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // Token only in header, never in URL
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })
  
  if (response.status === 401) {
    // Token expired/invalid - handle re-auth
    await clearDeviceToken()
    throw new Error('Authentication required')
  }
  
  if (!response.ok) {
    // Don't expose server error details
    throw new Error('Request failed')
  }
  
  return response.json()
}
```

#### AsyncStorage Security
```typescript
// Prefix all keys to avoid collisions
const STORAGE_PREFIX = '@countonme/'

const KEYS = {
  DEVICE_TOKEN: `${STORAGE_PREFIX}device_token`,
  DEVICE_ID: `${STORAGE_PREFIX}device_id`,
  PRODUCTS: `${STORAGE_PREFIX}products`,
  MEALS: `${STORAGE_PREFIX}meals`,
}

// Never store sensitive data as plain JSON
// AsyncStorage is encrypted on iOS but not always on Android
```

### 8. Dependency Security

#### Backend (Python)
```bash
# Check for vulnerabilities
pip-audit

# Or with pip
pip install pip-audit
pip-audit --requirement requirements.txt

# Update dependencies
pip install --upgrade fastapi sqlalchemy
```

#### Client (npm)
```bash
# Check for vulnerabilities
npm audit

# Fix automatically fixable issues
npm audit fix

# Update dependencies
npm update
```

#### Verification Steps
- [ ] Dependencies up to date
- [ ] No known vulnerabilities (npm audit, pip-audit clean)
- [ ] Lock files committed (package-lock.json, poetry.lock)
- [ ] Regular security updates scheduled

## Security Testing

### Automated Security Tests

```python
# backend/tests/test_security.py
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_requires_authentication(client: AsyncClient):
    """Protected endpoints should require auth."""
    response = await client.get("/v1/products")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_device_scoping(client: AsyncClient, other_device_product):
    """Should not access other device's products."""
    response = await client.get(f"/v1/products/{other_device_product.id}")
    # Returns 404, not 403 (don't leak existence)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_input_validation(authenticated_client: AsyncClient):
    """Should reject invalid input."""
    response = await authenticated_client.post("/v1/products", json={
        "name": "",  # Invalid: empty
        "kcal_100g": -50  # Invalid: negative
    })
    assert response.status_code == 422
```

## Pre-Deployment Security Checklist

Before ANY production deployment:

- [ ] **Device Tokens**: Stored securely, hashed in database
- [ ] **Device Scoping**: ALL queries filter by device_id
- [ ] **Input Validation**: Zod (client) + Pydantic (backend)
- [ ] **SQL Injection**: All queries use SQLAlchemy ORM
- [ ] **Authentication**: Bearer token on all protected endpoints
- [ ] **Error Handling**: No sensitive data in error responses
- [ ] **Logging**: No tokens or secrets logged
- [ ] **Dependencies**: No known vulnerabilities
- [ ] **HTTPS**: Enforced in production
- [ ] **Soft Deletes**: Excluded from all queries

## CountOnMe-Specific Security Focus

### Critical Data Paths
1. **Device Registration** - Token generation and hashing
2. **Product CRUD** - Device scoping on all operations
3. **Food Entries** - Device scoping + date validation
4. **Stats/Totals** - Device scoping on aggregations

### Data Privacy
- No user accounts (anonymous)
- All data tied to device_id
- No cross-device data access
- Soft deletes preserve data recovery option

---

**Remember**: Security is not optional. One vulnerability can expose all users' calorie data. When in doubt, err on the side of caution.
