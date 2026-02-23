# copf sync-parser — Help

Parse sync file **<source>** and validate its structure, variable bindings, and concept references against loaded manifests.


> **When to use:** Use when parsing and validating .sync files against loaded concept manifests. Catches variable binding errors, missing concept references, and parameter mismatches at parse time.


## Design Principles

- **Manifest-Aware Validation:** Sync validation cross-references concept manifests to verify that referenced actions and parameters actually exist.
- **Early Error Detection:** Catch variable binding mismatches and type errors at parse time, not at runtime when the sync fires.
**parse:**
- [ ] Sync file has valid when/then structure?
- [ ] All concept references resolve to loaded manifests?
- [ ] Variable bindings are consistent across clauses?
- [ ] Action parameters match concept action signatures?
- [ ] Sync mode (eager/eventual) is declared?
## References

- [Sync language reference](references/sync-design.md)
- [Common sync patterns and templates](references/sync-patterns.md)
## Supporting Materials

- [Sync validation walkthrough](examples/validate-a-sync.md)
## Quick Reference

| Element | Syntax | Purpose |
|---------|--------|---------|
| Sync declaration | `sync Name [mode] { ... }` | Define a synchronization rule |
| When clause | `Concept/action => variant[bindings]` | Pattern match on completion |
| Where clause | `Concept: { ?item field: ?val }` | Query concept state |
| Then clause | `Concept/action[params]` | Invoke target action |


## Anti-Patterns

### Unbound variable in then-clause
Then-clause uses a variable not bound in when or where — will fail at runtime.

**Bad:**
```
sync Broken [eager] {
  when { User/create => ok[user: ?u] }
  then { Email/send[to: ?email] }
}

```

**Good:**
```
sync Working [eager] {
  when { User/create => ok[user: ?u] }
  where { User: { ?u email: ?email } }
  then { Email/send[to: ?email] }
}

```
## Validation

*Parse all sync files:*
```bash
npx tsx tools/copf-cli/src/index.ts compile-syncs
```
*Run sync parser tests:*
```bash
npx vitest run tests/sync-parser.test.ts
```
## Related Skills

- /sync-designer — Compile validated sync rules into executables
- /concept-validator — Validate concept specs referenced by syncs
