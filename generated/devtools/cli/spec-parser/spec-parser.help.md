# copf spec-parser — Help

Parse and validate concept spec **<source>** to verify syntax, structure, and adherence to Jackson's concept design methodology.


> **When to use:** Use when designing, creating, or validating concept specs following Jackson's methodology. Covers purpose articulation, state design, action design, invariant writing, and spec syntax validation.


## Design Principles

- **Spec as Source of Truth:** The .concept file is the single authoritative definition — all generated code, tests, and documentation derive from it.
- **Fail Fast on Ambiguity:** Parser rejects specs with ambiguous state relations or incomplete action signatures rather than guessing intent.
**parse:**
- [ ] Has purpose block?
- [ ] Actions have at least one variant?
- [ ] Invariants reference valid actions?
- [ ] Type parameters declared and used?
## References

- [Concept grammar reference](references/concept-grammar.md)
- [Jackson's concept design methodology](references/jackson-methodology.md)
## Supporting Materials

- [End-to-end concept design walkthrough](examples/design-a-concept.md)
## Quick Reference

| Action | Command | Purpose |
|--------|---------|---------|
| parse | `copf check <file>` | Validate concept spec syntax and structure |


## Example Walkthroughs

For complete examples with design rationale:

- [Design a concept from scratch (Bookmark example)](examples/design-a-concept.md)
## Anti-Patterns

### Missing purpose block
Concept spec has no purpose — impossible to evaluate design quality.

**Bad:**
```
concept User [U] {
  state { users: set U; name: U -> String }
  actions { action create(name: String) { -> ok(user: U) { Created. } } }
}

```

**Good:**
```
concept User [U] {
  purpose { Manage user identity and profile information. }
  state { users: set U; name: U -> String }
  actions { action create(name: String) { -> ok(user: U) { Created. } } }
}

```

### Untyped action parameters
Action parameters lack types — generated code will use 'any'.

**Bad:**
```
action create(name, email) { -> ok(user: U) { Created. } }

```

**Good:**
```
action create(name: String, email: String) { -> ok(user: U) { Created. } }

```
## Validation

*Parse and validate all concept specs:*
```bash
npx tsx tools/copf-cli/src/index.ts check
```
*Run parser tests:*
```bash
npx vitest run tests/spec-parser.test.ts
```
## Related Skills

- /concept-designer — Design new concepts following Jackson's methodology
- /implementation-builder — Write handlers that implement concept actions
- /sync-designer — Write syncs that connect concepts together
