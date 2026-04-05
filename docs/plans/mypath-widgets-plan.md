---
type: plan
status: draft
last-updated: 2026-04-04
---

# Implementation Plan: MyPath Screen Overhaul — Widgets, Fasting Domain & New Screens

## Overview

Overhaul the MyPath analytics screen from 5 cards (GoalProgressCard, WeightChart, CalorieTrendBars, MacroAdherenceCard, StreaksCard) to 7 specialized widgets (WeightMetricWidget, EtaTrajectoryWidget, EfficiencyWidget, ConsistencyWidget, HydrationWidget, FastingWidget, ActiveCalWidget). This requires a new Fasting domain (backend + client), new pure calculation functions, two new screens (AddWeightScreen, FastingScreen + FastingSetupScreen), and navigation changes. All widget calculations are client-side (offline-first).

## Success Criteria

- [ ] 5 old MyPath cards replaced with 7 new widgets
- [ ] WeightMetricWidget: current weight, trend arrow (up/down/stable), embedded line chart with 1W/1M/3M period selector
- [ ] EtaTrajectoryWidget: estimated date to reach goal weight, progress bar, requires goal + weight data
- [ ] EfficiencyWidget: metabolic rate deviation compared to last week, visual indicator
- [ ] ConsistencyWidget: 4-week heatmap showing protein/energy compliance, score percentage
- [ ] HydrationWidget: non-clickable, shows today's water amount (already tracked)
- [ ] FastingWidget: clickable, shows active fasting session or last session, navigates to fasting screens
- [ ] ActiveCalWidget: non-clickable, static template placeholder for future active calories
- [ ] Backend: `fasting_sessions` table with full CRUD + sync integration
- [ ] Client: `useFasting` hook with offline-first storage + outbox sync
- [ ] AddWeightScreen: FAB "Log weight" action on MyPath
- [ ] FastingScreen: active timer with countdown/elapsed toggle
- [ ] FastingSetupScreen: technique selection (16:8, 18:6, 20:4, custom)
- [ ] All new calculation functions in `services/utils/insights.ts` with 100% test coverage
- [ ] All existing tests still pass
- [ ] Type check passes on both client and backend

## Assumptions

- **Validated**: Current MyPath has 5 cards at `client/src/screens/MyPath/components/` — GoalProgressCard, WeightChart, CalorieTrendBars, MacroAdherenceCard, StreaksCard
- **Validated**: `useBodyWeight`, `useWaterTracking`, `useGoal`, `useStatsRange` hooks exist and follow the `{ data, loading, refresh, ...actions }` pattern
- **Validated**: `insights.ts` has `calculateStreak`, `calculateMacroAdherence`, `deriveGoalPace`, `calculateWeightDelta`, `getDateRange` — all with tests
- **Validated**: SQLite database schema at `client/src/storage/database.ts` uses `SCHEMA_V1` with `PRAGMA user_version` migration strategy
- **Validated**: Backend uses feature-based layout at `backend/app/features/<domain>/` with models, schemas, service, router per feature
- **Validated**: Sync engine supports 6 entity types: products, portions, food_entries, body_weights, goals, water_logs — registered in `SYNCABLE_MODELS` dict at `backend/app/features/sync/service.py`
- **Validated**: Next backend migration is `0021` (last is `0020_enable_rls_all_tables`)
- **Validated**: `MyPathStackParamList` currently only has `{ MyPath: undefined }` — needs new screens
- **Validated**: No fasting code exists anywhere in the codebase
- **Validated**: Repository pattern: `client/src/storage/repositories/<entity>Repository.ts` with Row type, `rowToEntry` mapper, and CRUD methods (`findAll`, `upsert`, `markDeleted`, `findDirty`, `clearDirty`)
- **Needs confirmation**: Fasting techniques — 16:8, 18:6, 20:4, and custom. Are there others?
- **Needs confirmation**: Should old cards (CalorieTrendBars, MacroAdherenceCard) be removed entirely or kept below the new widgets?
- **Needs confirmation**: ActiveCalWidget is a static placeholder — no data or backend needed, just UI skeleton?

## Architecture Changes

### Backend

1. New feature module `backend/app/features/fasting/` — models, schemas, service, router
2. New migration `0021_fasting_sessions` — `fasting_sessions` table with user_id, technique, fasting_hours, started_at, target_end_at, ended_at, completed, soft deletes, sync mixins
3. Sync registry update — add `fasting_sessions` to `SYNCABLE_MODELS` and `_PUSH_FIELDS` in `backend/app/features/sync/service.py`
4. Router registration — add fasting router to `backend/app/main.py`

### Client

1. New types in `client/src/models/types.ts` — `FastingSession`, `FastingTechnique`, `WeightTrend`, `EtaProjection`, `EfficiencyResult`, `ConsistencyResult`
2. New calculation functions in `client/src/services/utils/insights.ts` — `calculateWeightTrend`, `calculateETA`, `calculateEfficiency`, `calculateConsistency`
3. New SQLite schema `SCHEMA_V2` in `client/src/storage/database.ts` — `fasting_sessions` table
4. New repository `client/src/storage/repositories/fastingRepository.ts`
5. New API service `client/src/services/api/fasting.ts`
6. New hook `client/src/hooks/useFasting.ts`
7. Sync engine update — add `fasting_session` entity type to `applyDeltas` in `client/src/services/syncEngine.ts`
8. 7 new widget components in `client/src/screens/MyPath/components/`
9. Rewritten `MyPathScreen.tsx` with new widget layout
10. New screens: `FastingScreen.tsx`, `FastingSetupScreen.tsx` in `client/src/screens/FastingFlow/`
11. New screen: `AddWeightScreen.tsx` in `client/src/screens/MyPath/components/` (modal-style, flow-specific)
12. Navigation type updates in `client/src/app/navigationTypes.ts`
13. Navigator updates in `client/src/app/AppNavigator.tsx`

## Files Affected

### New Files

**Backend:**
- `backend/app/features/fasting/__init__.py` — Module init
- `backend/app/features/fasting/models.py` — `FastingSession` ORM model
- `backend/app/features/fasting/schemas.py` — Pydantic request/response schemas
- `backend/app/features/fasting/service.py` — CRUD + business logic
- `backend/app/features/fasting/router.py` — REST endpoints
- `backend/alembic/versions/0021_fasting_sessions.py` — Migration
- `backend/tests/services/test_fasting_db.py` — Service tests
- `backend/tests/api/test_fasting_api.py` — API tests

**Client:**
- `client/src/storage/repositories/fastingRepository.ts` — SQLite repository
- `client/src/storage/repositories/fastingRepository.test.ts` — Repository tests
- `client/src/services/api/fasting.ts` — API service
- `client/src/hooks/useFasting.ts` — Fasting hook
- `client/src/hooks/useFasting.test.tsx` — Hook tests
- `client/src/screens/MyPath/components/WeightMetricWidget.tsx` — Weight + trend + chart (flow-specific)
- `client/src/screens/MyPath/components/EtaTrajectoryWidget.tsx` — ETA to goal (flow-specific)
- `client/src/screens/MyPath/components/EfficiencyWidget.tsx` — Metabolic efficiency (flow-specific)
- `client/src/screens/MyPath/components/ConsistencyWidget.tsx` — 4-week heatmap (flow-specific)
- `client/src/screens/MyPath/components/HydrationWidget.tsx` — Today's water (flow-specific)
- `client/src/screens/MyPath/components/FastingWidget.tsx` — Active session preview (flow-specific)
- `client/src/screens/MyPath/components/ActiveCalWidget.tsx` — Static placeholder (flow-specific)
- `client/src/screens/MyPath/components/AddWeightModal.tsx` — Weight entry modal (flow-specific)
- `client/src/screens/FastingFlow/FastingScreen.tsx` — Active timer screen
- `client/src/screens/FastingFlow/FastingSetupScreen.tsx` — Technique selection screen

### Modified Files

- `client/src/models/types.ts` — Add fasting + widget calculation types
- `client/src/services/utils/insights.ts` — Add 4 new calculation functions
- `client/src/services/utils/insights.test.ts` — Tests for new calculations
- `client/src/storage/database.ts` — Add `SCHEMA_V2` with `fasting_sessions` table
- `client/src/storage/repositories/index.ts` — Export `fastingRepository`
- `client/src/services/syncEngine.ts` — Add `mergeFastingSessions` and register in `applyDeltas`
- `client/src/app/navigationTypes.ts` — Add `FastingScreen`, `FastingSetup`, `AddWeight` to `MyPathStackParamList`
- `client/src/app/AppNavigator.tsx` — Register new MyPath stack screens + FastingFlow screens
- `client/src/screens/MyPath/MyPathScreen.tsx` — Replace 5 old cards with 7 widgets, add FAB actions
- `client/src/screens/MyPath/MyPathScreen.test.tsx` — Update mocks for new widgets
- `client/src/theme/colors.ts` — Add widget-specific color tokens (heatmap cells, efficiency indicator, fasting accent)
- `backend/app/features/sync/service.py` — Register `fasting_sessions` in `SYNCABLE_MODELS` and `_PUSH_FIELDS`
- `backend/app/main.py` — Include fasting router
- `backend/tests/conftest.py` — Import `FastingSession` model for table creation

### Retired Files (remove after new widgets are verified)

- `client/src/screens/MyPath/components/GoalProgressCard.tsx` — Replaced by EtaTrajectoryWidget
- `client/src/screens/MyPath/components/CalorieTrendBars.tsx` — Folded into EfficiencyWidget
- `client/src/screens/MyPath/components/MacroAdherenceCard.tsx` — Folded into ConsistencyWidget
- `client/src/screens/MyPath/components/StreaksCard.tsx` — Folded into ConsistencyWidget
- `client/src/screens/MyPath/components/WeightChart.tsx` — Replaced by WeightMetricWidget

## Implementation Steps

### Phase 1: Pure Calculation Functions (fe-developer)

Estimate: 3 files modified/created

All widget data depends on pure functions. Build and test these first with no UI or storage dependencies.

1. **Add new types** (`client/src/models/types.ts`)
   - Action: Add `FastingTechnique` type (`"16:8" | "18:6" | "20:4" | "custom"`), `FastingSession` type (`{ id, technique, fastingHours, startedAt, targetEndAt, endedAt, completed, createdAt, updatedAt }`), `WeightTrend` type (`{ direction: "up" | "down" | "stable", changeKg: number, changePercent: number, dataPoints: { day: string, weightKg: number }[] }`), `EtaProjection` type (`{ targetDate: string | null, daysRemaining: number | null, progressPercent: number, isOnTrack: boolean }`), `EfficiencyResult` type (`{ deviationPercent: number, direction: "over" | "under" | "on_target", avgCaloriesThisWeek: number, avgCaloriesLastWeek: number }`), `ConsistencyResult` type (`{ score: number, weeks: ConsistencyWeek[] }`) with `ConsistencyWeek` (`{ weekStart: string, days: ConsistencyDay[] }`) and `ConsistencyDay` (`{ day: string, proteinHit: boolean, calorieHit: boolean }`)
   - Why: All widgets and hooks depend on these types
   - Dependencies: None
   - Risk: Low
   - Test: Type check passes

2. **Add `calculateWeightTrend` function** (`client/src/services/utils/insights.ts`)
   - Action: Add `calculateWeightTrend(weights: BodyWeightEntry[], range: StatsPeriod): WeightTrend`. Filter weights to the date range. If < 2 entries, return `direction: "stable"`. Compare first vs last weight: >0.3kg change = up/down, else stable. Return data points for chart rendering. Use `getDateRange()` internally.
   - Why: WeightMetricWidget needs trend calculation
   - Dependencies: Phase 1 Step 1 (types)
   - Risk: Low — pure function, easy to test
   - Test: TDD — write tests first covering: no data, single entry, losing weight, gaining weight, stable weight, different periods

3. **Add `calculateETA` function** (`client/src/services/utils/insights.ts`)
   - Action: Add `calculateETA(weights: BodyWeightEntry[], goal: UserGoal): EtaProjection`. Need at least 7 days of weight data. Calculate weekly rate of change from linear regression or simple (last - first) / weeks. If rate is in wrong direction, return `targetDate: null`. Otherwise project: `daysRemaining = remaining_kg / (rate_per_day)`. Cap at 365 days. Calculate `progressPercent` from `calculateWeightDelta`.
   - Why: EtaTrajectoryWidget needs projected date
   - Dependencies: Phase 1 Step 1 (types)
   - Risk: Medium — edge cases around maintain goals, goal-already-reached, rate near zero
   - Test: TDD — test: no weights, not enough data, losing on track, gaining on track, wrong direction, goal reached, maintain goal

4. **Add `calculateEfficiency` function** (`client/src/services/utils/insights.ts`)
   - Action: Add `calculateEfficiency(dailyStats: DailyStatsPoint[], goal: UserGoal, today?: string): EfficiencyResult`. Split `dailyStats` into this-week and last-week buckets (relative to `today`). Average calories for each. Deviation = `(thisWeekAvg - goal.dailyCaloriesKcal) / goal.dailyCaloriesKcal * 100`. Direction: abs(deviation) < 5 = on_target, >0 = over, <0 = under.
   - Why: EfficiencyWidget needs this/last week comparison
   - Dependencies: Phase 1 Step 1 (types)
   - Risk: Low
   - Test: TDD — test: no data, only this week data, only last week data, over/under/on_target

5. **Add `calculateConsistency` function** (`client/src/services/utils/insights.ts`)
   - Action: Add `calculateConsistency(dailyStats: DailyStatsPoint[], goal: UserGoal, today?: string): ConsistencyResult`. Build 4-week grid (28 days back from today). For each day, check: `proteinHit = dailyProtein >= goal.proteinGrams * 0.8`, `calorieHit = abs(dailyCalories - goal.dailyCaloriesKcal) <= goal.dailyCaloriesKcal * 0.15`. Score = days with both hits / total days * 100.
   - Why: ConsistencyWidget needs heatmap data + compliance score
   - Dependencies: Phase 1 Step 1 (types)
   - Risk: Low — most complex is the 4-week date grid construction
   - Test: TDD — test: no data, full compliance, partial compliance, edge at thresholds

Verification:
```bash
cd client && npx tsc --noEmit
cd client && pnpm test -- --run src/services/utils/insights.test.ts
```

---

### Phase 2: Backend Fasting Domain (backend-developer)

Estimate: 8 files created, 3 modified

Build the complete backend feature before any client work touches fasting.

1. **Create `FastingSession` model** (`backend/app/features/fasting/models.py`)
   - Action: Create `FastingSession(Base, TimestampMixin, SyncMixin)` with columns: `id` (UUID PK), `user_id` (FK users.id, nullable), `device_id` (FK devices.id, nullable), `created_on_device_id`, `updated_on_device_id`, `technique` (String, not null — store as "16:8", "18:6", "20:4", "custom"), `fasting_hours` (Integer, not null), `started_at` (DateTime TZ, not null), `target_end_at` (DateTime TZ, not null), `ended_at` (DateTime TZ, nullable), `completed` (Boolean, not null, default False). Index on `(user_id, deleted_at)`. Follow `BodyWeight` model pattern exactly.
   - Why: Foundation for all fasting features
   - Dependencies: None
   - Risk: Low — follows established pattern
   - Test: Table created via conftest

2. **Create migration `0021_fasting_sessions`** (`backend/alembic/versions/0021_fasting_sessions.py`)
   - Action: `alembic revision --autogenerate -m "fasting_sessions"`. Review the generated migration: verify FK constraints, indexes, nullable columns, that `sync_version_seq` default is applied, and the RLS policy is created for the new table. Manually add: `CREATE TRIGGER fasting_sessions_bump_sync_version BEFORE INSERT OR UPDATE ON fasting_sessions FOR EACH ROW EXECUTE FUNCTION trg_bump_sync_version()`. Also add `ALTER TABLE fasting_sessions ENABLE ROW LEVEL SECURITY`.
   - Why: Database table must exist before service/router
   - Dependencies: Phase 2 Step 1
   - Risk: Medium — must verify autogenerated migration doesn't miss sync trigger or RLS
   - Test: `alembic upgrade head` succeeds on test DB

3. **Create schemas** (`backend/app/features/fasting/schemas.py`)
   - Action: Create `FastingStartRequest(APIModel)` with `technique: str`, `fasting_hours: int = Field(gt=0, le=72)`, `started_at: datetime`. Create `FastingEndRequest(APIModel)` with `ended_at: datetime`. Create `FastingSessionResponse(APIModel)` with all fields from model mapped. Follow `BodyWeightResponse` pattern.
   - Why: Request/response validation
   - Dependencies: None (can be done in parallel with model)
   - Risk: Low
   - Test: Schema validation tested via API tests

4. **Create service** (`backend/app/features/fasting/service.py`)
   - Action: Implement `start_fasting_session(session, user_id, technique, fasting_hours, started_at, device_id=None) -> FastingSession` — calculate `target_end_at = started_at + timedelta(hours=fasting_hours)`, check no active session exists (active = ended_at IS NULL AND deleted_at IS NULL), raise `ActiveSessionConflict` if one exists. Implement `end_fasting_session(session, user_id, session_id, ended_at, device_id=None) -> FastingSession | None` — find session, set `ended_at`, set `completed = ended_at >= target_end_at`. Implement `list_fasting_sessions(session, user_id, from_day=None, to_day=None) -> list[FastingSession]`. Implement `get_fasting_session(session, user_id, session_id) -> FastingSession | None`. Implement `get_active_session(session, user_id) -> FastingSession | None`. Implement `soft_delete_fasting_session(session, user_id, session_id) -> bool`. Follow `weights/service.py` pattern exactly.
   - Why: Business logic lives in services
   - Dependencies: Phase 2 Steps 1, 3
   - Risk: Low — straightforward CRUD + one business rule (no overlapping active sessions)
   - Test: Write `backend/tests/services/test_fasting_db.py` — TDD for start, end, list, get, get_active, delete, conflict on double-start

5. **Create router** (`backend/app/features/fasting/router.py`)
   - Action: `router = APIRouter(prefix="/fasting-sessions", tags=["fasting"])`. Endpoints: `POST /` (start), `POST /{id}/end` (end), `GET /` (list), `GET /active` (get active), `GET /{id}` (get by id), `DELETE /{id}` (soft delete). Use `get_current_user_id` and `get_optional_device_id` dependencies. Follow `weights/router.py` pattern. Return 409 for ActiveSessionConflict.
   - Why: REST API for fasting feature
   - Dependencies: Phase 2 Steps 3, 4
   - Risk: Low
   - Test: Write `backend/tests/api/test_fasting_api.py` — TDD for all 6 endpoints

6. **Register router in main.py** (`backend/app/main.py`)
   - Action: Add `from app.features.fasting.router import router as fasting_router` and `v1.include_router(fasting_router)` after the water_logs_router line
   - Why: Expose endpoints
   - Dependencies: Phase 2 Step 5
   - Risk: Low
   - Test: Health check still passes, `/v1/fasting-sessions` returns 401 without auth

7. **Register fasting in sync service** (`backend/app/features/sync/service.py`)
   - Action: Import `FastingSession` from `app.features.fasting.models`. Add `"fasting_sessions": FastingSession` to `SYNCABLE_MODELS`. Add `"fasting_sessions": {"technique", "fasting_hours", "started_at", "target_end_at", "ended_at", "completed"}` to `_PUSH_FIELDS`. Add `"fasting_sessions"` to `_PROCESS_ORDER` (at the end, no FK dependencies on other syncable tables).
   - Why: Fasting sessions must participate in delta sync
   - Dependencies: Phase 2 Step 1
   - Risk: Low — sync service is designed for extension
   - Test: Existing sync tests pass; write one new test verifying fasting_sessions appear in pull

8. **Update test conftest** (`backend/tests/conftest.py`)
   - Action: Add `from app.features.fasting.models import FastingSession` to the model imports. Add `FastingSession` to the tuple in the `test_engine` fixture (line ~90). Add `"fasting_sessions"` to the `sync_tables` list (line ~209). Add `fasting_sessions` trigger creation in the trigger loop.
   - Why: Test DB must create the fasting_sessions table
   - Dependencies: Phase 2 Step 1
   - Risk: Low
   - Test: All existing tests still pass

Verification:
```bash
cd backend && ruff check app/
cd backend && pytest --cov=app --cov-report=term-missing
```

---

### Phase 3: Client Fasting Data Layer (fe-developer)

Estimate: 7 files created, 4 modified

Build local storage, API service, and hook for fasting — all with tests.

1. **Add SQLite schema migration** (`client/src/storage/database.ts`)
   - Action: Add `SCHEMA_V2` string containing `CREATE TABLE IF NOT EXISTS fasting_sessions (...)` with columns matching the backend model: `id TEXT PRIMARY KEY`, `user_id TEXT NOT NULL`, `technique TEXT NOT NULL`, `fasting_hours INTEGER NOT NULL`, `started_at TEXT NOT NULL`, `target_end_at TEXT NOT NULL`, `ended_at TEXT`, `completed INTEGER NOT NULL DEFAULT 0`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`, `deleted_at TEXT`, `server_updated_at TEXT`, `last_synced_at TEXT`, `is_dirty INTEGER NOT NULL DEFAULT 1`, `created_on_device_id TEXT`, `updated_on_device_id TEXT`. Add indexes on `(user_id)` and `(is_dirty)`. In `initDatabase`, add migration block: if `currentVersion < 2`, run `SCHEMA_V2` and set `PRAGMA user_version = 2`.
   - Why: Local storage for fasting sessions
   - Dependencies: None
   - Risk: Low — follows exact pattern of SCHEMA_V1 tables
   - Test: Unit test for initDatabase covers version upgrade

2. **Create fasting repository** (`client/src/storage/repositories/fastingRepository.ts`)
   - Action: Follow `bodyWeightRepository.ts` pattern exactly. Define `FastingSessionRow` type (snake_case). Define `rowToSession` mapper. Export `fastingRepository` with methods: `findAll(db, userId)` — returns non-deleted sessions sorted by started_at DESC; `findActive(db, userId)` — returns single session where ended_at IS NULL AND deleted_at IS NULL; `upsert(db, userId, session)` — INSERT OR REPLACE; `markDeleted(db, id)` — soft delete; `findDirty(db)` — all dirty rows; `clearDirty(db, ids)` — clear dirty flag.
   - Why: Repository mediates between SQLite and domain types
   - Dependencies: Phase 1 Step 1 (FastingSession type), Phase 3 Step 1 (schema)
   - Risk: Low
   - Test: Write `client/src/storage/repositories/fastingRepository.test.ts` following `bodyWeightRepository.test.ts` pattern

3. **Export from repository barrel** (`client/src/storage/repositories/index.ts`)
   - Action: Add `export { fastingRepository } from "./fastingRepository";`
   - Why: Central export point
   - Dependencies: Phase 3 Step 2
   - Risk: Low
   - Test: Import works

4. **Create API service** (`client/src/services/api/fasting.ts`)
   - Action: Follow `client/src/services/api/bodyWeights.ts` pattern. Define `FastingSessionApiResponse` type (snake_case). Define `mapApiResponseToSession` mapper. Export functions: `startFastingSession(technique, fastingHours, startedAt)`, `endFastingSession(id, endedAt)`, `listFastingSessions(from?, to?)`, `getActiveFastingSession()`, `deleteFastingSession(id)`. Map to endpoints: `POST /v1/fasting-sessions`, `POST /v1/fasting-sessions/{id}/end`, `GET /v1/fasting-sessions`, `GET /v1/fasting-sessions/active`, `DELETE /v1/fasting-sessions/{id}`.
   - Why: API communication layer
   - Dependencies: Phase 1 Step 1 (types)
   - Risk: Low
   - Test: Tested via hook tests (integration)

5. **Create `useFasting` hook** (`client/src/hooks/useFasting.ts`)
   - Action: Follow `useBodyWeight.ts` pattern precisely. Return type `UseFastingResult` with `{ sessions, activeSession, loading, error, refresh, startSession, endSession, deleteSession }`. On mount, load from local SQLite via `fastingRepository.findAll` + `fastingRepository.findActive`, then background-sync via API `listFastingSessions`. For `startSession(technique, fastingHours)`: create local FastingSession with UUID, calculate `targetEndAt = new Date(startedAt.getTime() + fastingHours * 3600000)`, optimistic update, enqueue to outbox, call `debouncedSync()`. For `endSession(id)`: find session, set `endedAt`, calculate `completed = endedAt >= targetEndAt`, optimistic update, enqueue. For `deleteSession(id)`: optimistic remove, mark deleted in repo, enqueue. Use `isMountedRef`, `sessionsRef` patterns.
   - Why: Hook owns fasting state, offline-first
   - Dependencies: Phase 3 Steps 2, 3, 4
   - Risk: Medium — active session logic must stay consistent between hook and backend
   - Test: Write `client/src/hooks/useFasting.test.tsx` following `useBodyWeight.test.tsx` pattern

6. **Update sync engine for fasting** (`client/src/services/syncEngine.ts`)
   - Action: Import `FastingSession` from `@models/types`. Import `fastingRepository` from `@storage/repositories`. Add `mergeFastingSessions` function following `mergeBodyWeights` pattern — map sync items to `FastingSession` objects, call `fastingRepository.upsert` for each non-deleted, `fastingRepository.markDeleted` for deleted. Register in `applyDeltas`: add `if (grouped["fasting_session"]) { await mergeFastingSessions(db, userId, grouped["fasting_session"]); }`. Note: entity type key is `"fasting_session"` (singular) to match outbox entries from `useFasting` hook.
   - Why: Fasting sessions must sync bidirectionally
   - Dependencies: Phase 3 Steps 2, 3
   - Risk: Low — sync engine is designed for extension
   - Test: Verify sync engine tests still pass (if any exist)

7. **Add theme colors** (`client/src/theme/colors.ts`)
   - Action: Add to both `LightTheme` and `DarkTheme`:
     - `heatmapHit: "#16A34A"` / `"#22C55E"` — consistency day with both targets met
     - `heatmapPartial: "#FCD34D"` / `"#FBBF24"` — consistency day with one target met
     - `heatmapMiss: "#FCA5A5"` / `"#F87171"` — consistency day with no targets met
     - `heatmapEmpty: "#F1F5F9"` / `"#1E293B"` — no data for that day
     - `fastingAccent: "#8B5CF6"` / `"#A78BFA"` — fasting feature accent (purple)
     - `fastingBg: "#F5F3FF"` / `"#1E1B4B"` — fasting card background tint
     - `efficiencyPositive: "#16A34A"` / `"#22C55E"` — efficiency on/under target
     - `efficiencyNegative: "#DC2626"` / `"#EF4444"` — efficiency over target
   - Why: Widgets need distinct visual identity
   - Dependencies: None
   - Risk: Low — additive change
   - Test: Type check passes (Theme type auto-inferred)

Verification:
```bash
cd client && npx tsc --noEmit
cd client && pnpm test -- --run src/hooks/useFasting.test.tsx src/storage/repositories/fastingRepository.test.ts
```

---

### Phase 4: New Widget Components (fe-developer)

Estimate: 7 new files, 0 modified (widgets are self-contained)

Build all 7 widget components. Each receives data via props (no direct hook calls inside widgets). All are flow-specific components in `screens/MyPath/components/`.

1. **WeightMetricWidget** (`client/src/screens/MyPath/components/WeightMetricWidget.tsx`)
   - Action: Props: `{ weights: BodyWeightEntry[], trend: WeightTrend, period: StatsPeriod, onPeriodChange: (p: StatsPeriod) => void }`. Display: current weight (large, bold), trend arrow icon (Ionicons `arrow-up`/`arrow-down`/`remove` for stable) with change amount. Embedded `LineChart` from `react-native-gifted-charts` showing `trend.dataPoints`. Inline period selector (1W, 1M, 3M) at bottom of card. Card styling follows existing card pattern (borderRadius 16, shadow, cardBackground). Empty state: "Log your first weight" text.
   - Why: Primary weight insight at a glance
   - Dependencies: Phase 1 (WeightTrend type)
   - Risk: Low — reuses existing chart library
   - Test: Write basic render test with empty + populated props

2. **EtaTrajectoryWidget** (`client/src/screens/MyPath/components/EtaTrajectoryWidget.tsx`)
   - Action: Props: `{ eta: EtaProjection | null, goal: UserGoal | null, onSetupGoal?: () => void }`. Display: "Estimated arrival" label, target date in bold (or "N/A" if null), days remaining count, progress bar (reuse existing pattern from GoalProgressCard). Show "on track" / "off track" badge. Empty state when no goal: "Set a goal" CTA button. Empty state when not enough data: "Need more weight data" message.
   - Why: Motivational widget showing when user will reach goal
   - Dependencies: Phase 1 (EtaProjection type)
   - Risk: Low
   - Test: Render test with null eta, valid eta, no goal

3. **EfficiencyWidget** (`client/src/screens/MyPath/components/EfficiencyWidget.tsx`)
   - Action: Props: `{ efficiency: EfficiencyResult | null }`. Display: "Metabolic Efficiency" title, deviation percentage in large text (e.g., "+5%" or "-3%"), color coded (green for on_target/under, red for over), "vs last week" subtitle. If no data, show "Track meals for at least 2 weeks" empty state.
   - Why: Quick calorie adherence feedback
   - Dependencies: Phase 1 (EfficiencyResult type)
   - Risk: Low — simple display widget
   - Test: Render test with null, on_target, over, under

4. **ConsistencyWidget** (`client/src/screens/MyPath/components/ConsistencyWidget.tsx`)
   - Action: Props: `{ consistency: ConsistencyResult | null }`. Display: "Consistency" title, score percentage in large text, 4-week heatmap grid (7 columns x 4 rows). Each cell colored by: both hits = `heatmapHit`, one hit = `heatmapPartial`, no hits = `heatmapMiss`, no data = `heatmapEmpty`. Cell size ~32x32 with 2px gap. Week labels on left (W1-W4), day labels on top (M T W T F S S). Below grid: legend showing color meanings.
   - Why: Visual consistency tracking replaces old StreaksCard
   - Dependencies: Phase 1 (ConsistencyResult type), Phase 3 Step 7 (heatmap colors)
   - Risk: Medium — heatmap grid layout needs careful styling for different screen sizes
   - Test: Render test with null, full data, partial data

5. **HydrationWidget** (`client/src/screens/MyPath/components/HydrationWidget.tsx`)
   - Action: Props: `{ todayTotal: number, waterGoal: number }`. Display: "Hydration" title, water icon (Ionicons `water`), today's total in ml, progress text (e.g., "1200 / 2000 ml"), thin progress bar. Non-clickable. Card uses `waterFill` color accent.
   - Why: At-a-glance water tracking without opening the modal
   - Dependencies: None (uses existing theme colors)
   - Risk: Low — pure display
   - Test: Render test with 0ml, partial, goal met

6. **FastingWidget** (`client/src/screens/MyPath/components/FastingWidget.tsx`)
   - Action: Props: `{ activeSession: FastingSession | null, onPress: () => void }`. If active session: show "Fasting" title with `fastingAccent` badge, elapsed/remaining time (calculated from `activeSession.startedAt` and `targetEndAt` vs current time — use `useState` + `useEffect` with 1-second interval for live countdown), technique label, circular or linear progress indicator. If no active session: show "Start a fast" CTA text. Entire card is `Pressable` with `onPress`. Card uses `fastingBg` background tint.
   - Why: Entry point to fasting feature, shows live status
   - Dependencies: Phase 1 (FastingSession type), Phase 3 Step 7 (fasting colors)
   - Risk: Medium — live timer logic inside widget; must clean up interval on unmount
   - Test: Render test with null session, active session; verify timer cleanup

7. **ActiveCalWidget** (`client/src/screens/MyPath/components/ActiveCalWidget.tsx`)
   - Action: Props: `{}`. Display: "Active Calories" title, placeholder icon (Ionicons `flame`), "Coming Soon" text in secondary color, dashed border style to indicate placeholder. Non-clickable.
   - Why: Reserve space for future feature, maintain grid layout
   - Dependencies: None
   - Risk: Low — static UI only
   - Test: Simple render test

Verification:
```bash
cd client && npx tsc --noEmit
cd client && pnpm test -- --run src/screens/MyPath/components/
```

---

### Phase 5: New Screens & Navigation (fe-developer)

Estimate: 5 files created, 3 modified

Wire up navigation and build the new screens.

1. **Update navigation types** (`client/src/app/navigationTypes.ts`)
   - Action: Update `MyPathStackParamList` to:
     ```
     MyPath: undefined;
     FastingSetup: undefined;
     FastingScreen: { sessionId: string };
     ```
     Note: AddWeight will be a modal overlay on MyPath, not a separate nav screen.
   - Why: Type-safe navigation to new screens
   - Dependencies: None
   - Risk: Low
   - Test: Type check passes

2. **Create AddWeightModal** (`client/src/screens/MyPath/components/AddWeightModal.tsx`)
   - Action: Modal component (not a screen) — props: `{ visible: boolean, onClose: () => void, onLogWeight: (day: string, weightKg: number) => Promise<void> }`. Uses `Modal` from react-native. Contains: date display (defaults to today, read-only for now), numeric input for weight (kg, one decimal), "Save" button. On save, calls `onLogWeight(day, weightKg)` and closes. Follow WaterModal pattern for modal structure. Use `NumericInput` from particles.
   - Why: Quick weight logging from MyPath FAB
   - Dependencies: None
   - Risk: Low — follows WaterModal pattern
   - Test: Render test with visible/hidden, submit calls handler

3. **Create FastingSetupScreen** (`client/src/screens/FastingFlow/FastingSetupScreen.tsx`)
   - Action: Screen with technique selection. Display 3 preset cards: "16:8 (16h fast, 8h eat)", "18:6 (18h fast, 6h eat)", "20:4 (20h fast, 4h eat)". Each card is a `Pressable` that highlights on select. "Custom" option with numeric input for custom hours. "Start Fast" button at bottom — calls `useFasting().startSession(technique, hours)` and navigates to `FastingScreen` with the new session ID. Uses `SafeAreaView`, back button, standard screen layout.
   - Why: Entry point for creating a new fasting session
   - Dependencies: Phase 3 Step 5 (useFasting hook)
   - Risk: Low
   - Test: Render test — verify 4 technique options render, start button works

4. **Create FastingScreen** (`client/src/screens/FastingFlow/FastingScreen.tsx`)
   - Action: Screen showing active fasting session. Receives `sessionId` via route params. Loads session from `useFasting`. Displays: technique label, large countdown timer (time remaining until `targetEndAt`), elapsed time display, toggle button to switch between countdown/elapsed view. Progress ring or bar showing completion percentage. "End Fast" button — calls `useFasting().endSession(id)`, shows completion status (completed early vs. completed on time), then navigates back. Timer uses `useState` + `useEffect` with 1-second interval using `Date.now()` comparison to `targetEndAt` timestamp (no native timers). Uses `SafeAreaView`.
   - Why: Active fasting experience
   - Dependencies: Phase 3 Step 5 (useFasting hook)
   - Risk: Medium — timer UX and completion flow
   - Test: Render test with active session, verify timer displays, end button calls handler

5. **Update AppNavigator** (`client/src/app/AppNavigator.tsx`)
   - Action: Import `FastingSetupScreen` and `FastingScreen` from `@screens/FastingFlow/`. Add them to `MyPathStackNavigator`:
     ```
     <MyPathStack.Screen name="FastingSetup" component={FastingSetupScreen} options={{ title: "Start Fast" }} />
     <MyPathStack.Screen name="FastingScreen" component={FastingScreen} options={{ title: "Fasting" }} />
     ```
   - Why: Register new screens in navigation
   - Dependencies: Phase 5 Steps 1, 3, 4
   - Risk: Low
   - Test: App compiles, navigation works

Verification:
```bash
cd client && npx tsc --noEmit
cd client && pnpm test
```

---

### Phase 6: MyPath Screen Rewrite (fe-developer)

Estimate: 2 files modified (MyPathScreen.tsx, MyPathScreen.test.tsx)

Replace the existing card layout with the 7 new widgets.

1. **Rewrite MyPathScreen** (`client/src/screens/MyPath/MyPathScreen.tsx`)
   - Action:
     - Keep existing hook calls: `useGoal`, `useBodyWeight`, `useWaterTracking`, `useStatsRange`
     - Add new hook call: `useFasting` (import from `@hooks/useFasting`)
     - Add state for weight widget period: `const [weightPeriod, setWeightPeriod] = useState<StatsPeriod>("7d")`
     - Compute new derived data:
       - `const trend = calculateWeightTrend(weights, weightPeriod)`
       - `const eta = goal ? calculateETA(weights, goal) : null`
       - `const efficiency = goal ? calculateEfficiency(dailyStats, goal) : null`
       - `const consistency = goal ? calculateConsistency(dailyStats, goal) : null`
     - Replace ScrollView content with 7 widgets in order:
       1. `<WeightMetricWidget weights={weights} trend={trend} period={weightPeriod} onPeriodChange={setWeightPeriod} />`
       2. `<EtaTrajectoryWidget eta={eta} goal={goal} onSetupGoal={handleSetupGoal} />`
       3. `<EfficiencyWidget efficiency={efficiency} />`
       4. `<ConsistencyWidget consistency={consistency} />`
       5. `<HydrationWidget todayTotal={todayTotal} waterGoal={waterGoal} />`
       6. `<FastingWidget activeSession={activeSession} onPress={handleFastingPress} />`
       7. `<ActiveCalWidget />`
     - Remove old imports: GoalProgressCard, WeightChart, CalorieTrendBars, MacroAdherenceCard, StreaksCard
     - Remove old period selector (global) — WeightMetricWidget has its own
     - Add `handleFastingPress`: if `activeSession`, navigate to `FastingScreen`; else navigate to `FastingSetup`
     - Update FAB actions: add "Log weight" action (icon: `scale`, opens AddWeightModal) and "Start fast" action (icon: `timer`, navigates to FastingSetup)
     - Add `AddWeightModal` with visibility state, wire `logWeight` from `useBodyWeight`
     - Update `handleRefresh` to also refresh fasting data
   - Why: Core deliverable — new widget-based layout
   - Dependencies: All prior phases
   - Risk: High — large single-file change touching hooks, navigation, and layout. Mitigate by keeping widget components simple (props-only, no internal hook calls)
   - Test: Update `MyPathScreen.test.tsx`

2. **Update MyPathScreen test** (`client/src/screens/MyPath/MyPathScreen.test.tsx`)
   - Action:
     - Add mock for `useFasting` hook (return `{ sessions: [], activeSession: null, loading: false, ... }`)
     - Replace old component mocks (GoalProgressCard, WeightChart, etc.) with new widget mocks (WeightMetricWidget, EtaTrajectoryWidget, etc.)
     - Add mock for `AddWeightModal`
     - Add mock for new insight functions (`calculateWeightTrend`, `calculateETA`, `calculateEfficiency`, `calculateConsistency`)
     - Update FAB tests: verify "Log weight" and "Start fast" actions appear
     - Test fasting navigation: "Start fast" FAB action navigates to FastingSetup
   - Why: Tests must reflect new widget structure
   - Dependencies: Phase 6 Step 1
   - Risk: Medium — many mocks to update
   - Test: All MyPathScreen tests pass

Verification:
```bash
cd client && npx tsc --noEmit
cd client && pnpm test
```

---

### Phase 7: Cleanup & Polish (fe-developer)

Estimate: 5 files removed, 0 created

Remove old card components after verifying everything works.

1. **Remove retired components**
   - Action: Delete the following files:
     - `client/src/screens/MyPath/components/GoalProgressCard.tsx`
     - `client/src/screens/MyPath/components/WeightChart.tsx`
     - `client/src/screens/MyPath/components/CalorieTrendBars.tsx`
     - `client/src/screens/MyPath/components/MacroAdherenceCard.tsx`
     - `client/src/screens/MyPath/components/StreaksCard.tsx`
   - Why: No longer referenced after Phase 6
   - Dependencies: Phase 6 verified green
   - Risk: Low — verify no imports remain via grep
   - Test: Type check passes, no import errors

2. **Verify no dead imports**
   - Action: Run `grep -r "GoalProgressCard\|CalorieTrendBars\|MacroAdherenceCard\|StreaksCard\|WeightChart" client/src/` to confirm zero references to old components
   - Why: Clean codebase
   - Dependencies: Phase 7 Step 1
   - Risk: Low
   - Test: Grep returns no results

3. **Remove old insights functions if unused**
   - Action: Check if `deriveGoalPace` and `calculateWeightDelta` are still used by any widget or component. If only used by old GoalProgressCard, mark as candidates for removal. NOTE: `calculateWeightDelta` is likely still used by `calculateETA` internally — verify before removing. Do NOT remove `calculateStreak`, `calculateMacroAdherence`, `getDateRange` — they may still be used.
   - Why: Avoid dead code
   - Dependencies: Phase 7 Step 2
   - Risk: Medium — must verify usage before removing
   - Test: Full test suite passes after any removals

Verification:
```bash
cd client && pnpm run verify
cd backend && ruff check app/
cd backend && pytest --cov=app --cov-report=term-missing
```

## Testing Strategy

### Unit Tests

**Pure calculations** (`client/src/services/utils/insights.test.ts`):
- `calculateWeightTrend`: 6+ test cases (no data, single entry, losing, gaining, stable, period filtering)
- `calculateETA`: 7+ test cases (no weights, insufficient data, on track, off track, goal reached, maintain, rate near zero)
- `calculateEfficiency`: 5+ test cases (no data, this week only, both weeks, over/under/on_target)
- `calculateConsistency`: 5+ test cases (no data, full compliance, partial, edge thresholds, empty days)

**Fasting repository** (`client/src/storage/repositories/fastingRepository.test.ts`):
- findAll, findActive, upsert, markDeleted, findDirty, clearDirty — 8+ tests

**Fasting hook** (`client/src/hooks/useFasting.test.tsx`):
- Start session, end session (completed vs. early), delete session, refresh, active session tracking — 8+ tests

**Backend fasting service** (`backend/tests/services/test_fasting_db.py`):
- start_session, end_session, list, get, get_active, delete, conflict_on_double_start, user_isolation — 10+ tests

**Backend fasting API** (`backend/tests/api/test_fasting_api.py`):
- All 6 endpoints (happy path + error cases) — 12+ tests

### Integration Tests

- Sync pull includes fasting sessions (backend sync test)
- Sync push accepts fasting session upsert/delete (backend sync test)

### Manual Verification

- Open MyPath tab → 7 widgets render
- Log a weight via FAB → AddWeightModal appears, weight logged, WeightMetricWidget updates
- Start a fast via FAB → FastingSetupScreen, select technique, FastingScreen timer starts
- End a fast → timer stops, completion status shown
- Pull-to-refresh → all data refreshes
- Dark mode → all widgets render with correct colors
- No goal set → EtaTrajectoryWidget shows CTA, ConsistencyWidget shows empty state

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Phase 6 MyPathScreen rewrite is large (one file touches many hooks + widgets) | High | Keep widgets as pure props-only components; all logic stays in hooks and insights.ts. Test each widget independently first. |
| Fasting timer causes re-renders every second | Medium | Timer state is local to FastingWidget/FastingScreen only; React.memo or careful state scoping prevents propagating re-renders to parent |
| Heatmap grid layout breaks on small screens | Medium | Use `useWindowDimensions` to calculate cell size dynamically; test on 320px width |
| Schema migration (SCHEMA_V2) could fail on existing databases | Medium | Migration is additive (CREATE TABLE IF NOT EXISTS); existing data untouched; version check ensures idempotency |
| Removing old components breaks something unexpected | Low | Phase 7 is separate from Phase 6; run full verify between them; grep for dead imports |
| `calculateETA` linear projection can give absurd dates | Medium | Cap projection at 365 days; return null for unrealistic estimates |
| Backend fasting session conflict (double-start) race condition | Low | Backend enforces single active session in service layer; client prevents UI double-tap with loading state |

## Open Questions (Resolved)

1. **Fasting techniques**: 16:8, 18:6, 20:4, and custom only. No OMAD/23:1.
2. **Old cards**: Remove completely. No "detailed view" below.
3. **ActiveCalWidget**: Confirmed static placeholder, no data binding.
4. **Widget periods**: Each widget keeps its own fixed window. Weight has 1W/1M/3M, Efficiency = 2 weeks, Consistency = 4 weeks.
5. **Fasting session edit**: Yes, users can edit start/end times after a fast ends. Backend needs PATCH endpoint for session updates.
