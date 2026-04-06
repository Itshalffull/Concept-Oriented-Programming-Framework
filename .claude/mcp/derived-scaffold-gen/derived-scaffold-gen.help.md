# derived_scaffold_gen — MCP Tool Guide

Scaffold a derived concept spec for **{input}** with composes block, syncs boundary, surface actions/queries, and principle.


> **When to use:** Use when creating a new derived concept specification from scratch. Generates a .derived file with purpose, composes, syncs boundary, surface actions/queries, and operational principle.


## Design Principles

- **No Independent State:** A derived concept deliberately fails the concept test — it has no state of its own. All state is held by composed concepts.
- **Semantic Boundary:** Only syncs that are semantically inside the derived concept are claimed. derivedContext tags only propagate through claimed syncs.
- **Emergent Purpose:** The purpose describes the emergent value of the composition, not just 'groups X and Y'. If there's no emergent purpose, use a suite.
- **Hierarchical Composition:** Derived concepts can compose other derived concepts using the derived keyword. The composition graph must be a DAG.
- **Single-Line Queries:** Surface queries MUST be on a single line — the `->` arrow must appear on the same line as the closing `)` of the parameter list. The derived parser does not call skipSeps() before expecting ARROW, so a newline between `)` and `->` produces a parse error. Write: `query name(p: T) -> Concept/action(p: p)` NOT `query name(p: T)\n  -> Concept/action(p: p)`.
- **Principle Uses after/then/and Syntax:** The principle block MUST use `after surfaceAction(arg: value)` / `then description` / `and description` syntax. Prose-style principles like `"Name": description` cause parse errors — the parser expects the keyword `after` or `then`, not a quoted string.
**generate:**
- [ ] Derived concept name is PascalCase?
- [ ] Type parameters are single capital letters?
- [ ] Purpose block describes emergent value, not mechanics?
- [ ] All composed concepts exist (or are marked derived)?
- [ ] Syncs list only includes semantically-inside sync names?
- [ ] Surface actions have valid matches clauses?
- [ ] Surface queries delegate to real concept actions?
- [ ] Principle uses surface action/query names, not primitive concept names?
- [ ] Composition graph is a DAG (no cycles)?
- [ ] Type parameters unify correctly across composed concepts?
- [ ] All surface queries are on a SINGLE LINE (no newline before ->)?
- [ ] Principle block uses after/then/and syntax (NOT prose-style quoted strings)?
## References

- [Derived concept writing guide](references/derived-concept-guide.md)
## Supporting Materials

- [Derived concept scaffolding walkthrough](examples/scaffold-derived.md)
## Quick Reference

| Input | Type | Purpose |
|-------|------|---------|
| name | String | PascalCase derived concept name |
| typeParams | list String | Type parameter letters (e.g., ["T"]) |
| purpose | String | Emergent purpose prose |
| composes | list ComposesEntry | Concepts and derived concepts |
| syncs | list String | Sync names inside the boundary |
| surfaceActions | list SurfaceAction | Actions with matches clauses |
| surfaceQueries | list SurfaceQuery | Queries delegating to concepts |
| principle | list String | Operational principle steps |


## Anti-Patterns

### Derived concept with independent state
If the abstraction needs its own state, it should be a concept, not a derived concept.

**Bad:**
```
derived TaskBoard [T] {
  state { columns: set String }  // ERROR: derived concepts have no state
  ...
}

```

**Good:**
```
derived TaskBoard [T] {
  composes { Task [T], Column [T], Assignment [T] }
  ...
}

```

### Over-claiming syncs
Claiming syncs that serve a different purpose (audit, search indexing) leaks derivedContext tags.

**Bad:**
```
syncs { required: [trash-delete, trash-restore, audit-log-record, search-update] }

```

**Good:**
```
syncs { required: [trash-delete, trash-restore] }

```
## Validation

*Generate a derived concept scaffold:*
```bash
npx tsx cli/src/index.ts scaffold derived --name Trash --composes Folder,Label
```
*Validate derived concept:*
```bash
npx vitest run tests/derived-concepts.test.ts
```
**Related tools:** [object Object], [object Object], [object Object]

