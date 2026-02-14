---
description: Create named git checkpoint with SHA
---

Create a named git checkpoint for the current state of the codebase.

**Name:** $ARGUMENTS

## Instructions

1. Run `git status` to check for changes
2. If there are no changes, report "Nothing to checkpoint" and stop
3. Stage all changes: `git add -A`
4. Create commit with message: `checkpoint: $ARGUMENTS`
5. Get the commit SHA: `git rev-parse --short HEAD`
6. Report the SHA and rollback command: `git reset --soft <SHA>^`

## Rules

- Always include all changes (tracked and untracked)
- Never push — checkpoints are local only
- Format: `checkpoint: <name>` (not conventional commit type)
