# ADR-002: Macro Rings with Overconsumption Visualization

## Status

Proposed

## Context

The MyDay screen (`client/src/screens/MyDayScreen.tsx`, lines 300-315) uses `react-native-chart-kit`'s `ProgressChart` to display macro balance (protein, carbs, fat) as concentric ring charts. The current implementation caps all progress values at 1.0 (lines 74-77):

```typescript
const proteinProgress = Math.min(consumed.protein / proteinGoal, 1);
const carbsProgress = Math.min(consumed.carbs / carbsGoal, 1);
const fatProgress = Math.min(consumed.fat / fatGoal, 1);
```

This means when a user consumes 120% of their protein goal, the ring looks identical to 100%. There is no visual distinction between "exactly met" and "exceeded" -- a critical UX gap for a calorie tracking app where overconsumption awareness is the primary value proposition.

Additionally, `react-native-chart-kit`'s `ProgressChart` is a third-party component with limited customization. It renders its own SVG structure internally, making it impossible to overlay a second arc for overflow without forking the library.

### Pre-existing Work

A test file already exists at `client/src/components/MacroRings.test.tsx` that defines the expected component API and behavior. The implementation file (`MacroRings.tsx`) does not yet exist. This ADR documents the architectural decisions behind that implementation.

## Decision

Replace `react-native-chart-kit`'s `ProgressChart` with a custom `MacroRings` SVG component built on `react-native-svg` (already installed as v15.12.1). The component renders concentric rings where:

1. Values 0-100% render a single colored arc on a faded track (identical to current behavior).
2. Values 100-200% render a full (100%) base arc plus a second overflow arc in a darker shade of the same color, starting from 12 o'clock (top of the circle).
3. Values above 200% are visually capped at 200% (full base + full overflow).
4. The legend displays actual uncapped percentage values.

### What Changes

- **New file**: `client/src/components/MacroRings.tsx` -- custom SVG ring chart component
- **Modified file**: `client/src/screens/MyDayScreen.tsx` -- replace `ProgressChart` import/usage with `MacroRings`
- **Removed dependency usage**: `react-native-chart-kit` import is removed from MyDayScreen (the package itself may remain in `package.json` if used elsewhere)
- **Removed utility**: The `hexToRgba` function (lines 17-24 of MyDayScreen) becomes unused and should be removed

### What Stays

- The macro legend below the chart stays in MyDayScreen (not inside MacroRings) -- it has screen-specific styling and data formatting
- The `useGoal` and `useDayStats` hooks remain unchanged
- Theme color keys (`macroProtein`, `macroCarb`, `macroFat`) remain unchanged
- The chart card container and header ("Macro balance" / "Today") remain unchanged

## Component Design

### Props Interface

```typescript
type MacroRingDatum = {
  label: string;       // e.g. "Protein"
  progress: number;    // ratio (0 = 0%, 1.0 = 100%, 1.5 = 150%, uncapped from caller)
  color: string;       // hex color for the ring (e.g. colors.macroProtein)
};

type MacroRingsProps = {
  data: MacroRingDatum[];   // one entry per ring
  size?: number;            // SVG viewBox size (default: 220)
  strokeWidth?: number;     // ring thickness (default: 12)
  baseRadius?: number;      // radius of outermost ring (default: 44)
  ringGap?: number;         // gap between concentric rings (default: 20)
};
```

This matches the API established in the existing test file (`MacroRings.test.tsx`).

### Exported Symbols

- `MacroRings` -- the React component (named export)
- `darkenHex` -- a pure utility function that darkens a hex color by a given factor (named export, tested independently in `MacroRings.test.tsx`)

### SVG Rendering Logic

Each ring in `data` produces up to 3 SVG `<Circle>` elements:

1. **Background track**: Full circle at the ring's radius, using the ring's color at 0.2 opacity. Always rendered.
2. **Main arc**: Partial or full circle representing `Math.min(progress, 1.0)`. Uses `strokeDasharray` and `strokeDashoffset` to control arc length. Color is the ring's base color.
3. **Overflow arc** (conditional): Only rendered when `progress > 1.0`. Represents `Math.min(progress - 1.0, 1.0)` -- i.e., the portion above 100%, capped at an additional 100%. Uses a 25% darker shade of the ring's base color. Starts from 12 o'clock (same starting point as the main arc).

#### SVG Arc Technique (strokeDasharray / strokeDashoffset)

For a circle with radius `r`, the circumference is `C = 2 * PI * r`.

- `strokeDasharray = C` (one dash spanning the full circumference)
- `strokeDashoffset = C * (1 - fraction)` where `fraction` is the portion to show (0 to 1)
- The circle is rotated -90 degrees (via `transform`) so arcs start from 12 o'clock instead of 3 o'clock

This is the standard SVG circular progress technique. No path calculations or trigonometry needed.

#### Ring Layout

Rings are concentric, drawn from outside in. For `data` of length N:

```
ring[0] radius = baseRadius
ring[1] radius = baseRadius - ringGap
ring[2] radius = baseRadius - 2 * ringGap
...
```

The SVG viewBox is `size x size` with the center at `(size/2, size/2)`.

### darkenHex Utility

A pure function colocated in the same file:

```typescript
/**
 * Darken a hex color by a given amount (0 = no change, 1 = black).
 * Supports both 3-char (#FFF) and 6-char (#FFFFFF) hex codes.
 */
export const darkenHex = (hex: string, amount: number): string => { ... }
```

The function:
1. Parses hex to R, G, B components (handling 3-char shorthand)
2. Multiplies each channel by `(1 - amount)`
3. Clamps to [0, 255] and converts back to 6-char hex
4. Returns uppercase hex string (as verified by existing tests)

### Component Placement Rationale

The component lives in `client/src/components/MacroRings.tsx` (molecule), not in `particles/` (atom), because:

- It composes multiple SVG elements with layout logic (concentric rings, gap calculation)
- It has domain awareness (progress > 1.0 triggers overflow rendering)
- It is not a generic form/UI primitive
- It follows the same pattern as `BmiScale.tsx` -- a visual component with domain-specific rendering logic

Note: Unlike `BmiScale`, `MacroRings` does NOT internally use `useTheme()`. Colors are passed in via props, keeping the component a pure function of its inputs. This makes it testable without a ThemeProvider wrapper and reusable in different color contexts.

## Data Flow

```
useGoal() -----> goal.proteinGrams, goal.carbsGrams, goal.fatGrams
                          |
                          v
MyDayScreen -----> computes progress ratios (NO capping)
                          |
useDayStats() --> consumed.protein, consumed.carbs, consumed.fat
                          |
                          v
                   MacroRings (data=[
                     { label: "Protein", progress: consumed.protein / proteinGoal, color: colors.macroProtein },
                     { label: "Carbs",   progress: consumed.carbs / carbsGoal,     color: colors.macroCarb },
                     { label: "Fat",     progress: consumed.fat / fatGoal,         color: colors.macroFat },
                   ])
                          |
                          v
                   SVG renders rings with overflow arcs if progress > 1.0
```

Key change in MyDayScreen: remove `Math.min(..., 1)` from the progress calculations so the raw ratio flows through. The MacroRings component handles clamping internally (at 2.0 for visual display).

The legend section in MyDayScreen continues to display `Math.round(consumed.protein)/{proteinGoal}g` -- actual grams consumed vs. goal, which naturally shows overconsumption.

Optionally, the legend can also show percentage: `Math.round((consumed.protein / proteinGoal) * 100)%` -- uncapped, so "120%" is displayed when relevant.

## Trade-Off Analysis

### Decision 1: Custom SVG Component vs. Forking react-native-chart-kit

| | Option A: Custom SVG (react-native-svg) | Option B: Fork react-native-chart-kit |
|---|---|---|
| **Pros** | Full control over rendering; no dependency on unmaintained library; smaller bundle (only use what we need); existing test file already defines the API | Get all existing chart features for free; familiar API for other charts |
| **Cons** | Must implement from scratch (albeit simple SVG math); only handles ring charts | Must maintain a fork; library internals are complex; ProgressChart's SVG structure is opaque; still cannot cleanly add overflow arc layer |
| **Effort** | ~150 lines of new code | Fork setup + patching internal SVG rendering |
| **Reversibility** | Easy to replace later if a better library emerges | Hard to keep fork in sync with upstream |

**Recommendation**: Option A (Custom SVG). The required SVG is simple (circles with dash offsets), `react-native-svg` is already installed, and the existing test file defines a clean API. Forking a library for a single chart type is disproportionate.

### Decision 2: Component in `components/` vs. `particles/`

| | Option A: `components/MacroRings.tsx` | Option B: `particles/MacroRings.tsx` |
|---|---|---|
| **Pros** | Consistent with `BmiScale` pattern (domain-aware visual); clear molecule-level complexity | Reusable across the app as a generic ring chart |
| **Cons** | Cannot be imported from the particles barrel export | Would add domain logic (overflow) to the atom layer, violating the particles convention |

**Recommendation**: Option A (`components/`). The component has domain-specific overflow logic and composes multiple SVG elements. It is a molecule, not an atom. The existing test file already imports from `./MacroRings` within the components directory.

### Decision 3: Color Darkening Approach

| | Option A: Inline `darkenHex` utility in MacroRings.tsx | Option B: Add darker color tokens to theme |
|---|---|---|
| **Pros** | Self-contained; works with any color; no theme changes needed; already expected by the test file | Consistent with theme-based color consumption; pre-computed |
| **Cons** | Runtime computation (negligible); helper function in a component file | 6 new theme keys (dark variants for 3 macros x 2 themes); must keep in sync; only used by one component |

**Recommendation**: Option A (inline utility). The `darkenHex` function is a pure mathematical transform (multiply RGB channels by 0.75). Adding 6 theme tokens for a single component's overflow state is over-engineering. The test file already expects `darkenHex` to be exported from `MacroRings.tsx`.

### Decision 4: Legend Inside Component vs. in MyDayScreen

| | Option A: Legend stays in MyDayScreen | Option B: Legend rendered inside MacroRings |
|---|---|---|
| **Pros** | MacroRings stays focused on SVG rendering; legend formatting is screen-specific (e.g., "42/100g" format); easier to test SVG separately | Single import, self-contained chart+legend; less code in MyDayScreen |
| **Cons** | MyDayScreen must align legend colors with ring colors manually (already the case today) | MacroRings needs to know about gram values and goals (beyond its rendering scope); couples display formatting to SVG component; harder to reuse rings without legend |

**Recommendation**: Option A (legend stays in MyDayScreen). The MacroRings component should be a pure SVG renderer. The legend displays formatted text (`42/100g`, percentage labels) that requires data the ring component should not know about. This follows the existing pattern where MyDayScreen owns the legend layout (lines 316-332).

## Consequences

### Positive

- Users can visually distinguish "met goal" from "exceeded goal" -- the primary UX improvement
- The overflow arc (darker shade) is visually distinct without being alarming or confusing
- 200% cap prevents absurd visual states (e.g., 500% would just wrap the ring multiple times)
- The component is fully testable (existing test file covers all edge cases)
- No new dependencies; `react-native-svg` is already installed
- Removes dependency on `react-native-chart-kit`'s opaque `ProgressChart` for this screen
- The `darkenHex` utility is reusable if other components need darker color variants

### Negative

- Custom SVG code must be maintained (mitigated by comprehensive test coverage)
- Slight visual regression possible if the new rings do not pixel-match the old `ProgressChart` layout -- requires visual QA
- The `react-native-chart-kit` dependency remains in `package.json` (may still be used elsewhere or can be removed in a follow-up cleanup)

### Risks

- **SVG rendering inconsistency across platforms**: `react-native-svg` is well-tested on iOS and Android, but `strokeDasharray` rendering edge cases could appear. Mitigation: the existing test file verifies element counts and structure; visual testing on both platforms during development.
- **Accessibility**: SVG elements are not inherently accessible to screen readers. Mitigation: add `accessibilityLabel` to the top-level `<Svg>` element with a text summary (e.g., "Protein 120%, Carbs 80%, Fat 95%").
- **Performance**: Rendering 6-9 SVG circles is trivial compared to the `ProgressChart` which renders more complex SVG paths. No performance risk.

## Implementation Scope

### Files to Create (1)

| File | Lines (est.) | Responsibility |
|------|-------------|----------------|
| `client/src/components/MacroRings.tsx` | ~120-150 | SVG ring chart with overflow arcs + `darkenHex` utility |

### Files to Modify (1)

| File | Changes |
|------|---------|
| `client/src/screens/MyDayScreen.tsx` | Replace `ProgressChart` import with `MacroRings`; remove `Math.min` capping from progress calculations; remove `hexToRgba` utility; update chart rendering JSX (lines 300-315); optionally add percentage to legend |

### Files Already Done (1)

| File | Status |
|------|--------|
| `client/src/components/MacroRings.test.tsx` | Tests already written and define the component API |

### Verification

- `cd client && npx tsc --noEmit` -- type check passes
- `cd client && npm test` -- all existing tests pass, including `MacroRings.test.tsx`
- Visual inspection on iOS and Android simulators for both light and dark themes
- Verify overflow rendering with test data: 0%, 50%, 100%, 120%, 200%, 250% (should cap at 200%)

## Next Steps

Hand off to `planner` agent for implementation phases. The implementation is straightforward (2 files changed, 1 file created, tests pre-written) and should be a single-phase task delegated to `fe-developer`.
