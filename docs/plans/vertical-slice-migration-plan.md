---
type: plan
status: completed
created: 2026-03-14
---

# Backend Vertical Slice Migration Plan

## Main Idea

The backend currently uses a **flat layer-based structure**: all routers in `api/routers/`, all services in `services/`, all models in `models/`, all schemas in `schemas/`. To find everything related to "products" you must open 4 different folders. Adding a new feature means touching 4+ directories. Deleting a feature means hunting across the entire tree.

We migrate to a **feature-based vertical slice structure** where each domain area (products, portions, meals, goals, etc.) owns all its layers in a single folder. Shared infrastructure (DB, auth deps, enums, mixins) lives in `core/`.

### Why This Pattern

| Concern | Flat layers (current) | Vertical slices (target) |
|---------|----------------------|--------------------------|
| Find all product code | Open 4 folders | Open 1 folder |
| Add a new feature | Create files in 4+ dirs | Create 1 folder |
| Delete a feature | Hunt across 4 dirs | Delete 1 folder |
| Cross-feature coupling | Invisible | Explicit cross-boundary import |
| Cognitive load | Jump between layers | Stay in one context |

This is the standard in FastAPI large-app docs, Django (apps), NestJS (modules), and Go (packages). It scales better and makes the codebase navigable at a glance.

### What Changes

- **Structure** changes (files move, imports update)
- **Zero logic changes** -- no behavior, no API, no DB, no tests rewritten
- Every phase is independently verifiable (tests pass after each)

---

## Target Structure

```
backend/app/
├── main.py                        # Router aggregation (updated imports)
├── settings.py                    # Unchanged
│
├── core/                          # Shared infrastructure
│   ├── __init__.py
│   ├── db.py                      # Base + engine + session (merged from db/)
│   ├── deps.py                    # Auth dependency, get_session
│   ├── mixins.py                  # TimestampMixin
│   ├── schemas.py                 # APIModel, DeviceScoped, Timestamps
│   ├── enums.py                   # Unit, MealType, GoalType, etc.
│   └── rate_limit.py              # Sliding-window rate limiter
│
├── features/
│   ├── __init__.py
│   ├── auth/                      # Device registration + token auth
│   │   ├── __init__.py
│   │   ├── router.py              # POST /register
│   │   ├── service.py             # Token gen/verify/hash
│   │   ├── models.py              # Device ORM
│   │   └── schemas.py             # DeviceRegisterRequest/Response
│   │
│   ├── products/                  # Product CRUD + search
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py              # Product ORM
│   │   └── schemas.py
│   │
│   ├── portions/                  # Product portion management
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── service.py             # Default portion logic
│   │   ├── models.py              # ProductPortion ORM
│   │   └── schemas.py
│   │
│   ├── meals/                     # Food entries (renamed from food_entries)
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py              # FoodEntry ORM
│   │   └── schemas.py
│   │
│   ├── goals/                     # Nutrition goals (calculated + manual)
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── service.py             # CRUD + orchestration
│   │   ├── calculation.py         # BMR, TDEE, macros (pure logic)
│   │   ├── models.py              # UserGoal ORM
│   │   └── schemas.py
│   │
│   ├── weights/                   # Body weight tracking
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py              # BodyWeight ORM
│   │   └── schemas.py
│   │
│   ├── stats/                     # Day/range statistics
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── service.py             # Aggregation queries
│   │   ├── calculation.py         # Calorie/macro math
│   │   └── schemas.py             # No model (reads from other features)
│   │
│   ├── catalog/                   # USDA catalog products
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py              # CatalogProduct + CatalogPortion (merged)
│   │   └── schemas.py
│   │
│   ├── sync/                      # Cursor-based sync
│   │   ├── __init__.py
│   │   ├── router.py
│   │   └── schemas.py
│   │
│   └── data/                      # Bulk operations (reset)
│       ├── __init__.py
│       ├── router.py
│       └── service.py
```

---

## Acceptance Criteria

- [ ] All app files live under `app/core/` or `app/features/<domain>/`
- [ ] Old directories deleted: `app/api/`, `app/db/`, `app/models/`, `app/schemas/`, `app/services/`
- [ ] Zero old-path imports remain: `grep -r "from app\.(api|db|models|schemas|services)\." backend/app/` returns nothing
- [ ] `ruff check app/` passes with zero errors
- [ ] `pytest --cov=app --cov-report=term-missing` passes, all tests green, coverage >= 80%
- [ ] No logic changes -- diff contains only file moves and import rewrites
- [ ] `alembic` can still detect model changes (env.py updated)
- [ ] Each phase was verified independently before proceeding to the next

---

## Rules

### R1: Zero Logic Changes
This is a pure structural refactor. No function bodies change. No new features. No bug fixes. No "while we're here" improvements. If a file's logic needs fixing, that's a separate PR.

### R2: One Phase at a Time
Complete a phase fully, verify it passes (`ruff check` + `pytest`), then move to the next. Never start Phase N+1 until Phase N is green.

### R3: Shim-First Migration
When moving a file to its new location, leave a **re-export shim** at the old path:
```python
# old path: app/models/product.py (becomes a shim)
from app.features.products.models import Product  # noqa: F401
```
This keeps all existing imports working. Shims are removed only in the final cleanup phase after all consumers are updated.

### R4: New Files Import From New Paths
Files created in `app/features/` and `app/core/` must import from other `app/features/` or `app/core/` paths -- never from old `app/models/`, `app/services/`, etc. The only exception is Phase 0 `core/deps.py` which temporarily imports from `app/services/auth` until auth is moved in Phase 1.

### R5: Update main.py Per Phase
When a router moves, update `main.py` to import from the new `app/features/<domain>/router.py` path in the same phase. Don't defer router registration updates.

### R6: Cross-Feature Imports Are Allowed
Features may import from other features (e.g., `portions/service` imports `get_product` from `products/service`). This is expected and acceptable. The goal is domain cohesion, not isolation.

### R7: Verify Before Proceeding
After every phase:
```bash
cd backend && ruff check app/ && pytest --cov=app --cov-report=term-missing
```
If either fails, fix before moving on. Never accumulate broken state across phases.

### R8: Shim Removal Is Atomic
All shims are removed in a single phase (Phase 13) after all test imports are updated (Phase 12). Never remove a shim while any consumer still references the old path.

---

## Cross-Feature Import Map

These cross-feature dependencies exist and must be preserved during migration:

| Consumer | Depends On | Import |
|----------|-----------|--------|
| `portions/service` | `products/service` | `get_product` |
| `meals/service` | `products/service` | `get_product` |
| `meals/service` | `portions/models` | `ProductPortion` |
| `stats/service` | `meals/models` | `FoodEntry` |
| `stats/service` | `portions/models` | `ProductPortion` |
| `stats/service` | `stats/calculation` | `MacroTotals`, `calc_totals_for_entry` |
| `stats/router` | `weights/service` | `list_body_weights` |
| `goals/service` | `goals/calculation` | `calculate_full_goal` |
| `goals/router` | `goals/calculation` | `calculate_full_goal` |
| `sync/router` | `products/models`, `portions/models`, `meals/models` | ORM models |
| `data/service` | `meals/models` | `FoodEntry` |
| `products/service` | `catalog/models` | `CatalogProduct`, `CatalogPortion` |
| All routers | `core/deps` | `get_current_device_id` |
| All routers | `core/db` | `get_session` |
| All models | `core/db` | `Base` |
| All models | `core/mixins` | `TimestampMixin` |
| Several models/schemas | `core/enums` | `Unit`, `MealType`, etc. |
| All schemas | `core/schemas` | `APIModel` |

---

## Migration Phases

### Phase 0: Core Module (Foundation)

Create `app/core/` with shared infrastructure that all features depend on.

**Create new files:**
1. `app/core/__init__.py` -- empty
2. `app/core/db.py` -- merge `db/base.py` + `db/engine.py` + `db/session.py` into one file containing: `Base`, `create_engine`, `engine`, `SessionLocal`, `get_session`
3. `app/core/mixins.py` -- copy from `app/models/mixins.py`
4. `app/core/schemas.py` -- copy from `app/schemas/common.py` (`APIModel`, `DeviceScoped`, `Timestamps`)
5. `app/core/enums.py` -- copy from `app/schemas/enums.py`
6. `app/core/deps.py` -- copy from `app/api/deps.py`, update `get_session` import to `app.core.db`; keep `app.services.auth` import temporarily (auth not moved yet)
7. `app/core/rate_limit.py` -- copy from `app/api/rate_limit.py`

**Replace old files with shims:**
- `app/db/base.py` -> re-export `Base` from `app.core.db`
- `app/db/engine.py` -> re-export `engine`, `create_engine` from `app.core.db`
- `app/db/session.py` -> re-export `SessionLocal`, `get_session` from `app.core.db`
- `app/models/mixins.py` -> re-export from `app.core.mixins`
- `app/schemas/common.py` -> re-export from `app.core.schemas`
- `app/schemas/enums.py` -> re-export from `app.core.enums`
- `app/api/deps.py` -> re-export from `app.core.deps`
- `app/api/rate_limit.py` -> re-export from `app.core.rate_limit`

**Verify:** `ruff check app/ && pytest`

---

### Phase 1: Auth Feature

**Move:** `routers/devices.py`, `services/auth.py`, `models/device.py`, `schemas/device.py` -> `features/auth/`

**Create:** `router.py`, `service.py`, `models.py`, `schemas.py` with imports pointing to `app.core.*`

**Shims:** Old files re-export from `app.features.auth.*`

**Also update:**
- `app/core/deps.py`: change auth imports to `app.features.auth.service`
- `app/main.py`: update devices router import

**Verify:** `ruff check app/ && pytest`

---

### Phase 2: Products Feature

**Move:** `routers/products.py`, `services/products.py`, `models/product.py`, `schemas/product.py` -> `features/products/`

**Note:** `products/service.py` imports from `catalog/models` which isn't moved yet -- keep old import path temporarily (shim covers it).

**Shims:** Old files re-export from `app.features.products.*`

**Also update:** `app/main.py`

**Verify:** `ruff check app/ && pytest`

---

### Phase 3: Portions Feature

**Move:** `routers/portions.py`, `services/portions.py`, `models/product_portion.py`, `schemas/portion.py` -> `features/portions/`

**Cross-feature:** `portions/service.py` imports `get_product` from `app.features.products.service`

**Shims + main.py update.**

**Verify:** `ruff check app/ && pytest`

---

### Phase 4: Meals Feature

**Move:** `routers/food_entries.py`, `services/food_entries.py`, `models/food_entry.py`, `schemas/food_entry.py` -> `features/meals/`

**Cross-feature:** `meals/service.py` imports from `products/service` and `portions/models`

**Shims + main.py update.**

**Verify:** `ruff check app/ && pytest`

---

### Phase 5: Goals Feature

**Move:** `routers/goals.py`, `services/goals.py`, `services/goal_calculation.py`, `models/user_goal.py`, `schemas/goal.py` -> `features/goals/`

**Note:** `goal_calculation.py` becomes `features/goals/calculation.py`

**Shims + main.py update.**

**Verify:** `ruff check app/ && pytest`

---

### Phase 6: Weights Feature

**Move:** `routers/weights.py`, `services/weights.py`, `models/body_weight.py`, `schemas/weight.py` -> `features/weights/`

**Shims + main.py update.**

**Verify:** `ruff check app/ && pytest`

---

### Phase 7: Stats Feature

**Move:** `routers/stats.py`, `services/stats.py`, `services/calculation.py`, `schemas/stats.py` -> `features/stats/`

**Note:** `calculation.py` becomes `features/stats/calculation.py`

**Cross-feature:** imports from `meals/models`, `portions/models`, `weights/service`

**Shims + main.py update.**

**Verify:** `ruff check app/ && pytest`

---

### Phase 8: Catalog Feature

**Move:** `routers/catalog.py`, `services/catalog.py`, `models/catalog_product.py` + `models/catalog_portion.py`, `schemas/catalog.py` -> `features/catalog/`

**Note:** Merge `catalog_product.py` + `catalog_portion.py` into single `features/catalog/models.py`. Remove TYPE_CHECKING guards (both classes now in same file).

**Also update:** `app/features/products/service.py` -- change catalog imports to `app.features.catalog.models`

**Shims + main.py update.**

**Verify:** `ruff check app/ && pytest`

---

### Phase 9: Sync Feature

**Move:** `routers/sync.py`, `schemas/sync.py` -> `features/sync/`

**Cross-feature:** router imports ORM models from `products`, `portions`, `meals`

**Shims + main.py update.**

**Verify:** `ruff check app/ && pytest`

---

### Phase 10: Data Feature

**Move:** `routers/data.py`, `services/data.py` -> `features/data/`

**Shims + main.py update.**

**Verify:** `ruff check app/ && pytest`

---

### Phase 11: Update Alembic

Update `alembic/env.py`:
- `from app.db.base import Base` -> `from app.core.db import Base`
- Import all feature models for metadata registration:
  ```python
  from app.features.auth import models as _auth  # noqa: F401
  from app.features.products import models as _products  # noqa: F401
  from app.features.portions import models as _portions  # noqa: F401
  from app.features.meals import models as _meals  # noqa: F401
  from app.features.goals import models as _goals  # noqa: F401
  from app.features.weights import models as _weights  # noqa: F401
  from app.features.catalog import models as _catalog  # noqa: F401
  ```

**Verify:** `ruff check alembic/ && pytest`

---

### Phase 12: Bulk Test Import Rewrite

Update all test files to import from canonical `app.core.*` and `app.features.*` paths. Shims still exist at this point, so if anything is missed it won't break.

**Files to update:**
- `tests/conftest.py` -- model imports to `app.features.*.models`, auth to `app.features.auth.service`, db to `app.core.db`
- `tests/factories.py` -- same model/service/enum updates
- Each test file in `tests/api/` and `tests/services/` and `tests/schemas/` -- update imports per the cross-feature map

**Key concern:** `conftest.py` uses `app.dependency_overrides[get_session]` -- the `get_session` function identity must match what routers resolve. Since all routers import from `app.core.db`, importing `get_session` from `app.core.db` in conftest is correct.

**Verify:** `ruff check app/ && pytest --cov=app --cov-report=term-missing`

---

### Phase 13: Remove Shims and Old Directories

**Delete all shim files** (old files that now just re-export):
- `app/db/` -- `base.py`, `engine.py`, `session.py`, `__init__.py`
- `app/models/` -- all `.py` files + `__init__.py`
- `app/schemas/` -- all `.py` files + `__init__.py`
- `app/services/` -- all `.py` files + `__init__.py`
- `app/api/` -- `deps.py`, `rate_limit.py`, all `routers/*.py`, `__init__.py`s

**Delete empty directories:** `app/db/`, `app/models/`, `app/schemas/`, `app/services/`, `app/api/`

**Verify no stale imports:**
```bash
grep -r "from app\.db\." backend/
grep -r "from app\.models\." backend/
grep -r "from app\.schemas\." backend/
grep -r "from app\.services\." backend/
grep -r "from app\.api\." backend/
```
All should return empty.

**Verify:** `ruff check app/ && pytest --cov=app --cov-report=term-missing`

---

### Phase 14: Relocate Tests (Optional -- Separate PR)

Move tests from `tests/api/`, `tests/services/`, `tests/schemas/` to feature-aligned `tests/<feature>/` directories. This is cosmetic and doesn't affect correctness. Recommended to defer to a separate PR.

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Circular imports when merging catalog models | Medium | Both classes use TYPE_CHECKING guards; in same file, replace with direct references |
| `conftest.py` dependency override key mismatch | Medium | Verified: `get_session` identity preserved when imported from `app.core.db` |
| Alembic can't find models after shim removal | Medium | Phase 11 updates env.py before Phase 13 removes shims |
| Coverage drop from shim files | Low | Shims removed in Phase 13; `source = ["app"]` covers `features/` |
| Ruff import sorting after rewrites | Low | Run `ruff check --fix` per phase |
| Merge conflicts with parallel backend work | Medium | Do migration in single branch; freeze other backend PRs |

---

## Decisions

**Shim approach over big-bang**: Each phase leaves re-export shims at old paths so tests pass without modification until Phase 12. Lower risk per phase vs. updating all consumers immediately.

**Merge catalog models**: `catalog_product.py` + `catalog_portion.py` become one `features/catalog/models.py`. They're tightly coupled and always used together.

**Rename food_entries to meals**: The domain term is "meals" -- the folder name should match the concept, not the DB table.

**Defer test relocation**: Moving test files to `tests/<feature>/` is cosmetic. Keep it as a separate follow-up PR to minimize this migration's diff.
