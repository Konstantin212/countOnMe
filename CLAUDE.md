# CountOnMe — Claude Code Rules

## Product Overview

**CountOnMe** is a fast, offline-first calorie tracking app (Expo React Native + FastAPI backend). Manual tracking first, AI dish parsing later. No accounts, no cloud for basics.

### MVP Scope
- **Products**: Add/edit/delete/search products (name, kcal/100g)
- **Meals**: Create meals by selecting products + grams, auto-calc calories, save/view/edit meal history
- **Tech**: Offline persistence (AsyncStorage), no signup, no cloud

---

## Autonomous Workflow — Agent-Based Orchestration

Claude MUST follow these workflows automatically without being asked. Specialized agents live in `.claude/agents/` and slash commands in `.claude/commands/`.

### Available Agents

| Agent | Model | When to Use |
|-------|-------|-------------|
| `planner` | opus | Planning features, architectural changes (3+ files) |
| `verifier` | haiku | Running type check + lint + tests after changes |
| `tdd-guide` | sonnet | Implementing new logic with Red-Green-Refactor |
| `code-reviewer` | sonnet | Reviewing code quality, security, patterns |
| `build-fixer` | sonnet | Fixing build/type/lint errors incrementally |
| `refactor-cleaner` | sonnet | Finding and removing dead code |
| `security-reviewer` | sonnet | Security vulnerability scanning |
| `doc-writer` | haiku | Generating/updating feature docs in docs/ |

### Available Commands

| Command | Description |
|---------|-------------|
| `/plan` | Plan a feature before coding |
| `/verify` | Run full verification suite |
| `/tdd` | Implement with TDD workflow |
| `/review` | Review recent code changes |
| `/build-fix` | Fix build/type errors |
| `/refactor-clean` | Find and remove dead code |
| `/security` | Security audit |
| `/orchestrate` | Run multi-agent workflow (feature/bugfix/refactor) |
| `/doc` | Generate/update feature documentation |
| `/checkpoint` | Create named git checkpoint with SHA |
| `/lint-fix` | Auto-fix linting issues |
| `/format` | Auto-format code |

### When to Invoke Agents Automatically

#### Plan Before Code (Mandatory for Non-Trivial Tasks)

For any task touching 3+ files or adding a new feature:
1. Use **planner** agent to analyze and create a phased plan
2. Present plan and WAIT for user approval before writing code
3. Implement phase by phase
4. Use **verifier** agent after each phase

Skip planning only for: single-line fixes, typo corrections, simple renames.

#### Verify After Every Change

After writing or editing code, ALWAYS run the **verifier** agent:
- **Client changes**: `cd client && npx tsc --noEmit` (type check), then `npm test` if tests exist
- **Backend changes**: `cd backend && ruff check app/` (lint), then `pytest` if tests exist
- **Both**: Run both verification chains in parallel
- If verification fails, use **build-fixer** agent to resolve errors

#### TDD Cycle (Mandatory for New Logic)

When implementing new functions, hooks, or services, use the **tdd-guide** agent:
1. **RED** — Write a failing test first
2. **GREEN** — Write minimal code to pass
3. **REFACTOR** — Improve while tests stay green
4. Never write implementation before tests for business logic

#### Build Error Resolution

When a build or type check fails, use the **build-fixer** agent:
1. Parse and group errors by file
2. Fix one error at a time, starting with imports/types
3. Re-run check after each fix
4. Stop and ask user if a fix introduces MORE errors than it resolves
5. Stop and ask user if the same error persists after 3 attempts

#### Feature Workflow (Multi-Agent Orchestration)

For new features, follow this chain automatically:
1. **planner** → Create phased plan, get approval
2. **tdd-guide** → Implement each phase with tests first
3. **verifier** → Run full verification suite
4. **code-reviewer** → Check quality and patterns
5. **security-reviewer** → Scan for vulnerabilities (if auth/input/API involved)
6. **doc-writer** → Update or create documentation in docs/

### Subagent Delegation

Use parallel Task agents for independent operations:
- **Explore agent**: Codebase search across 3+ files or uncertain locations
- Launch independent agents in parallel (e.g., type-check client + lint backend simultaneously)
- Use `model: "haiku"` for simple searches and lightweight tasks to save context

### Context Window Management

- Be concise in tool outputs — avoid dumping entire files when a section suffices
- When context is getting large, prefer targeted reads (offset/limit) over full file reads
- For files >400 lines, read only the relevant section
- Proactively suggest `/compact` if conversation is getting long

### Hooks (Automatic Quality Gates)

Hook scripts live in `.claude/hooks/` and fire automatically:

**PostToolUse** (after Edit/Write):
- `post-edit-typecheck.js` — Runs `tsc --noEmit` after `.ts/.tsx` edits, reports errors in edited file
- `post-edit-lint-python.js` — Runs `ruff check` after `.py` edits, reports errors
- `post-edit-console-warn.js` — Warns if `console.log` introduced in `.ts/.tsx`
- `post-edit-format.js` — Runs `prettier --write` after `.ts/.tsx/.js/.jsx` edits

**PreToolUse** (before tool execution):
- `block-random-md.js` — Blocks `.md` creation outside `docs/`, `README.md`, `CLAUDE.md`, `.claude/`
- `git-push-warn.js` — Escalates `git push` to user, blocks `--force` push
- `suggest-compact.js` — Suggests `/compact` after 50+ tool calls

**Stop** (after each response):
- `check-console-log.js` — Scans recently modified `.ts/.tsx` files for `console.log`

---

## Tech Stack

### Client (mobile)
- Expo 54 / React Native 0.81
- React 19.1 + TypeScript 5.9 (strict mode)
- React Navigation (bottom tabs, native stack)
- React Hook Form + Zod (forms/validation)
- AsyncStorage (local persistence)
- UUID (device identity)
- Vitest (testing)

### Backend
- Python 3.11+ / FastAPI 0.115 + Uvicorn
- SQLAlchemy 2.0 (async ORM) + asyncpg/psycopg (PostgreSQL)
- Alembic (migrations)
- Pydantic Settings (config)
- Passlib/bcrypt (token hashing)
- Docker Compose (local dev)
- Ruff (linting) / Pytest + pytest-asyncio (testing)

### Database
- PostgreSQL (via Docker Compose locally)

### Quick Commands
- **Client type check**: `cd client && npm run type-check`
- **Client tests**: `cd client && npm test`
- **Client tests (watch)**: `cd client && npm run test:watch`
- **Client tests (coverage)**: `cd client && npm run test:coverage`
- **Client lint**: `cd client && npm run lint`
- **Client lint fix**: `cd client && npm run lint:fix`
- **Client format**: `cd client && npm run format`
- **Client verify**: `cd client && npm run verify`
- **Backend lint**: `cd backend && ruff check app/`
- **Backend lint fix**: `cd backend && ruff check app/ --fix`
- **Backend tests**: `cd backend && pytest --cov=app --cov-report=term-missing`
- **Backend format**: `cd backend && ruff format app/`
- **Full verify**: Run client verify + backend lint + backend tests

---

## Architecture

### Core Principles
- **Offline-first**: no backend needed for MVP
- **Separation of concerns**: UI ≠ state ≠ storage ≠ pure business logic
- **Incremental complexity**: start simple (AsyncStorage), migrate to SQLite only if needed
- **AI as a layer** later, not part of core domain
- **Anonymous Device Auth**: No user accounts; device_id + token for sync
- **Push-Only Sync**: Client enqueues mutations, flushes when online (planned)
- **Soft Deletes**: All entities use `deleted_at` for data recovery
- **Device Scoping**: All data scoped to device_id; no cross-device access

### Folder Structure

```
client/src/
├── app/           # Navigation setup
├── components/    # Shared UI components (molecules)
├── hooks/         # Custom React hooks (state + side effects)
├── models/        # TypeScript types
├── particles/     # Atomic UI primitives (atoms)
├── screens/       # Screen components (organisms)
├── services/      # API, utils, schemas, constants
├── storage/       # AsyncStorage + device identity
└── theme/         # Colors, theming

backend/app/
├── api/           # Routers + dependencies
│   └── routers/   # Request/response wiring only
├── db/            # Engine/session wiring
├── models/        # SQLAlchemy ORM models
├── schemas/       # Pydantic request/response
└── services/      # Business logic
```

### Import Aliases (client/src)
Use configured aliases instead of relative paths:
- `@app` → `src/app`
- `@components` → `src/components`
- `@hooks` → `src/hooks`
- `@models` → `src/models`
- `@particles` → `src/particles`
- `@screens` → `src/screens`
- `@services` → `src/services`
- `@storage` → `src/storage`
- `@theme` → `src/theme`

Configured in `tsconfig.json`, `babel.config.js`, and `vitest.config.ts`. Prefer aliases for cross-folder imports; relative imports are fine within the same folder.

---

## Frontend Rules

### TypeScript Standards
- Always use strict TypeScript (`strict: true`)
- Prefer explicit types over `any`. Use `unknown` when type is truly unknown
- Define interfaces/types in `models/types.ts` for shared domain models
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safe access
- Never use `!` (non-null assertion) unless absolutely necessary
- Never use `as` type assertions unless absolutely necessary
- Never use `@ts-ignore`; use `@ts-expect-error` with explanation if needed

### React Patterns
- Functional components only (no class components)
- Keep components small and focused on a single responsibility
- Extract reusable logic into custom hooks
- Prefer composition over complex prop drilling
- Custom hooks (`hooks/`) own state and side effects; return objects with action-oriented method names
- Never expose raw state setters from hooks
- Use `useMemo`/`useCallback` only when performance is proven to be an issue
- Always handle loading and error states in hooks
- Use TypeScript interfaces for props, destructure at function signature
- Use `FlatList`/`SectionList` for long lists, not `map()` with `ScrollView`

### Naming Conventions
- **Files**: PascalCase for components (`ProductFormScreen.tsx`), camelCase for utilities (`calories.ts`)
- **Hooks**: Always prefix with `use` (`useProducts.ts`)
- **Variables**: camelCase (`productName`, `totalCalories`)
- **Functions**: camelCase, verb-based (`calculateCalories`, `saveProduct`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_PRODUCTS`, `STORAGE_KEYS`)
- **Booleans**: Prefix with `is`, `has`, `should` (`isLoading`, `hasError`)
- **Types/Interfaces**: PascalCase, `Props` suffix for component props
- **Event handlers**: `handle` prefix for UI handlers, `on` prefix for callback props

### Import Order
1. React and React Native imports
2. Third-party libraries
3. Internal imports (hooks, services, models, components)
4. Types (if separate)
5. Relative imports (use sparingly)

### Styling & Theme
- Use `StyleSheet.create` for styles (no inline styles)
- Prefer theme values over hardcoded colors; use `useTheme()` to pull `colors`
- `LightTheme`/`DarkTheme` in `client/src/theme/colors.ts` is the single source of truth
- Do not import from `colors.ts` directly in screens/components; consume from context
- New theme keys must be added to both themes and update TypeScript types
- Theme flows through `ThemeContext` with `ThemeMode` (`light | dark | system`)
- Every visual element must render legibly in both themes; verify contrast
- Keep status/semantic colors mapped to existing tokens (`success`, `error`, `warning`, `info`)

### Atomic Components (Particles)
- Reusable UI lives in `client/src/particles/`: FormField, Input, NumericInput, RadioGroup, SwitchField, Button, Typography (Label, ErrorText, SectionTitle, Subtitle)
- Use particles for ALL forms to keep screens lean and consistent
- Import from `'../particles'` barrel export
- Particles must be theme-aware, small, focused, and contain no business logic
- Extend by adding new particles and exporting from `particles/index.ts`

### State Management
- Hooks own state. Screens never talk to AsyncStorage directly
- Hooks use a storage repository (`loadX/saveX`) so persistence is swappable
- Never store derived data in state (calculate on the fly)
- Never mutate state directly; use functional updates: `setProducts(prev => [...prev, newProduct])`
- All calorie calculations must go through `calcMealCalories()` in utils

### Navigation
- Bottom Tabs: `Products`, `Meals`
- Products stack: ProductsList → ProductForm (add/edit)
- Meals stack: MealsList → MealBuilder (add/edit) → MealDetails
- Param lists must be typed for safety

### Validation
- UI validates inputs before calling hook
- Hooks must still be defensive (no crashes on bad numbers, missing product IDs skipped)

---

## Backend Rules

### Folder Responsibilities (strict)
- **`app/api/routers/`**: Request/response wiring only. Parse inputs (Pydantic), call services, return DTOs. No raw SQL, no business rules
- **`app/api/deps.py`**: Dependencies (auth, DB session, pagination)
- **`app/models/`**: SQLAlchemy ORM models only. No Pydantic schemas
- **`app/schemas/`**: Pydantic request/response models only. One file per domain area
- **`app/services/`**: Business logic + calculations + query orchestration. Enforce domain rules here
- **`app/db/`**: Engine/session wiring only

### Data Access Rule
- **Routers never run SQL**
- Services query using SQLAlchemy Core/ORM
- Aggregation queries go in `app/services/stats.py`

### FastAPI Conventions
- All API routes under `/v1`
- Use `APIRouter(prefix="/v1", tags=[...])` per router
- Provide a `/health` route (may be unversioned)
- Status codes: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found (including cross-device), 409 conflict

### Auth Model (Anonymous Device Token)
- Every protected request must resolve a `device_id`
- Store only a **hash** of `device_token` (never raw token)
- Update `devices.last_seen_at` on successful auth
- Auth logic centralized in `app/services/auth.py` + `app/api/deps.py`
- Routers depend on `device_id` via dependency, not parse headers manually

### SQLAlchemy (Async)
- Single `AsyncSession` dependency per request; do not create sessions in services
- Multi-step updates must be wrapped in transaction: `async with session.begin(): ...`
- Use SQLAlchemy 2.0 style: `select(...)`, `update(...)`
- Never use string SQL unless necessary; keep parameterized if used
- Soft deletes: use `deleted_at`, filter out by default in services

### Domain Rules
- **Device scoping**: Every row scoped by `device_id` directly or through parent. Cross-device access returns 404
- **Product portions**: Exactly one `is_default=true` per product; clear previous default in same transaction
- **Food entries**: `amount > 0` always; `portion_id` must belong to `product_id` and same device; `date` is client-local day

### Migrations (Alembic)
- Update ORM model(s) first, then `alembic revision --autogenerate -m "..."`
- Always review autogenerated migrations (renames, enums, server defaults, indexes)
- Adding non-null columns: 1) add nullable, 2) backfill, 3) set NOT NULL
- Enums: adding values requires explicit `ALTER TYPE ... ADD VALUE` (hand-written)

### Python Standards
- Use `ruff` for linting/formatting
- Type hints everywhere (including return types for public functions)
- No `print()` — use `logging` with structured fields
- Never block the event loop; use async DB calls only
- Functions do one thing; keep services small
- Use explicit names (`create_food_entry`, `list_products`, `get_day_stats`)
- Prefer immutable data structures (frozen dataclasses, NamedTuple)
- Follow PEP 8

---

## Common Rules

### Immutability (Critical)
Always create new objects, NEVER mutate existing ones. Immutable data prevents hidden side effects and enables safe concurrency.

### File Organization
- Many small files > few large files
- 200-400 lines typical, 800 max
- Extract utilities from large modules
- Organize by feature/domain, not by type

### Error Handling
- Handle errors explicitly at every level
- Provide user-friendly error messages in UI-facing code
- Log detailed error context server-side
- Never silently swallow errors
- Always use try/catch for async operations

### Input Validation
- Validate all user input at system boundaries
- Use schema-based validation where available (Zod frontend, Pydantic backend)
- Fail fast with clear error messages
- Never trust external data

### Security
- NEVER hardcode secrets in source code
- ALWAYS use environment variables or secret manager
- Validate required secrets at startup
- No hardcoded secrets (API keys, passwords, tokens)
- SQL injection prevention (parameterized queries)
- XSS prevention (sanitized HTML)
- Error messages must not leak sensitive data
- Use `bandit` for Python static security analysis

### Git Workflow
- Commit format: `<type>: <description>` (types: feat, fix, refactor, docs, test, chore, perf, ci)
- Feature workflow: Plan first → TDD approach → Code review → Commit
- NEVER commit without running verification first
- NEVER push without explicit user request

### Testing
- Minimum test coverage: 80%
- TDD workflow: Write test (RED) → Run (FAIL) → Implement (GREEN) → Run (PASS) → Refactor (IMPROVE) → Verify coverage
- Frontend: Vitest — `cd client && npm test`
- Backend: Pytest — `cd backend && pytest --cov=app --cov-report=term-missing`
- Use `pytest.mark` for categorization (unit, integration)
- Test device scoping (A cannot read B's data)

### Refactoring & Dead Code Cleanup

When refactoring or cleaning up code:
1. Run full test suite first — establish green baseline
2. Delete one item at a time
3. Re-run tests after each deletion
4. If tests fail, revert immediately with `git checkout -- <file>`
5. Never refactor and clean in the same pass — separate concerns

### Code Quality Checklist

Before marking any task complete, verify:
- [ ] Code is readable and well-named
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No hardcoded values (use constants or config)
- [ ] No mutation (immutable patterns used)
- [ ] Types are explicit (no `any` without justification)
- [ ] No console.logs in production code
- [ ] No unused imports or variables
- [ ] Type check passes (`tsc --noEmit` / `ruff check`)
- [ ] Existing tests still pass
