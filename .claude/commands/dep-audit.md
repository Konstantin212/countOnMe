---
description: Audit dependencies for security vulnerabilities and outdated packages
---

Run a dependency security audit for the CountOnMe project.

**Scope:** $ARGUMENTS (leave empty for both, or specify "client" / "backend")

## Checks to Run

### Client (client/)
1. **Security audit**: `cd client && pnpm audit` — check for known vulnerabilities
2. **Outdated packages**: `cd client && pnpm outdated` — identify stale dependencies
3. **Peer dependency warnings**: Check for mismatched peer dependencies (known issue: ESLint 10 vs eslint-config-expo)

### Backend (backend/)
1. **Python security**: `cd backend && pip-audit` (if available) or `cd backend && safety check` (if available)
2. **Static security analysis**: `cd backend && bandit -r app/ -ll` — scan for security anti-patterns
3. **Dependency pins**: Check `pyproject.toml` for unpinned dependencies (should use `>=X.Y,<X+1` ranges)

## Instructions

1. Run all applicable checks (client and backend in parallel if both)
2. Parse the output from each tool
3. If a tool is not installed, note it and skip
4. Group findings by severity

## Report Format

```
## Dependency Audit Report

### Client
- Vulnerabilities: X critical, Y high, Z moderate, W low
- Outdated: X packages (list major version bumps)
- Peer issues: (list any)

### Backend
- Vulnerabilities: X (list with severity)
- Bandit findings: X (list with confidence)
- Unpinned deps: X (list)

### Recommended Actions
1. [priority action]
2. [priority action]
```

If a tool is not available, suggest how to install it.
