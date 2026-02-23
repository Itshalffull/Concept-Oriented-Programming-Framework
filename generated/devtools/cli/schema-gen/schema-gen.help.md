# copf schema-gen — Help

Generate a ConceptManifest from **<source>** that provides typed action signatures, state schemas, and invariant test values for code generation.


> **When to use:** Use when generating ConceptManifests from parsed ASTs, implementing concept handlers, or inspecting the schema that drives code generation.


## Design Principles

- **One Handler per Action:** Each action in the concept spec maps to exactly one async method in the implementation handler.
- **Variant Completeness:** Every return variant declared in the spec must have a corresponding code path in the handler — no missing branches.
- **Storage Sovereignty:** Each concept owns its storage exclusively — no shared databases, no cross-concept state access.
**generate:**
- [ ] All action parameters have types?
- [ ] Return variants match spec declarations?
- [ ] State relations are correctly grouped?
- [ ] Type parameters are resolved?
## References

- [Implementation patterns and storage](references/implementation-patterns.md)
- [Spec-to-TypeScript type mapping rules](references/type-mapping.md)
## Quick Reference

| Spec Type | TypeScript Type | Notes |
|-----------|----------------|-------|
| String | string | Direct mapping |
| Int | number | Direct mapping |
| Bool | boolean | Direct mapping |
| list T | T[] | Array mapping |
| option T | T \| undefined | Optional mapping |
| set T | Set<T> or Map | Primary collection |


## Anti-Patterns

### Cross-concept storage access
Handler reads or writes another concept's storage — violates sovereignty.

**Bad:**
```
async create(input, storage) {
  const user = await userStorage.get(input.userId); // Wrong!
  // ...
}

```

**Good:**
```
async create(input, storage) {
  // userId is passed in — concept doesn't know where it came from
  const item = { id: generateId(), owner: input.userId };
  await storage.set(item.id, item);
  return { variant: 'ok', item: item.id };
}

```
## Validation

*Generate manifests from specs:*
```bash
npx tsx tools/copf-cli/src/index.ts generate
```
*Run schema generation tests:*
```bash
npx vitest run tests/schema-gen.test.ts
```
## Related Skills

- /concept-designer — Design concepts before implementing them
- /concept-validator — Validate specs before generating schemas
- /sync-designer — Wire implemented concepts together with syncs
