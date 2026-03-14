---
name: folder-structure
description: Enforced folder structure and flow-based component placement rules for CountOnMe client and backend. Use when creating new files, planning features, designing architecture, or reviewing code placement.
---

# Folder Structure & Component Placement Rules

These rules are **enforced by a PreToolUse hook** — files created in wrong locations will be blocked.

## When to Activate

- Creating new files in `client/src/` or `backend/app/`
- Planning a new feature or flow
- Designing architecture that introduces new screens or components
- Reviewing code for correct file placement

## Client: Allowed Directories

Only these 9 top-level directories are permitted in `client/src/`:

| Directory | Purpose | Contains |
|-----------|---------|----------|
| `app/` | Navigation setup | Navigator configs, route definitions |
| `components/` | Shared UI (molecules) | Components used in **2+ flows** |
| `hooks/` | Custom React hooks | State + side effects, prefixed with `use` |
| `models/` | TypeScript types | Prefer single `types.ts` file |
| `particles/` | Atomic UI primitives | No business logic, PascalCase, exported from `index.ts` |
| `screens/` | Screen components | Organized by **flow** (see below) |
| `services/` | API, utils, schemas | `api/`, `utils/`, `schemas/`, `constants.ts` |
| `storage/` | Persistence layer | AsyncStorage wrappers, device identity |
| `theme/` | Colors, theming | `colors.ts`, `ThemeContext`, types |

Any file outside these directories will be **blocked by hook**.

## Client: Flow-Based Screen Organization

Each feature/flow gets its own folder under `screens/`:

```
screens/
├── AddMealFlow/           # Each feature = own folder
│   ├── components/        # Flow-specific components (NOT shared)
│   │   ├── AddFood/
│   │   ├── AddMeal/
│   │   └── SelectProduct/
│   ├── context.tsx        # Flow-level shared state
│   └── index.tsx          # Entry screen
├── ProductFlow/           # Product CRUD
│   ├── ProductsListScreen.tsx
│   ├── ProductFormScreen.tsx
│   ├── ProductDetailsScreen.tsx
│   └── ProductSearchScreen.tsx
├── GoalFlow/              # Goal setup wizard
│   ├── components/        # Flow-specific (ActivityLevelCard, BmiScale)
│   ├── GoalSetupScreen.tsx
│   └── GoalCalculatedScreen.tsx
├── MealFlow/              # Meal list + details
│   ├── components/        # Flow-specific (EditEntryModal, EntryListItem)
│   ├── MealsListScreen.tsx
│   └── MealDetailsScreen.tsx
├── MyPath/                # Analytics dashboard
│   ├── components/        # Flow-specific (charts, cards)
│   └── MyPathScreen.tsx
└── ProfileScreen.tsx      # Standalone screens at root level
```

## Component Placement Decision Tree

```
Is this component used in more than one flow?
├── YES → components/Name.tsx (shared)
└── NO
    ├── Does it contain business logic?
    │   ├── YES → screens/XxxFlow/components/Name.tsx (flow-specific)
    │   └── NO → Is it a reusable UI primitive?
    │       ├── YES → particles/Name.tsx (atomic)
    │       └── NO → screens/XxxFlow/components/Name.tsx (flow-specific)
```

### Rules

| Scope | Location | Example |
|-------|----------|---------|
| Flow-specific (1 flow) | `screens/XxxFlow/components/Name.tsx` | `AddMealFlow/components/SelectProduct/` |
| Shared (2+ flows) | `components/Name.tsx` | `components/MacroRings.tsx` |
| Atomic UI (no logic) | `particles/Name.tsx` | `particles/FormField.tsx` |
| Standalone screen | `screens/NameScreen.tsx` | `screens/ProfileScreen.tsx` |

### Promotion & Demotion

- When a flow-specific component starts being imported by a **second flow** → **promote** it to `components/`
- When a shared component is only imported by **one flow** → **demote** it to that flow's `components/`
- Never duplicate a component across flows — promote to shared instead

## File Naming Conventions

| Type | Path | Naming Rule |
|------|------|-------------|
| Flow folder | `screens/FeatureFlow/` | PascalCase + `Flow` suffix |
| Flow screen | `screens/FeatureFlow/NameScreen.tsx` | PascalCase + `Screen` suffix |
| Flow component | `screens/FeatureFlow/components/Name.tsx` | PascalCase |
| Flow context | `screens/FeatureFlow/context.tsx` | camelCase |
| Shared component | `components/Name.tsx` | PascalCase |
| Hook | `hooks/useName.ts` | camelCase, `use` prefix (enforced by hook) |
| Particle | `particles/Name.tsx` | PascalCase (enforced by hook) |
| Type | `models/types.ts` | Add to existing file |
| Utility | `services/utils/name.ts` | camelCase |
| Schema | `services/schemas/nameSchema.ts` | camelCase |
| Constants | `services/constants.ts` | UPPER_SNAKE_CASE values |
| Test | Co-located `*.test.ts(x)` | Same name + `.test` |

## Backend: Vertical Slice Architecture

The backend uses a **feature-based vertical slice** structure. Each domain owns all its layers (router, service, models, schemas) in a single folder. Shared infrastructure lives in `core/`.

```
backend/app/
├── main.py                        # Router aggregation
├── settings.py                    # Pydantic Settings config
│
├── core/                          # Shared infrastructure (NO business logic)
│   ├── db.py                      # Base, engine, SessionLocal, get_session
│   ├── deps.py                    # Auth dependency (get_current_device_id)
│   ├── mixins.py                  # TimestampMixin (created_at, updated_at, deleted_at)
│   ├── schemas.py                 # APIModel, DeviceScoped, Timestamps
│   ├── enums.py                   # Unit, MealType, GoalType, Gender, etc.
│   └── rate_limit.py              # Sliding-window rate limiter
│
├── features/                      # Domain features (ALL business logic lives here)
│   ├── auth/                      # Device registration + token auth
│   │   ├── router.py              # POST /register
│   │   ├── service.py             # Token gen/verify/hash
│   │   ├── models.py              # Device ORM
│   │   └── schemas.py             # DeviceRegisterRequest/Response
│   │
│   ├── products/                  # Product CRUD + search
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py              # Product ORM
│   │   └── schemas.py
│   │
│   ├── portions/                  # Product portion management
│   │   ├── router.py
│   │   ├── service.py             # Default portion logic
│   │   ├── models.py              # ProductPortion ORM
│   │   └── schemas.py
│   │
│   ├── meals/                     # Food entries
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py              # FoodEntry ORM
│   │   └── schemas.py
│   │
│   ├── goals/                     # Nutrition goals
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── calculation.py         # BMR, TDEE, macros (pure logic)
│   │   ├── models.py              # UserGoal ORM
│   │   └── schemas.py
│   │
│   ├── weights/                   # Body weight tracking
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py              # BodyWeight ORM
│   │   └── schemas.py
│   │
│   ├── stats/                     # Day/range statistics
│   │   ├── router.py
│   │   ├── service.py             # Aggregation queries
│   │   ├── calculation.py         # Calorie/macro math
│   │   └── schemas.py             # No model (reads from other features)
│   │
│   ├── catalog/                   # USDA catalog products
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py              # CatalogProduct + CatalogPortion
│   │   └── schemas.py
│   │
│   ├── sync/                      # Cursor-based sync
│   │   ├── router.py
│   │   └── schemas.py
│   │
│   └── data/                      # Bulk operations (reset)
│       ├── router.py
│       └── service.py
```

### Backend: Allowed Locations

Only two top-level directories are permitted under `backend/app/`:

| Directory | Purpose | Contains |
|-----------|---------|----------|
| `core/` | Shared infrastructure | DB, auth deps, enums, mixins, base schemas, rate limiter |
| `features/<domain>/` | Domain verticals | router.py, service.py, models.py, schemas.py, calculation.py |

**Files in `backend/app/` root**: only `main.py`, `settings.py`, `__init__.py`.

Any file outside `core/` or `features/` under `backend/app/` will be **blocked by hook**.

### Backend: Feature File Rules

Each feature folder contains **only these files** (all optional except `__init__.py`):

| File | Purpose | Contains |
|------|---------|----------|
| `__init__.py` | Package marker | Empty |
| `router.py` | HTTP endpoints | FastAPI router, Depends, response wiring. **No SQL, no business rules** |
| `service.py` | Business logic | SQLAlchemy queries, domain rules, validations |
| `models.py` | ORM models | SQLAlchemy mapped classes. **No Pydantic** |
| `schemas.py` | Request/response DTOs | Pydantic models. **No ORM** |
| `calculation.py` | Pure logic | Math, formulas, no DB access |

### Backend: Import Rules

| From | Can Import | Cannot Import |
|------|-----------|---------------|
| `features/X/router.py` | `core/*`, `features/X/service`, `features/X/schemas` | Other features' services directly |
| `features/X/service.py` | `core/*`, `features/X/models`, other `features/Y/models`, other `features/Y/service` | Routers |
| `features/X/models.py` | `core/db`, `core/mixins`, `core/enums` | Services, routers, schemas |
| `features/X/schemas.py` | `core/schemas`, `core/enums` | Models, services, routers |
| `core/*` | Other `core/*` modules | `features/*` (except `core/deps.py` → `features/auth/service`) |

### Backend: Placement Rules

| Code Type | Location | Never In |
|-----------|----------|----------|
| SQL queries | `features/X/service.py` | `router.py` (enforced by hook) |
| Business rules | `features/X/service.py` | `router.py`, `schemas.py` |
| Request/response DTOs | `features/X/schemas.py` | `models.py` |
| ORM models | `features/X/models.py` | `schemas.py` |
| Auth dependency | `core/deps.py` | Feature routers |
| DB engine/session | `core/db.py` | Feature files |
| Shared enums | `core/enums.py` | Feature files (import from core) |
| Pure calculations | `features/X/calculation.py` | `service.py` (keep separate) |

### Backend: Adding a New Feature

1. Create `app/features/<name>/` with `__init__.py`
2. Add `models.py` (import `Base` from `app.core.db`, `TimestampMixin` from `app.core.mixins`)
3. Add `schemas.py` (import `APIModel` from `app.core.schemas`)
4. Add `service.py` (import your models, use `AsyncSession`)
5. Add `router.py` (import from `app.core.db`, `app.core.deps`, your service/schemas)
6. Register router in `app/main.py`
7. Import models in `alembic/env.py` for autogenerate
8. Create Alembic migration

### Backend: BANNED Directories

These old directories no longer exist and must **never** be recreated:
- `app/api/` — replaced by `features/X/router.py`
- `app/db/` — replaced by `core/db.py`
- `app/models/` — replaced by `features/X/models.py`
- `app/schemas/` — replaced by `features/X/schemas.py`
- `app/services/` — replaced by `features/X/service.py`

Creating files in any of these will be **blocked by hook**.

---

## For Architects & Planners

When designing new features, your proposal **MUST specify**:

**Client:**
1. Which flow folder the screens belong to (new or existing)
2. For each new component: flow-specific (`screens/XxxFlow/components/`) or shared (`components/`)
3. Whether any existing flow-specific components should be promoted to shared

**Backend:**
1. Which feature folder the code belongs to (new `features/<name>/` or existing)
2. Which files are needed: router, service, models, schemas, calculation
3. Cross-feature imports required (which other features' models/services are used)
4. Whether new enums/mixins should go in `core/`

## For Reviewers

Flag these as review issues:

**Client:**
- **CRITICAL**: New directory in `client/src/` outside the 9 allowed
- **HIGH**: Component in `components/` only imported by 1 flow (should demote)
- **HIGH**: Component in `screens/XxxFlow/components/` imported by another flow (should promote)
- **HIGH**: New flow screens not inside a flow folder
- **MEDIUM**: Missing `components/` subfolder for flow-specific components (placed directly in flow root)

**Backend:**
- **CRITICAL**: File created in banned directory (`app/api/`, `app/db/`, `app/models/`, `app/schemas/`, `app/services/`)
- **CRITICAL**: SQL or business logic in `router.py`
- **HIGH**: New feature code not inside `features/<domain>/`
- **HIGH**: Feature-specific enum/mixin not in `core/` (shared) vs `features/X/` (feature-only)
- **HIGH**: Import from banned old path (`from app.models.*`, `from app.services.*`, etc.)
- **MEDIUM**: Missing `__init__.py` in new feature folder
- **MEDIUM**: Router not registered in `main.py`
- **LOW**: Feature models not imported in `alembic/env.py`
