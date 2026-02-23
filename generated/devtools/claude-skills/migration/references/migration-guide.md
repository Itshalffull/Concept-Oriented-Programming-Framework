# Migration Planning and Execution Guide

When a concept's spec changes (new state fields, renamed actions,
changed types), stored data must be migrated to match.

## Migration Workflow

1. **Detect** — Compare current spec version against stored schema version.
2. **Plan** — Generate migration steps from the schema diff.
3. **Dry-run** — Validate the plan against a copy of stored data.
4. **Apply** — Execute the migration, transforming stored state.
5. **Verify** — Confirm the new schema matches the updated spec.

## Schema Diff Types

| Change | Migration Action | Risk |
|--------|-----------------|------|
| Add field (optional) | Set default value | Low |
| Add field (required) | Compute or prompt for value | Medium |
| Remove field | Drop column/key | Low (data loss) |
| Rename field | Copy + drop | Medium |
| Change type | Transform values | High |
| Add action | No migration needed | None |
| Remove action | No migration needed | None |

## Rollback Strategy

Every migration step should be reversible:

```yaml
migration:
  steps:
    - action: addField
      concept: User
      field: displayName
      type: String
      default: ""
      rollback: removeField
```

## Commands

| Command | Purpose |
|---------|---------|
| `copf migrate --status` | Show current schema versions |
| `copf migrate --plan` | Preview planned migration steps |
| `copf migrate --dry-run` | Test migration without applying |
| `copf migrate --apply` | Execute the migration |

## Safety Rules

- Always create a backup before applying.
- Run `--dry-run` before `--apply` on production data.
- Never skip schema versions — migrations are sequential.
- Version-gate startup: concepts refuse to start if schema is outdated.
