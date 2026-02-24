# copf kind-system — Help

Inspect the generation pipeline topology for **<source>** showing IR kinds, transform edges, and routing paths.


> **When to use:** Use when inspecting the IR kind taxonomy, finding transform paths between kinds, or querying which generators consume or produce a kind.


## Design Principles

- **Cycle-Free DAG:** The kind graph must be a directed acyclic graph. Cycle detection runs on every connect() call.
- **Static Topology:** Kinds and edges are registered at startup from kit.yaml metadata, not at generation time.
**graph:**
- [ ] All generator kinds registered?
- [ ] No orphan kinds (unreachable from any source)?

**route:**
- [ ] Path exists between the two kinds?
## References

- [KindSystem taxonomy and routing](references/kind-system-architecture.md)
## Quick Reference

| Action | Command | Purpose |
|--------|---------|---------|
| graph | `copf kind-system graph` | Show full kind taxonomy |
| route | `copf kind-system route` | Find shortest transform path |
| consumers | `copf kind-system consumers` | What consumes a kind |
| producers | `copf kind-system producers` | What produces a kind |
| define | `copf kind-system define` | Register a new kind |
| connect | `copf kind-system connect` | Declare a transform edge |
| validate | `copf kind-system validate` | Validate an edge |
| dependents | `copf kind-system dependents` | List downstream kinds |


## Validation

*List all kinds:*
```bash
npx tsx tools/copf-cli/src/index.ts kinds list
```
*Find transform path:*
```bash
npx tsx tools/copf-cli/src/index.ts kinds path ConceptDSL TypeScriptFiles
```
## Related Skills

- /incremental-caching — Kind graph drives cascade invalidation
- /file-emission — Kind routing determines generation order
