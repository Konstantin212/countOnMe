# AGENTS.md

## Purpose
You are working in the CountOnMe React Native (Expo + TypeScript) repo.
Your job is to help implement features *and* keep code style consistent.
Before **any** commit-related help (commit prep, PR prep, “ready to push”, etc.),
you must verify styling and fix violations.

---

## Code Style Rules (authoritative)
Follow existing repo configs first:
- If `.eslintrc*`, `.prettierrc*`, `biome.json`, or `tsconfig.json` exist, treat them as the source of truth.
- Do **not** introduce new style rules unless explicitly asked.

Project conventions:
- TypeScript for all new/modified files.
- React Native functional components + hooks only. No class components.
- Use `StyleSheet.create(...)` for styles. Avoid large inline style objects.
- Prefer explicit types over `any`. If you must use `any`, explain why in the PR/commit notes.
- Keep business logic out of screens; put math and pure logic in `src/utils`.
- Keep persistence access in `src/storage` only.
- Comments must be in English.

### Theme System
- **ALWAYS use theme colors** via `useTheme()` hook. Never hardcode color hex values.
- Import theme: `import { useTheme } from '../hooks/useTheme';`
- Get colors: `const { colors } = useTheme();`
- Move `StyleSheet.create()` inside components to access theme colors dynamically
- Use semantic color names: `colors.background`, `colors.text`, `colors.primary`, etc.
- Theme supports light and dark modes with system preference detection
- Available color tokens: See `src/theme/colors.ts` for complete list

Example:
```typescript
const MyComponent = () => {
  const { colors } = useTheme();
  
  const styles = StyleSheet.create({
    container: { backgroundColor: colors.background },
    text: { color: colors.text },
    button: { backgroundColor: colors.primary },
  });
  
  return <View style={styles.container}>...</View>;
};
```

---

## Pre-Commit Verification Workflow (mandatory)
Whenever the user asks you to:
- “prepare a commit”
- “check before committing”
- “review changes”
- “make a PR”
- or anything that implies code is going to be committed

You MUST do the following in order:

1) **Inspect changes**
- Run `git status` and `git diff` to understand which files are being committed.
- If there are generated/build artifacts staged accidentally, tell the user to unstage them.

2) **Run style / quality checks**
Use the project’s package manager:
- If `pnpm-lock.yaml` exists → use `pnpm`.
- Else if `yarn.lock` exists → use `yarn`.
- Else → use `npm`.

Then run these scripts if they exist in `package.json`:
- `lint` (required)
- `format:check` or `prettier:check` (if present)
- `typecheck` or `tsc` (if present)
- `test` (if present and fast)

Examples of what to run:
- `pnpm lint`
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm test`

If a script is missing, do not invent one. Move on.

3) **Handle failures**
- If any check fails, stop and fix the code.
- After fixes, rerun the failed checks.
- Repeat until all pass.

4) **Summarize outcome**
Provide a short report:
- What checks were run.
- What failed (if anything) and how you fixed it.
- Confirmation that everything passes.

5) **Commit message help**
When everything passes, propose a commit message in this format:
- `feat: ...` for new user-visible features
- `fix: ...` for bug fixes
- `chore: ...` for refactors/tooling
- `docs: ...` for markdown/docs only
Keep it short and specific.

---

## What NOT to do
- Do not say “looks fine” without running checks (or clearly stating why checks can’t be run).
- Do not reformat unrelated files just because you noticed style issues.
- Do not add new dependencies to “solve” style unless the user asked.

---

## If you can’t run commands here
If the environment doesn’t allow command execution:
- Explain which commands the user should run locally.
- Still review diffs and point out styling issues you can see.
- Do not claim checks passed.

---

## Output expectations
- Be direct and precise.
- If something violates style, name the file and line range if possible.
- Prefer actionable fixes over theory.
