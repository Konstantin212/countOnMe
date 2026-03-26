---
type: plan
status: draft
last-updated: 2026-03-26
related-features:
  - shared-data-domain
  - supabase-migration
  - moderation
---

# Implementation Plan: Phase 8 -- Moderation and Abuse Controls for Shared Content

## Overview

Add community safety infrastructure for the shared foods domain: content reports (with reason + free text), user blocks (bidirectional content hiding), publish rate limiting (per-user, not just per-IP), admin moderation endpoints (approve/reject with reason), and an `is_admin` flag on users. Backend-only for Phases 1-4; Phase 5 adds lightweight client UI (report/block buttons and a confirmation dialog).

## Success Criteria

- [ ] `content_reports` table stores user reports with reason enum, optional detail text, and resolved_at/resolved_by fields
- [ ] `user_blocks` table stores directional blocks (blocker_user_id, blocked_user_id) with unique constraint
- [ ] `is_admin` boolean column on `users` table (default false), with corresponding migration
- [ ] `ReportReason` enum in `app/core/enums.py` (inaccurate, spam, offensive, other)
- [ ] Users can report a shared food (POST) -- idempotent (one active report per reporter per target)
- [ ] Users can block another user (POST) -- idempotent; unblock via DELETE
- [ ] Blocked users' shared foods are excluded from search results and get-by-ID responses
- [ ] Reported shared foods (>= N reports, configurable) are auto-hidden from search until admin review
- [ ] Publish rate limit: max 10 publishes per hour per user (configurable)
- [ ] Admin endpoints: list pending reports, approve/reject shared food, dismiss report
- [ ] Admin guard dependency: raises 403 if `user.is_admin` is False
- [ ] All new service functions have unit tests; all new endpoints have integration tests
- [ ] `ruff check` and `pytest` pass with no regressions
- [ ] Client: report and block actions available from shared food detail view (Phase 5, if approved)

## Assumptions

- **Phase 4 (shared foods) is fully implemented** -- validated by reading `backend/app/features/shared/` (models, service, router, schemas all exist with full CRUD + search + publish + import)
- **Auth Phase 3 is complete** -- all endpoints use `get_current_user_id` (validated by reading `app/core/deps.py`)
- **No `is_admin` column exists** -- validated by grepping for `is_admin` across the backend (zero hits)
- **Latest migration is `0017_water_logs`** -- validated by reading alembic versions directory
- **The existing `RateLimiter` is IP-based** -- the publish rate limit needs user-based keying (a new class or parameterized key extractor)
- **No client-side shared food UI exists yet** -- validated by grepping for "shared" in client src (no hits in screens/hooks). Client UI for Phase 5 will be minimal (report/block buttons, no admin panel)
- **Moderation actions are backend-only for now** -- no admin web dashboard; admin uses curl/httpie or a future admin panel
- **`content_reports` target shared foods only** (not catalog products or private data)
- **Auto-hide threshold is configurable** -- default 3 reports triggers auto-hide (set `moderation_status = pending`)

## Architecture Changes

- New `ReportReason` enum in `backend/app/core/enums.py`
- New `ContentReport` and `UserBlock` models in `backend/app/features/shared/models.py` (colocated with SharedFood since reports target shared content)
- New `is_admin` column on `User` model in `backend/app/features/auth/models.py`
- New admin guard dependency in `backend/app/core/deps.py`
- New `UserBasedRateLimiter` in `backend/app/core/rate_limit.py` (keyed by user_id instead of IP)
- New `backend/app/features/moderation/` feature directory with service, router, schemas
- New Alembic migration: `0018_moderation_tables`
- Extend shared food search service to filter out blocked users' content
- Register new router in `backend/app/main.py`

## Files Affected

### New Files

- `backend/app/features/moderation/__init__.py` -- Empty package init
- `backend/app/features/moderation/models.py` -- ContentReport and UserBlock ORM models
- `backend/app/features/moderation/schemas.py` -- Pydantic request/response schemas for reports, blocks, admin actions
- `backend/app/features/moderation/service.py` -- Business logic for reports, blocks, admin review
- `backend/app/features/moderation/router.py` -- User-facing report/block endpoints + admin endpoints
- `backend/alembic/versions/0018_moderation_tables.py` -- Migration: is_admin column, content_reports table, user_blocks table, report_reason enum
- `backend/tests/services/test_moderation_db.py` -- Service unit tests
- `backend/tests/api/test_moderation_api.py` -- Router integration tests

### Modified Files

- `backend/app/core/enums.py` -- Add `ReportReason` enum
- `backend/app/core/deps.py` -- Add `require_admin` dependency
- `backend/app/core/rate_limit.py` -- Add `UserBasedRateLimiter` class and `publish_rate_limiter` instance
- `backend/app/features/auth/models.py` -- Add `is_admin` column to User model
- `backend/app/features/shared/service.py` -- Modify `search_shared_foods` to accept `exclude_owner_ids` param for block filtering
- `backend/app/features/shared/router.py` -- Pass blocked user IDs to search; add rate limit dependency to publish endpoint
- `backend/app/main.py` -- Register moderation router
- `backend/alembic/env.py` -- Import moderation models
- `backend/tests/conftest.py` -- Import new models; add report_reason_enum creation SQL
- `backend/tests/factories.py` -- Add `create_content_report()` and `create_user_block()` factories

## Implementation Steps

### Phase 1: Enums + Models + Migration (Data Layer)
Estimate: 6 files new/modified

1. **Add ReportReason enum** (`backend/app/core/enums.py`)
   - Action: Add a new StrEnum class at the bottom of the file
   - Values: `inaccurate`, `spam`, `offensive`, `other`
   - Why: Reports need a structured reason so admins can prioritize
   - Dependencies: None
   - Risk: Low
   - Test: `ruff check app/core/enums.py`

2. **Add `is_admin` to User model** (`backend/app/features/auth/models.py`)
   - Action: Add `is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")` after the `email` field
   - Import `Boolean` from sqlalchemy
   - Why: Admin endpoints need a flag to gate access; simpler than a role-based system for a small team
   - Dependencies: None
   - Risk: Low -- adding a nullable=False column with server_default is safe
   - Test: Model imports correctly

3. **Create moderation models** (`backend/app/features/moderation/models.py`)
   - Action: Create two ORM classes:
   - **ContentReport**:
     - `id` (UUID PK, server_default gen_random_uuid)
     - `reporter_user_id` (UUID NOT NULL, FK users.id ON DELETE CASCADE, indexed)
     - `target_shared_food_id` (UUID NOT NULL, FK shared_foods.id ON DELETE CASCADE, indexed)
     - `reason` (Enum(ReportReason), NOT NULL)
     - `detail` (Text, nullable, max 2000 chars enforced at schema level)
     - `created_at` (timestamptz, server_default now)
     - `resolved_at` (timestamptz, nullable)
     - `resolved_by_user_id` (UUID, nullable, FK users.id ON DELETE SET NULL)
     - `resolution_note` (Text, nullable)
     - UniqueConstraint on `(reporter_user_id, target_shared_food_id)` named `uq_report_per_user_per_target` -- ensures idempotent reporting (one active report per user per food)
   - **UserBlock**:
     - `id` (UUID PK, server_default gen_random_uuid)
     - `blocker_user_id` (UUID NOT NULL, FK users.id ON DELETE CASCADE, indexed)
     - `blocked_user_id` (UUID NOT NULL, FK users.id ON DELETE CASCADE, indexed)
     - `created_at` (timestamptz, server_default now)
     - UniqueConstraint on `(blocker_user_id, blocked_user_id)` named `uq_block_pair` -- prevents duplicate blocks
     - Check constraint: `blocker_user_id != blocked_user_id` named `ck_no_self_block`
   - Why: Separate models for reports and blocks because they serve different purposes (reports are admin-reviewed, blocks are user-controlled)
   - Dependencies: Step 1 (ReportReason enum)
   - Risk: Low
   - Test: Model imports correctly; `ruff check`

4. **Create `__init__.py`** (`backend/app/features/moderation/__init__.py`)
   - Action: Create empty file
   - Dependencies: None
   - Risk: Low

5. **Write Alembic migration** (`backend/alembic/versions/0018_moderation_tables.py`)
   - Action: Hand-write migration (enum + 3 schema changes)
   - Migration steps:
     1. Create `report_reason_enum` PostgreSQL enum type with `CREATE TYPE ... IF NOT EXISTS`
     2. Add `is_admin` boolean column to `users` table (NOT NULL DEFAULT false)
     3. Create `content_reports` table with all columns + unique constraint
     4. Create `user_blocks` table with all columns + unique constraint + check constraint
     5. Create indexes: `ix_content_reports_reporter`, `ix_content_reports_target`, `ix_content_reports_resolved_at` (for admin queries filtering unresolved), `ix_user_blocks_blocker`, `ix_user_blocks_blocked`
   - Down migration: drop tables, drop is_admin column, drop enum
   - Revision: `0018_moderation_tables`, depends on `0017_water_logs`
   - Why: Schema must exist before service code
   - Dependencies: Steps 2-3 (models guide column specs)
   - Risk: Medium -- enum creation requires care; the is_admin column addition is straightforward (NOT NULL with DEFAULT)
   - Test: `alembic upgrade head` succeeds; `alembic downgrade -1` succeeds

6. **Update test infrastructure** (`backend/tests/conftest.py` and `backend/alembic/env.py`)
   - Action in `conftest.py`:
     - Add imports: `from app.features.moderation.models import ContentReport, UserBlock`
     - Add to the model tuple in `test_engine` fixture
     - Add enum creation SQL for `report_reason_enum`
   - Action in `alembic/env.py`:
     - Add: `from app.features.moderation import models as _moderation  # noqa: F401`
   - Why: Test DB and alembic need to know about new models/enums
   - Dependencies: Steps 3-4
   - Risk: Low

Verification:
```bash
cd backend && ruff check app/core/enums.py app/features/auth/models.py app/features/moderation/
cd backend && pytest tests/api/test_health.py -v  # smoke test
```

### Phase 2: Rate Limiting + Admin Guard + Schemas + Factories (Infrastructure Layer)
Estimate: 4 files modified, 1 file new

1. **Add UserBasedRateLimiter** (`backend/app/core/rate_limit.py`)
   - Action: Add a new class `UserBasedRateLimiter` that takes a `user_id_resolver` callable
   - Constructor: `__init__(self, max_requests: int, window_seconds: int)`
   - Key difference from `RateLimiter`: keyed by user_id string instead of client IP
   - Method: `check(user_id: str) -> None` -- raises HTTPException(429) if over limit
   - This is NOT a FastAPI dependency (it doesn't read Request); the router calls `limiter.check(str(user_id))` directly
   - Instantiate: `publish_rate_limiter = UserBasedRateLimiter(max_requests=10, window_seconds=3600)` -- 10 publishes/hour
   - Why: IP-based limiting is insufficient because multiple users share IPs; we need per-user throttling on publish
   - Dependencies: None
   - Risk: Low -- simple adaptation of existing pattern
   - Test: Unit test alongside existing rate limit tests

2. **Add `require_admin` dependency** (`backend/app/core/deps.py`)
   - Action: Add a new dependency function:
     ```python
     async def require_admin(user: User = Depends(get_current_user)) -> User:
         if not user.is_admin:
             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
         return user
     ```
   - Import `status` from `fastapi`
   - Why: Admin endpoints need a reusable guard; keeps the check out of routers
   - Dependencies: Phase 1 Step 2 (is_admin column on User)
   - Risk: Low
   - Test: Tested via integration tests in Phase 4

3. **Create moderation schemas** (`backend/app/features/moderation/schemas.py`)
   - Action: Define Pydantic request/response schemas
   - Schemas:
     - `ReportCreateRequest`: target_shared_food_id (UUID), reason (ReportReason), detail (str|None, max 2000)
     - `ReportResponse`: id, reporter_user_id, target_shared_food_id, reason, detail, created_at, resolved_at, resolved_by_user_id, resolution_note
     - `ReportListItem`: id, reporter_user_id, target_shared_food_id, reason, detail, created_at (for admin list)
     - `ResolveReportRequest`: resolution_note (str|None, max 2000)
     - `BlockCreateRequest`: blocked_user_id (UUID)
     - `BlockResponse`: id, blocker_user_id, blocked_user_id, created_at
     - `AdminModerationAction`: action (Literal["approve", "reject"]), reason (str|None, max 2000) -- for admin approve/reject
     - `ModerationStatsResponse`: pending_reports (int), pending_foods (int) -- admin dashboard summary
   - Why: Contracts must exist before service/router
   - Dependencies: Phase 1 Step 1 (ReportReason enum)
   - Risk: Low
   - Test: `ruff check`

4. **Add test factories** (`backend/tests/factories.py`)
   - Action: Add three new factory functions:
   - `create_content_report(session, *, reporter_user_id, target_shared_food_id, reason=ReportReason.inaccurate, detail=None, **overrides)` -> ContentReport
   - `create_user_block(session, *, blocker_user_id, blocked_user_id, **overrides)` -> UserBlock
   - `create_admin_user(session, **overrides)` -> User (convenience wrapper that sets `is_admin=True`)
   - Why: Tests need consistent factory functions
   - Dependencies: Phase 1 Step 3 (models)
   - Risk: Low
   - Test: Used in Phase 3 tests

Verification:
```bash
cd backend && ruff check app/core/rate_limit.py app/core/deps.py app/features/moderation/schemas.py tests/factories.py
```

### Phase 3: Service Layer (Business Logic)
Estimate: 2 files new, 1 file modified

1. **Create moderation service** (`backend/app/features/moderation/service.py`)
   - Action: Implement all business logic functions
   - **Report functions**:
     - `create_report(session, *, reporter_user_id, target_shared_food_id, reason, detail) -> ContentReport`
       - Validates the shared food exists and is not owned by the reporter (cannot self-report)
       - Idempotent: if a report already exists for this (reporter, target), return the existing one
       - After creating report, check total unresolved report count for this target; if >= AUTO_HIDE_THRESHOLD (default 3), set `shared_food.moderation_status = ModerationStatus.pending` (auto-hide)
       - Returns the report
     - `list_my_reports(session, *, user_id, limit, offset) -> list[ContentReport]`
       - Returns reports submitted by this user, ordered by created_at desc
     - `get_pending_reports(session, *, limit, offset) -> list[ContentReport]`
       - Admin: returns unresolved reports (resolved_at IS NULL), ordered by created_at asc (oldest first)
     - `resolve_report(session, *, report_id, admin_user_id, resolution_note) -> ContentReport | None`
       - Sets resolved_at and resolved_by_user_id; returns None if report not found
     - `count_unresolved_reports(session, *, target_shared_food_id) -> int`
       - Helper: counts reports where resolved_at IS NULL for a given target
   - **Block functions**:
     - `block_user(session, *, blocker_user_id, blocked_user_id) -> UserBlock`
       - Validates blocker != blocked (also enforced by DB constraint)
       - Idempotent: if block already exists, return existing
     - `unblock_user(session, *, blocker_user_id, blocked_user_id) -> bool`
       - Deletes the block row; returns False if not found
     - `list_blocked_users(session, *, user_id) -> list[UserBlock]`
       - Returns all blocks where blocker_user_id = user_id
     - `get_blocked_user_ids(session, *, user_id) -> set[uuid.UUID]`
       - Returns set of blocked_user_id values for efficient filtering
   - **Admin moderation functions**:
     - `admin_approve_food(session, *, shared_food_id, admin_user_id) -> SharedFood | None`
       - Sets moderation_status = approved; returns None if not found
     - `admin_reject_food(session, *, shared_food_id, admin_user_id, reason) -> SharedFood | None`
       - Sets moderation_status = rejected; returns None if not found
       - Optionally stores rejection reason (future: notification to owner)
     - `get_moderation_stats(session) -> dict[str, int]`
       - Returns counts: pending_reports, pending_foods (moderation_status=pending AND visibility=public)
   - Why: All business logic centralized in service
   - Dependencies: Phase 1 (models), Phase 2 (schemas)
   - Risk: Medium -- auto-hide threshold logic touches shared food status; must handle race conditions (two reports arriving simultaneously)
   - Test: See Step 2

2. **Modify shared food search to support block filtering** (`backend/app/features/shared/service.py`)
   - Action: Add optional `exclude_owner_ids: set[uuid.UUID] | None = None` parameter to `search_shared_foods`
   - If provided, add `.where(SharedFood.owner_user_id.not_in(exclude_owner_ids))` clause
   - Also add the same parameter to `get_shared_food` -- if the food's owner is in the blocked set, return None
   - Why: Blocked users' content should be invisible to the blocker
   - Dependencies: Phase 3 Step 1 (block service for retrieving blocked IDs)
   - Risk: Low -- additive change, existing behavior unchanged when param is None
   - Test: Tested in Phase 3 service tests

3. **Write service tests** (`backend/tests/services/test_moderation_db.py`)
   - Action: Write comprehensive service-level tests
   - Test cases for reports:
     - `test_create_report_success` -- creates with correct fields
     - `test_create_report_idempotent` -- second report by same user for same target returns existing
     - `test_create_report_cannot_self_report` -- reporter == owner returns error/None
     - `test_create_report_nonexistent_food` -- returns error/None for unknown target
     - `test_auto_hide_after_threshold` -- 3 reports sets moderation_status to pending
     - `test_auto_hide_only_counts_unresolved` -- resolved reports don't count toward threshold
     - `test_list_my_reports_only_mine` -- user B cannot see user A's reports
     - `test_get_pending_reports_excludes_resolved` -- only unresolved returned
     - `test_resolve_report_sets_fields` -- resolved_at, resolved_by, note all set
   - Test cases for blocks:
     - `test_block_user_success` -- creates block row
     - `test_block_user_idempotent` -- second block returns existing
     - `test_block_user_no_self_block` -- blocker == blocked raises/returns error
     - `test_unblock_user_success` -- deletes block, returns True
     - `test_unblock_user_not_found` -- returns False
     - `test_get_blocked_user_ids` -- returns correct set
   - Test cases for block filtering:
     - `test_search_excludes_blocked_users_content` -- blocked user's public+approved foods hidden
     - `test_get_shared_food_blocked_returns_none` -- get-by-ID returns None for blocked owner's food
   - Test cases for admin:
     - `test_admin_approve_food` -- sets approved
     - `test_admin_reject_food` -- sets rejected
     - `test_get_moderation_stats` -- correct counts
   - Why: TDD -- moderation logic is safety-critical; must be thoroughly tested
   - Dependencies: Phase 2 (factories)
   - Risk: Low

Verification:
```bash
cd backend && ruff check app/features/moderation/service.py app/features/shared/service.py
cd backend && pytest tests/services/test_moderation_db.py -v
```

### Phase 4: Router Layer (API Endpoints)
Estimate: 2 files new, 2 files modified

1. **Create moderation router** (`backend/app/features/moderation/router.py`)
   - Action: Define API endpoints in two routers:
   - **User-facing router** (prefix `/moderation`, tag `moderation`):
     - `POST /v1/moderation/reports` -- Report a shared food (authenticated)
       - Request body: `ReportCreateRequest`
       - Response: 201 + `ReportResponse`
       - Error: 404 if target not found, 400 if self-report, 409 if already reported (or return existing -- see Open Questions)
     - `GET /v1/moderation/reports/mine` -- List my submitted reports (authenticated)
       - Query params: limit, offset
       - Response: 200 + `list[ReportListItem]`
     - `POST /v1/moderation/blocks` -- Block a user (authenticated)
       - Request body: `BlockCreateRequest`
       - Response: 201 + `BlockResponse`
       - Error: 400 if self-block
     - `DELETE /v1/moderation/blocks/{blocked_user_id}` -- Unblock a user (authenticated)
       - Response: 204
       - Error: 404 if not blocked
     - `GET /v1/moderation/blocks` -- List my blocks (authenticated)
       - Response: 200 + `list[BlockResponse]`
   - **Admin router** (prefix `/admin/moderation`, tag `admin`):
     - All endpoints use `Depends(require_admin)` guard
     - `GET /v1/admin/moderation/reports` -- List pending reports (admin)
       - Query params: limit, offset
       - Response: 200 + `list[ReportResponse]`
     - `POST /v1/admin/moderation/reports/{report_id}/resolve` -- Resolve a report (admin)
       - Request body: `ResolveReportRequest`
       - Response: 200 + `ReportResponse`
     - `POST /v1/admin/moderation/foods/{shared_food_id}/approve` -- Approve a shared food (admin)
       - Response: 200 + `SharedFoodResponse` (reuse from shared schemas)
     - `POST /v1/admin/moderation/foods/{shared_food_id}/reject` -- Reject a shared food (admin)
       - Request body: `AdminModerationAction` (with reason)
       - Response: 200 + `SharedFoodResponse`
     - `GET /v1/admin/moderation/stats` -- Moderation summary stats (admin)
       - Response: 200 + `ModerationStatsResponse`
   - Why: Separate user and admin routers with distinct prefixes for clarity
   - Dependencies: Phase 3 (service)
   - Risk: Low -- follows established router patterns

2. **Add rate limiting to publish endpoint** (`backend/app/features/shared/router.py`)
   - Action: Import `publish_rate_limiter` from `app.core.rate_limit`; call `publish_rate_limiter.check(str(user_id))` at the start of the `publish_food` handler
   - Why: Prevent spam publishing
   - Dependencies: Phase 2 Step 1 (UserBasedRateLimiter)
   - Risk: Low

3. **Pass blocked user IDs to search and get** (`backend/app/features/shared/router.py`)
   - Action: In `search_foods` and `get_food` handlers:
     - Import `get_blocked_user_ids` from moderation service
     - Call `blocked_ids = await get_blocked_user_ids(session, user_id=user_id)`
     - Pass `exclude_owner_ids=blocked_ids` to `search_shared_foods` and check in `get_food`
   - Why: Blocked users' content must be hidden from the blocker
   - Dependencies: Phase 3 (block service + search modification)
   - Risk: Medium -- adds a DB query to every search/get call. Mitigate: `get_blocked_user_ids` is a simple set query on an indexed column; cache in future if needed

4. **Register router in main.py** (`backend/app/main.py`)
   - Action: Import and include both moderation routers:
     - `from app.features.moderation.router import router as moderation_router, admin_router as moderation_admin_router`
     - `v1.include_router(moderation_router)`
     - `v1.include_router(moderation_admin_router)`
   - Dependencies: Step 1
   - Risk: Low

5. **Write router integration tests** (`backend/tests/api/test_moderation_api.py`)
   - Action: Write HTTP-level integration tests
   - Test cases for reports:
     - `test_create_report_requires_auth` -- 401 without token
     - `test_create_report_success` -- 201
     - `test_create_report_idempotent` -- second report returns same report
     - `test_create_report_self_report_400` -- cannot report own food
     - `test_create_report_nonexistent_food_404`
     - `test_list_my_reports` -- returns my reports only
   - Test cases for blocks:
     - `test_block_user_success` -- 201
     - `test_block_user_self_block_400`
     - `test_unblock_user_success` -- 204
     - `test_unblock_user_not_found_404`
     - `test_list_blocks` -- returns my blocks
     - `test_search_excludes_blocked_users_food` -- blocked user's food not in search results
   - Test cases for rate limiting:
     - `test_publish_rate_limited` -- 11th publish within an hour returns 429
   - Test cases for admin:
     - `test_admin_list_reports_requires_admin` -- non-admin gets 403
     - `test_admin_list_reports_success` -- admin sees pending reports
     - `test_admin_resolve_report` -- 200
     - `test_admin_approve_food` -- 200, moderation_status becomes approved
     - `test_admin_reject_food` -- 200, moderation_status becomes rejected
     - `test_admin_stats` -- correct counts
   - Pattern: Reuse `authenticated_client` fixture for normal user; create admin user via `create_admin_user` factory + separate JWT for admin tests. Use `_create_second_authenticated_user` helper for cross-user tests (same pattern as `test_shared_foods_api.py`).
   - Why: End-to-end HTTP verification
   - Dependencies: Phase 4 Steps 1-4
   - Risk: Medium -- admin tests require creating admin user fixture

Verification:
```bash
cd backend && ruff check app/features/moderation/ app/features/shared/router.py app/core/rate_limit.py app/core/deps.py
cd backend && pytest tests/api/test_moderation_api.py tests/services/test_moderation_db.py -v
cd backend && pytest --cov=app --cov-report=term-missing  # full suite, no regressions
```

### Phase 5: Client UI (Optional -- Needs Approval)
Estimate: 4-5 new files, 2 modified files

**NOTE**: This phase is deferred until a shared food browsing UI exists on the client. Currently no client screens exist for viewing shared foods. When that UI is built, add:

1. **Add API service functions** (`client/src/services/api/moderation.ts`)
   - `reportSharedFood(targetSharedFoodId, reason, detail?)` -> POST /v1/moderation/reports
   - `blockUser(blockedUserId)` -> POST /v1/moderation/blocks
   - `unblockUser(blockedUserId)` -> DELETE /v1/moderation/blocks/{id}
   - `getMyBlocks()` -> GET /v1/moderation/blocks

2. **Add ReportModal component** (`client/src/components/ReportModal.tsx`)
   - Shared component (used from any screen showing shared food details)
   - Props: `visible`, `onDismiss`, `onSubmit(reason, detail?)`
   - UI: RadioGroup for reason selection, optional TextInput for detail, Submit button
   - Uses `@particles` RadioGroup and Button

3. **Add report/block buttons to shared food detail view** (when built)
   - "Report" icon button -> opens ReportModal
   - "Block user" in overflow menu -> confirms via Alert, calls blockUser

4. **Add types** (`client/src/models/types.ts`)
   - `ReportReason` type: `"inaccurate" | "spam" | "offensive" | "other"`

Verification:
```bash
cd client && npx tsc --noEmit
cd client && pnpm test
```

## Testing Strategy

- **Unit tests** (`tests/services/test_moderation_db.py`): All service functions tested with real database. ~20 test cases covering reports (CRUD, idempotency, auto-hide, self-report prevention), blocks (CRUD, idempotency, self-block prevention, filtering), and admin actions (approve, reject, resolve, stats).
- **Integration tests** (`tests/api/test_moderation_api.py`): All endpoints tested via HTTP client. ~18 test cases covering auth, error codes, admin guard, rate limiting, cross-user isolation.
- **Rate limit tests**: Extend `tests/api/test_rate_limit.py` with tests for `UserBasedRateLimiter`.
- **Regression**: Existing shared food tests must continue to pass (search, CRUD, publish). The block filtering is additive and only activates when `exclude_owner_ids` is provided.
- **Manual verification**: After migration, inspect DB schema with `\d content_reports`, `\d user_blocks`, `\d users` (verify is_admin column).

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Auto-hide race condition: two reports arrive simultaneously, both trigger the threshold check | Low | The threshold check is a COUNT query; even if both proceed, the outcome (setting status to pending) is idempotent. No data corruption possible. |
| Block filtering adds latency to every search | Medium | `get_blocked_user_ids` is a simple indexed query. Most users block 0-5 people. If it becomes a bottleneck, add per-request caching or a materialized view. |
| Admin flag on User model is simplistic -- no role hierarchy | Low | Acceptable for MVP. If roles become complex, migrate to a `user_roles` join table later. The `require_admin` dependency is the single check point and easy to extend. |
| `UserBasedRateLimiter` is in-memory -- resets on server restart | Medium | Acceptable for MVP (same as existing IP limiter). For production, migrate to Redis-backed rate limiting. Document this limitation. |
| Report idempotency via unique constraint may cause IntegrityError on race | Low | Catch `IntegrityError` in service and return existing report (same pattern as device registration). |
| Migration adds NOT NULL column (is_admin) to populated users table | Low | Uses `server_default="false"` so all existing rows get `false` automatically. No backfill needed. |
| No notification system -- rejected owners don't know why | Medium | Out of scope for Phase 8. Admin can manually contact via email. Future: add notification table or email trigger. |
| Enum creation in test conftest must stay in sync with migration | Low | Follow established pattern (DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN null; END $$). |

## Open Questions

1. **Report idempotency behavior**: When a user reports the same food twice, should we return 200 with the existing report, or 409 Conflict? The plan assumes returning the existing report with 200 (idempotent POST). Confirm.

2. **Auto-hide threshold**: Default is 3 unresolved reports to auto-set `moderation_status = pending`. Should this be configurable via Settings/env var, or hardcoded? The plan makes it a module-level constant in the service (`AUTO_HIDE_THRESHOLD = 3`), easily promotable to settings later.

3. **Block visibility**: When user A blocks user B, should user B's content be completely invisible to A (404 on get-by-ID), or should A see it with a "blocked" indicator? The plan assumes complete invisibility (simpler, more private).

4. **Bidirectional blocking**: When A blocks B, should B also be unable to see A's shared foods? The plan assumes NO -- only the blocker gets filtering. B can still see A's public content. Mutual hiding would require checking both directions on every query. Confirm.

5. **Admin panel scope**: Is curl/httpie sufficient for admin actions for now, or do we need even a minimal admin web UI? The plan assumes backend-only (no admin UI in this phase).

6. **Client Phase 5 timing**: Should Phase 5 (client UI) be included in this plan, or deferred until a shared food browsing screen exists? Currently no client screens show shared foods. The plan defers Phase 5 but includes it as a placeholder.
