---
description: Validate Alembic migration safety before applying
---

Check the latest Alembic migration(s) for safety issues before applying.

**Scope:** $ARGUMENTS (leave empty to check latest migration, or specify a migration file path)

## Checks to Run

1. **Model-migration sync**: Run `cd backend && alembic check` to verify models match migrations
2. **Dangerous operations**: Scan migration file(s) for:
   - `DROP TABLE` / `drop_table` — data loss
   - `DROP COLUMN` / `drop_column` — data loss
   - `ALTER TYPE ... DROP VALUE` — enum value removal
   - Non-nullable column additions without `server_default`
3. **Downgrade support**: Verify `downgrade()` function is not empty or just `pass`
4. **Enum changes**: Check for `ALTER TYPE ... ADD VALUE` (requires manual migration, not autogenerate)
5. **Index safety**: Check for `CREATE INDEX` without `CONCURRENTLY` on large tables

## Instructions

1. Find the latest migration file(s) in `backend/alembic/versions/`
2. Read the migration and scan for patterns above
3. Cross-reference with the ORM models in `backend/app/models/`
4. Run `alembic check` if possible

## Report Format

```
## Migration Safety Report

### Migration: [revision_id] — [description]

### Safety Assessment: SAFE / CAUTION / DANGER

### Findings
- [DANGER] DROP TABLE detected: table_name (line X)
- [CAUTION] Non-nullable column added without default: column_name (line X)
- [OK] Downgrade function present and non-empty
- [OK] No enum type changes

### Recommendations
1. [action to take]
```
