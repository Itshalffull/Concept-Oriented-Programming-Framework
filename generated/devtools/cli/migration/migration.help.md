# copf migration — Help

Plan and apply schema migration for **<source>**, transforming stored state from the previous version to the current spec version.


> **When to use:** Use when concept schemas have changed and stored state needs to be migrated to match the new version. Covers migration planning, dry-run validation, and execution.


## Design Principles

- **Version Gating:** A concept cannot start until its storage schema matches its current spec version — the migration concept gates startup.
- **Reversible by Default:** Every migration step should have a corresponding rollback step — data transformations should be invertible.
**plan:**
- [ ] Schema diff shows expected changes?
- [ ] No data loss in state transformations?
- [ ] Rollback strategy identified?

**apply:**
- [ ] Backup created before applying?
- [ ] Migration ran to completion?
- [ ] Post-migration validation passed?
## References

- [Migration planning and execution guide](references/migration-guide.md)
## Supporting Materials

- [Migration execution walkthrough](examples/run-a-migration.md)
## Quick Reference

| Action | Command | Purpose |
|--------|---------|---------|
| plan | `copf migrate --plan` | Show planned migration steps |
| apply | `copf migrate --apply` | Execute migration |
| status | `copf migrate --status` | Check current schema versions |


## Validation

*Check migration status:*
```bash
npx tsx tools/copf-cli/src/index.ts migrate --status
```
*Run migration dry-run:*
```bash
npx tsx tools/copf-cli/src/index.ts migrate --dry-run
```
## Related Skills

- /concept-validator — Validate the updated concept spec
- /implementation-builder — Update the handler implementation after schema change
- /deployment-config — Re-validate deployment after migration
