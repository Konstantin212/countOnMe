---
type: architecture
status: current
last-updated: 2026-03-19
related-features: []
---

# Module Impact Map — CountOnMe Client

This document maps the dependency graph and impact analysis for the CountOnMe client. Use this to understand the blast radius of changes to hooks, components, services, and utilities.

---

## Hook → Consumers Table

Hooks are the primary way screens fetch and manage data. Each hook owns state and side effects; screens consume them and pass derived data to components.

| Hook | Result Type | Consumers (Screens/Components) | Count |
|------|-------------|------|-------|
| `useProducts` | Products[] + CRUD | ProductsListScreen, ProductFormScreen, ProductSearchScreen, ProductConfirmScreen, ProductDetailsScreen, MealsListScreen, MealBuilderScreen, MealDetailsScreen, AddMealScreen, SelectProductScreen, AddFoodScreen | 11 |
| `useGoal` | UserGoal + CRUD | MyDayScreen, GoalSetupScreen, GoalCalculatedScreen, GoalManualScreen, GoalCalculatedResultScreen, MyPathScreen | 6 |
| `useMeals` | Meals[] + CRUD | MealsListScreen, MealBuilderScreen, MealDetailsScreen, AddMealScreen | 4 |
| `useFoodEntries` | Sync to backend | AddMealScreen (MyDayStack only) | 1 |
| `useMealTypeEntries` | EnrichedFoodEntry[] + update/delete | MealTypeEntriesScreen (MyDayStack only) | 1 |
| `useDayStats` | DayStats for today | MyDayScreen | 1 |
| `useStatsRange` | DailyStatsPoint[] for period | MyPathScreen | 1 |
| `useBodyWeight` | BodyWeightEntry[] + log/update/delete | MyPathScreen | 1 |
| `useSyncStatus` | Device auth + sync queue | ProfileScreen | 1 |
| `useBarcodeLookup` | Barcode lookup result | BarcodeScannerScreen, LookupStatus | 2 |
| `useTheme` | Theme context (colors, mode) | **39 screens + components** | 39 |

**Key Findings:**
- `useTheme` is ubiquitous — affects nearly all screens
- `useProducts` is highly reused (11 screens) — changes ripple across product + meal features
- `useGoal` affects 6 screens across two stacks (Profile + MyDay)
- `useMeals` is moderate (3 screens) — tightly scoped to meal management
- Specialized hooks (`useFoodEntries`, `useMealTypeEntries`, `useDayStats`, `useStatsRange`, `useBodyWeight`, `useSyncStatus`, `useBarcodeLookup`) have narrow, focused consumers

---

## Component Reuse Map

Shared components (molecules) and atomic particles are building blocks for screens.

### Particles (Atomic Components)
Located in `client/src/particles/`:
- `Button` — Text/icon button, used in ProductFormScreen, MealBuilderScreen, GoalFlow screens, BarcodeScannerScreen
- `FormField` — Wrapper for form inputs, used in ProductFormScreen, GoalFlow screens
- `Input` — Text input (with validation), used in ProductFormScreen, MealBuilderScreen
- `NumericInput` — Number-only input, used in ProductFormScreen, GoalCalculatedScreen, GoalManualScreen, ProductConfirmScreen, ProductDetailsScreen
- `RadioGroup` — Multi-choice selector, used in GoalCalculatedScreen, GoalFlow screens
- `SwitchField` — Toggle switch, used in ProductFormScreen
- `Typography` (Label, ErrorText, SectionTitle, Subtitle) — Text styling, used throughout

**Reuse Pattern:** Particles are standardized UI building blocks. Every form screen imports from `@particles/index`.

### Components (Molecules)
Located in `client/src/components/`:
- `ProductListItem` — Displays single product (name, calories, actions), used in ProductsListScreen, SelectProductScreen
- `MacroRings` — SVG ring chart for macro progress, used in MyDayScreen, MyPathScreen

---

## Service / Utility Consumers

Utilities provide pure business logic (no state or side effects).

### Calorie Calculation
**File:** `client/src/services/utils/calories.ts`
**Export:** `calcMealCalories(items: MealItem[], products: Product[]): number`
**Consumers:**
- `useMeals` hook (internal: `createMealRecord`, `patchMealRecord`)
- `MealBuilderScreen` (inline calculation)
- `AddMealScreen` (display totals)

### Unit Conversion
**File:** `client/src/services/utils/units.ts`
**Exports:** `convertUnit()`, `getCompatibleUnits()`
**Consumers:**
- `useMealTypeEntries` hook (calorie enrichment)
- `MealDetailsScreen` (amount conversion)
- `MealBuilderScreen` (amount conversion)
- `EditEntryModal` (amount conversion)
- `AddFoodScreen` (unit selection)

### Insights / Stats
**File:** `client/src/services/utils/insights.ts`
**Exports:** `calculateStreak()`, `calculateMacroAdherence()`, `deriveGoalPace()`, `calculateWeightDelta()`, `getDateRange()`
**Consumers:**
- `MyPathScreen` (all metrics: streak, adherence, pace, weight delta)
- `useStatsRange` hook (`getDateRange()`)

### Scales / Unit Conversion
**File:** `client/src/services/utils/scales.ts`
**Exports:** `toGrams()`, `SCALE_OPTIONS`, `Scale` type
**Consumers:**
- `ProductDetailsScreen` (convert display amount)
- `ProductConfirmScreen` (grams calculation)

### Analytics
**File:** `client/src/services/analytics.ts`
**Export:** `logEvent()`
**Consumers:**
- `BarcodeScannerScreen` (6 events: opened, permission denied, scanned, lookup succeeded/not found/failed, manual fallback)

### Open Food Facts API
**File:** `client/src/services/openFoodFacts.ts`
**Exports:** `getProductByBarcode()`, `extractCalories()`, `extractMacros()`
**Consumers:**
- `useBarcodeLookup` hook (fallback after catalog lookup)

---

## Storage / Persistence Consumers

**File:** `client/src/storage/storage.ts`
**Exports:** `loadProducts()`, `saveProducts()`, `loadMeals()`, `saveMeals()`, `loadGoal()`, `saveGoal()`, `loadBodyWeights()`, `saveBodyWeights()`, `pushProductRecent()`, `loadProductRecents()`, `loadProductFavourites()`, `saveProductFavourites()`, etc.
**Consumers:**
- `useProducts` hook
- `useMeals` hook
- `useGoal` hook
- `useBodyWeight` hook
- `SelectProductScreen` (recents)
- `ProductDetailsScreen` (recents)
- `AddFoodScreen` (recents)
- `ProfileScreen` (clear all data)

**File:** `client/src/storage/syncQueue.ts`
**Exports:** `enqueue()`, `flush()`, `getQueue()`, `getLastSyncAt()`, `getLastSyncError()`
**Consumers:**
- `useProducts` hook
- `useMeals` hook
- `useGoal` hook
- `useBodyWeight` hook
- `useSyncStatus` hook

---

## API Service Consumers

**Product API** (`client/src/services/api/products.ts`):
- `checkProductName()` → ProductFormScreen
- `searchProducts()` → SelectProductScreen
- `getProduct()` → useFoodEntries hook
- `createProduct()` → useFoodEntries hook

**Food Entries API** (`client/src/services/api/foodEntries.ts`):
- `listFoodEntries()` → useFoodEntries hook, useMealTypeEntries hook, AddMealScreen
- `createFoodEntry()` → useFoodEntries hook
- `updateFoodEntry()` → useMealTypeEntries hook
- `deleteFoodEntry()` → useMealTypeEntries hook, useFoodEntries hook

**Portions API** (`client/src/services/api/portions.ts`):
- `listPortions()` → useFoodEntries hook, useMealTypeEntries hook
- `createPortion()` → useFoodEntries hook

**Goals API** (`client/src/services/api/goals.ts`):
- `getCurrentGoal()` → useGoal hook
- `calculateGoal()` → useGoal hook, GoalCalculatedScreen
- `createCalculatedGoal()` → useGoal hook, GoalCalculatedResultScreen
- `createManualGoal()` → useGoal hook, GoalManualScreen
- `updateGoal()` → useGoal hook, GoalSetupScreen
- `deleteGoal()` → useGoal hook

**Stats API** (`client/src/services/api/stats.ts`):
- `getDayStats()` → useDayStats hook
- `getDailyStats()` → useStatsRange hook

**Body Weights API** (`client/src/services/api/bodyWeights.ts`):
- `listBodyWeights()` → useBodyWeight hook
- `createBodyWeight()` → useBodyWeight hook
- `updateBodyWeight()` → useBodyWeight hook
- `deleteBodyWeight()` → useBodyWeight hook

**Catalog API** (`client/src/services/api/catalog.ts`):
- `getCatalogProductByBarcode()` → useBarcodeLookup hook

**Data API** (`client/src/services/api/data.ts`):
- `resetDeviceData()` → ProfileScreen

---

## Impact Matrix — Common Change Scenarios

| Scenario | Affected Modules | Blast Radius | Notes |
|----------|------------------|--------------|-------|
| Fix bug in `calcMealCalories()` | useMeals, MealBuilderScreen, AddMealScreen | 3 screens | Low risk; utility is well-tested |
| Add new field to Product type | useProducts, all product consumers (11 screens), ProductFormScreen schema, API | 11+ screens | High risk; schema + storage + API changes required |
| Change calorie calculation in `useProducts` or `useMeals` | MealBuilderScreen, MealsListScreen, MealDetailsScreen | 3 screens | Medium risk; logic in hook affects display |
| Update theme (add/change color token) | useTheme (39 consumers) | 39 screens + components | High risk; visual consistency critical |
| Add goal field (e.g., "hydration target") | useGoal, 6 goal-related screens, API schema | 6+ screens | High risk; touches core feature, API contract |
| Refactor `convertUnit()` utility | useMealTypeEntries, MealDetailsScreen, MealBuilderScreen, EditEntryModal, AddFoodScreen | 5 screens | Medium risk; tested utility, well-scoped consumers |
| Break API authentication | All API services (10+), all hooks, ProfileScreen, sync status | Entire app | Critical; blocks all data operations |
| Add new stats metric | useStatsRange, useDayStats, MyPathScreen, MyDayScreen | 2 screens | Low risk; stats are calculated server-side |
| Modify barcode lookup flow | useBarcodeLookup, BarcodeScannerScreen, ProductConfirmScreen, analytics | 3 screens | Medium risk; fallback logic is complex |
| Change storage schema | All persistence (5 hooks + screens), sync queue | All screens with state | Critical; data migration required |

---

## Design Patterns Observed

### Hook Ownership
Hooks own state and persistence. Screens are dumb consumers: they call hooks, render results, dispatch actions on user input.

### Data Flow (Typical)
1. Screen mounts → Hook `useEffect` loads from AsyncStorage → Sets state
2. Screen renders with state
3. User action → Screen calls hook method (e.g., `addProduct()`) → Hook updates state + saves to storage + enqueues sync
4. Hook updates state → Screen re-renders
5. Screen unmounts → Cleanup (isMountedRef checks prevent race conditions)

### Error Handling
Errors are handled at hook level (logged, returned to screen as state). Screens display errors in UI. No unhandled promises.

### Dependency Tree
- Screens depend on hooks and services
- Hooks depend on storage, API services, utilities
- Components (particles) depend on useTheme only
- Utilities have no dependencies (pure functions)

---

## Recommendations

1. **When changing a hook signature:** Run full test suite on all consumer screens (listed in table above). Test with navigation focus/blur cycles.
2. **When adding a field to a domain type (Product, Meal, Goal, etc.):** Update storage schema + API + hook + screens. This is a 3–4 file change minimum; use `/plan` first.
3. **When refactoring utilities:** Keep function signatures stable. Use a seam test (test the old and new implementations in parallel) to verify correctness before deleting old code.
4. **When modifying theme:** Preview on both light and dark modes. Test contrast ratios for accessibility.
5. **When touching AsyncStorage or sync queue:** Test offline-first behavior: simulate network down, add/edit data, verify queue, restore network, verify flush. Don't commit without testing both paths.

---

## Key Files Summary

- **Hooks:** `client/src/hooks/use*.ts` (11 files)
- **Screens:** `client/src/screens/**/*.tsx` (35 files)
- **Components:** `client/src/components/*.tsx` (3 files, 2 reusable)
- **Particles:** `client/src/particles/*.tsx` (7 atoms)
- **Services:** `client/src/services/api/*.ts` + `client/src/services/utils/*.ts`
- **Storage:** `client/src/storage/storage.ts`, `client/src/storage/syncQueue.ts`
