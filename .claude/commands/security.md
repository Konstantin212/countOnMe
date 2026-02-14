---
description: Run security audit (secrets, injection, OWASP, device scoping)
---

Run a security audit on the CountOnMe project.

**Scope:** $ARGUMENTS

## Scan Areas

1. **Secrets** — Grep for hardcoded API keys, passwords, tokens in source code
2. **Injection** — Check that all DB queries use SQLAlchemy ORM (no raw SQL)
3. **Device Scoping** — Verify ALL backend queries filter by device_id
4. **Auth** — Tokens hashed with bcrypt, invalid tokens return 401
5. **Input Validation** — Pydantic (backend) and Zod (client) on all inputs
6. **Dependencies** — `npm audit` (client), `pip-audit` / `bandit` (backend)
7. **Data Exposure** — No sensitive data in logs, error messages, or responses

## CountOnMe Critical Checks

- Every backend query MUST filter by `device_id`
- Cross-device access MUST return 404 (not 403)
- Soft-deleted items MUST be excluded from queries
- Device tokens MUST be hashed before storage
- No `console.log` with sensitive data in client

## Report Format

Report findings by severity: Critical → High → Medium → Low.
Include file:line references and specific fix suggestions.
