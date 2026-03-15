---
type: adr
status: accepted
last-updated: 2026-03-15
related-features:
  - goal-system
---

# ADR-002: Macro Rings with Overconsumption Visualization

## Status

Implemented

## Context

The MyDay screen uses `react-native-chart-kit`'s `ProgressChart` to display macro balance as concentric ring charts. The current implementation caps all progress values at 1.0:

```typescript
const proteinProgress = Math.min(consumed.protein / proteinGoal, 1);
```

When a user consumes 120% of their protein goal, the ring looks identical to 100%. There is no visual distinction between "exactly met" and "exceeded" — a critical UX gap for a calorie tracking app.

`react-native-chart-kit`'s `ProgressChart` renders its own SVG internally, making it impossible to overlay an overflow arc without forking the library.

A test file already exists at `client/src/components/MacroRings.test.tsx` defining the expected component API.

## Decision

Replace `react-native-chart-kit`'s `ProgressChart` with a custom `MacroRings` SVG component built on `react-native-svg` (already installed at v15.12.1):

1. Values 0-100% render a single colored arc on a faded track.
2. Values 100-200% render a full base arc plus a second overflow arc in a darker shade, starting from 12 o'clock.
3. Values above 200% are visually capped at 200%.
4. The legend displays actual uncapped percentage values.

**Files changed:**
- New: `client/src/components/MacroRings.tsx`
- Modified: `client/src/screens/MyDayScreen.tsx` — remove `Math.min` capping, replace `ProgressChart`, remove `hexToRgba`

## Component Design

```typescript
type MacroRingDatum = {
  label: string;    // e.g. "Protein"
  progress: number; // ratio, uncapped from caller (1.5 = 150%)
  color: string;    // hex color
};
type MacroRingsProps = {
  data: MacroRingDatum[];
  size?: number;        // SVG viewBox size (default: 220)
  strokeWidth?: number; // ring thickness (default: 12)
  baseRadius?: number;  // outermost ring radius (default: 44)
  ringGap?: number;     // gap between rings (default: 20)
};
```

Each ring renders up to 3 SVG `<Circle>` elements: background track (0.2 opacity), main arc (0–100%), and overflow arc (>100%, darker shade). Arc length is controlled via `strokeDasharray`/`strokeDashoffset`. Rings are rotated -90° so arcs start at 12 o'clock.

The `darkenHex(hex, amount)` utility is co-located in `MacroRings.tsx` and exported (tested independently). Colors are passed via props — the component does not call `useTheme()`, keeping it a pure function of its inputs.

The macro legend stays in `MyDayScreen` (not inside `MacroRings`) — it displays formatted text (`42/100g`, percentage labels) that requires data the ring component should not own.

## Trade-Off Analysis

### Custom SVG vs. Forking react-native-chart-kit

Custom SVG wins: the SVG is simple (circles with dash offsets), `react-native-svg` is already installed, and the test file defines a clean API. Forking a library for a single chart type is disproportionate. Forking also still cannot cleanly add an overflow arc layer given the library's opaque SVG internals.

### Component in `components/` vs. `particles/`

`components/` wins: `MacroRings` has domain-specific overflow logic and composes multiple SVG elements. It is a molecule, not an atom. Consistent with `BmiScale.tsx`. The existing test file imports from `./MacroRings` within the components directory.

### Inline `darkenHex` vs. Theme Tokens

Inline `darkenHex` wins: it is a pure mathematical transform (multiply RGB channels by 0.75). Adding 6 theme tokens (dark variants for 3 macros × 2 themes) for a single component's overflow state is over-engineering. The test file already expects `darkenHex` exported from `MacroRings.tsx`.

## Data Flow

```
useGoal() -------> goal.proteinGrams, goal.carbsGrams, goal.fatGrams
useDayStats() ---> consumed.protein, consumed.carbs, consumed.fat
                           |
                   MyDayScreen computes progress ratios (NO capping)
                           |
                   MacroRings renders rings; handles 200% visual cap
```

## Consequences

### Positive

- Users can visually distinguish "met goal" from "exceeded goal".
- Component is fully testable; existing `MacroRings.test.tsx` covers all edge cases.
- No new dependencies; `react-native-svg` already installed.
- Removes dependency on `react-native-chart-kit`'s opaque `ProgressChart`.

### Negative

- Custom SVG code must be maintained (mitigated by test coverage).
- `react-native-chart-kit` may remain in `package.json` if used elsewhere.

### Risks

- **SVG rendering inconsistency**: `strokeDasharray` edge cases on iOS/Android. Mitigated by existing test coverage and visual QA on both platforms.
- **Accessibility**: SVG elements need `accessibilityLabel` on the top-level `<Svg>` (e.g., "Protein 120%, Carbs 80%, Fat 95%").
