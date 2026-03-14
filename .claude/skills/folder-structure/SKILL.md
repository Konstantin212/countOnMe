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

## Backend: Folder Structure

```
backend/app/
├── api/
│   ├── routers/   # Request/response wiring ONLY — no SQL, no business rules
│   └── deps.py    # Dependencies (auth, DB session, pagination)
├── db/            # Engine/session wiring only
├── models/        # SQLAlchemy ORM models only — no Pydantic here
├── schemas/       # Pydantic request/response only — no ORM here
└── services/      # Business logic + queries + domain rules
```

### Backend Placement Rules

| Code Type | Location | Never In |
|-----------|----------|----------|
| SQL queries | `services/` | `routers/` (enforced by hook) |
| Business rules | `services/` | `routers/`, `schemas/` |
| Request/response DTOs | `schemas/` | `models/` |
| ORM models | `models/` | `schemas/` |
| Auth logic | `services/auth.py` + `api/deps.py` | `routers/` |

## For Architects & Planners

When designing new features, your proposal **MUST specify**:
1. Which flow folder the screens belong to (new or existing)
2. For each new component: flow-specific (`screens/XxxFlow/components/`) or shared (`components/`)
3. Whether any existing flow-specific components should be promoted to shared

## For Reviewers

Flag these as review issues:
- **CRITICAL**: New directory in `client/src/` outside the 9 allowed
- **HIGH**: Component in `components/` only imported by 1 flow (should demote)
- **HIGH**: Component in `screens/XxxFlow/components/` imported by another flow (should promote)
- **HIGH**: New flow screens not inside a flow folder
- **MEDIUM**: Missing `components/` subfolder for flow-specific components (placed directly in flow root)
