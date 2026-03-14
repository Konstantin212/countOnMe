---
type: plan
status: active
created: 2026-03-14
---

# Screen Folder Structure Migration Plan

## Core Idea

Standardize `client/src/screens/` by grouping related screens into **flow folders**. A flow is a set of screens that share navigation context (e.g., a wizard, a CRUD set, a detail chain). Components used only within a single flow live inside that flow's `components/` subfolder. Components shared across multiple flows stay in the top-level `components/` directory.

This replaces the current flat layout where 17 loose screen files coexist alongside one already-organized flow (`AddMealFlow/`).

## Guiding Rules

1. **Flow folder per navigation group**: If 2+ screens share a navigation stack or flow context, they belong in `screens/{FlowName}/`.
2. **Flow-scoped components**: A component used by only one flow lives in `screens/{FlowName}/components/`. It is never imported from outside the flow.
3. **Shared components stay in `components/`**: If a component is used by 2+ flows or by standalone screens, it lives in `client/src/components/`.
4. **Standalone screens stay flat**: Tab root screens (MyDayScreen, ProfileScreen) that don't participate in a multi-screen flow remain as flat files in `screens/`.
5. **Inline extractions**: Components defined inline within a screen file (>30 lines) must be extracted into their own file inside the flow's `components/` folder.
6. **No barrel exports from flows**: Each screen/component is imported by its direct path. No `index.ts` re-exports at the flow level (navigation config imports screens directly).
7. **Naming**: Flow folders use PascalCase with `Flow` suffix for multi-screen flows (e.g., `GoalFlow/`), or PascalCase without suffix for single-screen folders with private components (e.g., `MyPath/`).
8. **Import updates**: After every file move, all imports across the codebase must be updated. No broken references.
9. **Navigation types**: Route param types in navigation config must be updated to reflect new file locations.

## Target Structure

```
client/src/screens/
├── GoalFlow/
│   ├── components/
│   │   ├── ActivityLevelCard.tsx
│   │   └── BmiScale.tsx
│   ├── GoalSetupScreen.tsx
│   ├── GoalManualScreen.tsx
│   ├── GoalCalculatedScreen.tsx
│   └── GoalCalculatedResultScreen.tsx
│
├── ProductFlow/
│   ├── ProductsListScreen.tsx
│   ├── ProductSearchScreen.tsx
│   ├── ProductFormScreen.tsx
│   ├── ProductConfirmScreen.tsx
│   └── ProductDetailsScreen.tsx
│
├── MealFlow/
│   ├── components/
│   │   ├── MealItemRow.tsx
│   │   ├── EntryListItem.tsx
│   │   └── EditEntryModal.tsx
│   ├── MealsListScreen.tsx
│   ├── MealBuilderScreen.tsx
│   ├── MealDetailsScreen.tsx
│   └── MealTypeEntriesScreen.tsx
│
├── AddMealFlow/                     # Already done — no changes
│   ├── components/
│   │   ├── AddFood/index.tsx
│   │   ├── AddMeal/index.tsx
│   │   └── SelectProduct/index.tsx
│   └── context.tsx
│
├── MyPath/
│   ├── components/
│   │   ├── GoalProgressCard.tsx
│   │   ├── WeightChart.tsx
│   │   ├── CalorieTrendBars.tsx
│   │   ├── MacroAdherenceCard.tsx
│   │   └── StreaksCard.tsx
│   └── MyPathScreen.tsx
│
├── MyDayScreen.tsx                  # Standalone (tab root)
└── ProfileScreen.tsx                # Standalone (tab root)

client/src/components/
├── ProductListItem.tsx              # Shared: ProductFlow + AddMealFlow
├── MacroRings.tsx                   # Used by standalone MyDayScreen
└── LogWeightModal.tsx               # UNUSED — delete in cleanup phase
```

## Acceptance Criteria

- [ ] Every multi-screen flow has its own folder under `screens/`
- [ ] Every single-use component lives inside its flow's `components/` subfolder
- [ ] No single-use component remains in the top-level `components/` directory
- [ ] Shared components (used by 2+ flows) remain in `components/`
- [ ] All inline components (>30 lines) are extracted to separate files
- [ ] `LogWeightModal` is deleted (confirmed unused)
- [ ] All imports compile: `npx tsc --noEmit` passes with zero errors
- [ ] All existing tests pass: `npm test` green
- [ ] No runtime navigation regressions (manual smoke test of each flow)
- [ ] Navigation param types updated in navigation config
- [ ] No circular dependencies introduced

## Migration Phases

Each phase is an atomic unit: move files, update imports, verify. Do not start the next phase until the current one is green.

### Phase 1 — GoalFlow

**Move screens:**
- `GoalSetupScreen.tsx` → `GoalFlow/GoalSetupScreen.tsx`
- `GoalManualScreen.tsx` → `GoalFlow/GoalManualScreen.tsx`
- `GoalCalculatedScreen.tsx` → `GoalFlow/GoalCalculatedScreen.tsx`
- `GoalCalculatedResultScreen.tsx` → `GoalFlow/GoalCalculatedResultScreen.tsx`

**Move components into flow:**
- `components/ActivityLevelCard.tsx` → `GoalFlow/components/ActivityLevelCard.tsx`
- `components/BmiScale.tsx` → `GoalFlow/components/BmiScale.tsx`

**Update imports in:**
- Navigation config (screen registrations)
- `ProfileScreen.tsx` (navigates to GoalSetup)
- `GoalCalculatedScreen.tsx` (imports ActivityLevelCard)
- `GoalCalculatedResultScreen.tsx` (imports BmiScale)

**Verify:** `tsc --noEmit` + `npm test`

### Phase 2 — ProductFlow

**Move screens:**
- `ProductsListScreen.tsx` → `ProductFlow/ProductsListScreen.tsx`
- `ProductSearchScreen.tsx` → `ProductFlow/ProductSearchScreen.tsx`
- `ProductFormScreen.tsx` → `ProductFlow/ProductFormScreen.tsx`
- `ProductConfirmScreen.tsx` → `ProductFlow/ProductConfirmScreen.tsx`
- `ProductDetailsScreen.tsx` → `ProductFlow/ProductDetailsScreen.tsx`

**No component moves** — `ProductListItem` stays in `components/` (shared with AddMealFlow).

**Update imports in:**
- Navigation config
- `ProfileScreen.tsx` (navigates to ProductsList)
- `AddMealFlow/components/SelectProduct/index.tsx` (navigates to ProductForm)

**Verify:** `tsc --noEmit` + `npm test`

### Phase 3 — MealFlow

**Move screens:**
- `MealsListScreen.tsx` → `MealFlow/MealsListScreen.tsx`
- `MealBuilderScreen.tsx` → `MealFlow/MealBuilderScreen.tsx`
- `MealDetailsScreen.tsx` → `MealFlow/MealDetailsScreen.tsx`
- `MealTypeEntriesScreen.tsx` → `MealFlow/MealTypeEntriesScreen.tsx`

**Move components into flow:**
- `components/MealItemRow.tsx` → `MealFlow/components/MealItemRow.tsx`

**Extract inline components from MealTypeEntriesScreen:**
- `EntryListItem` (inline, ~80 lines) → `MealFlow/components/EntryListItem.tsx`
- `EditEntryModal` (inline, ~225 lines) → `MealFlow/components/EditEntryModal.tsx`

**Update imports in:**
- Navigation config
- `ProfileScreen.tsx` (navigates to MealsList)
- `MyDayScreen.tsx` (navigates to MealTypeEntries)
- `MealDetailsScreen.tsx` (imports MealItemRow — now relative within flow)

**Verify:** `tsc --noEmit` + `npm test`

### Phase 4 — MyPath

**Move screen:**
- `MyPathScreen.tsx` → `MyPath/MyPathScreen.tsx`

**Move components into flow:**
- `components/GoalProgressCard.tsx` → `MyPath/components/GoalProgressCard.tsx`
- `components/WeightChart.tsx` → `MyPath/components/WeightChart.tsx`
- `components/CalorieTrendBars.tsx` → `MyPath/components/CalorieTrendBars.tsx`
- `components/MacroAdherenceCard.tsx` → `MyPath/components/MacroAdherenceCard.tsx`
- `components/StreaksCard.tsx` → `MyPath/components/StreaksCard.tsx`

**Update imports in:**
- Navigation config (if MyPath is registered as a screen)
- `MyPathScreen.tsx` (all 5 component imports become relative)

**Verify:** `tsc --noEmit` + `npm test`

### Phase 5 — Cleanup

- [ ] Delete `components/LogWeightModal.tsx` (confirmed unused)
- [ ] Verify no orphan files remain in `screens/` that should be in a flow
- [ ] Verify `components/` only contains shared components: `ProductListItem.tsx`, `MacroRings.tsx`
- [ ] Run full verification: `tsc --noEmit` + `npm test` + `npm run lint`
- [ ] Manual smoke test: navigate through each flow in the app

## Decision Log

| Decision | Rationale |
|----------|-----------|
| `AddMealFlow` unchanged | Already follows the target pattern |
| `MyPath` is a folder, not a "Flow" | Single screen with 5 private components — folder groups them, but no multi-screen navigation |
| `ProductListItem` stays shared | Used by both `ProductFlow/ProductsListScreen` and `AddMealFlow/SelectProduct` |
| `MacroRings` stays shared | Used by standalone `MyDayScreen` which has no flow folder |
| `LogWeightModal` deleted | Zero imports across entire codebase |
| Tab roots stay flat | `MyDayScreen` and `ProfileScreen` are entry points, not part of flows |
| No barrel exports | Direct imports keep dependency graph explicit and tree-shakeable |
