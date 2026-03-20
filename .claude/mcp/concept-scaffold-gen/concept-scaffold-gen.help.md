# concept_scaffold_gen — MCP Tool Guide

Scaffold a concept spec for **{input}** with annotations, state declarations (groups, enums, records), typed action signatures, capabilities, and a register() action.


> **When to use:** Use when creating a new concept specification from scratch. Generates a .concept file with annotations (@version, @category, @visibility, @gate), purpose, state (with groups, enum types, record types), actions with typed variants, invariants, capabilities block, and a register() action following Jackson's methodology.


## Design Principles

- **Singularity:** Each concept serves exactly one purpose — if the purpose has 'and', it's two concepts.
- **Independence:** A concept never references another concept's types or calls another concept's actions. Use type parameters and syncs.
- **Sufficiency & Necessity:** Every state field is needed by at least one action. Every action serves the concept's purpose. No dead state.
- **Invariant Completeness:** Use all six invariant constructs comprehensively: example (named tests), forall (quantified properties), always (state predicates), never (safety), eventually (liveness), action requires/ensures (contracts). Cover core purpose, error paths, constraints, state transitions, and boundary conditions. Aim for 2-5 invariants per concept.
- **Description Quality:** Every variant description must explain the outcome in domain terms — never echo the variant name ('Created.') or use vague text ('Failed.'). Error variants explain what went wrong; ok variants explain what is now true.
**generate:**
- [ ] Concept name is PascalCase?
- [ ] Type parameter is a single capital letter?
- [ ] Purpose block describes why, not what?
- [ ] State fields use correct relation types (set, ->, option, list)?
- [ ] Every action has at least one variant?
- [ ] register() action is included for PluginRegistry?
- [ ] Annotations (@category, @visibility) are present?
- [ ] @version annotation included if this is a versioned spec?
- [ ] State fields use enum types for fixed value sets?
- [ ] State groups organize related fields?
- [ ] Capabilities block present for generator/plugin concepts?
- [ ] Variant descriptions explain outcomes, not just echo variant names?
- [ ] All files written through Emitter (not directly to disk)?
- [ ] Source provenance attached to each file?
- [ ] Generation step recorded in GenerationPlan?
## References

- [Concept specification writing guide](references/concept-spec-guide.md)
## Supporting Materials

- [Concept spec scaffolding walkthrough](examples/scaffold-concept.md)
## Quick Reference

| Input | Type | Purpose |
|-------|------|---------|
| name | String | PascalCase concept name |
| typeParam | String | Type parameter letter (default: T) |
| purpose | String | Purpose description |
| category | String | Annotation category (domain, devtools, etc.) |
| version | Int | @version annotation number |
| gate | Bool | @gate annotation for async gates |
| stateFields | list StateField | State declarations (with group, enum, record support) |
| actions | list ActionDef | Action signatures with variants |
| capabilities | list String | Capabilities block entries |
| invariants | list String | Invariant steps |


## Anti-Patterns

### Purpose describes implementation
Purpose block says how the concept works instead of why it exists.

**Bad:**
```
purpose {
  Store users in a Map<string, User> and provide CRUD operations
  via async handler methods.
}

```

**Good:**
```
purpose {
  Manage user identity and profile information.
}

```

### Missing variants
Action only has ok variant — no error handling path.

**Bad:**
```
action create(name: String) {
  -> ok(user: U) { Created. }
}

```

**Good:**
```
action create(name: String) {
  -> ok(user: U) { New user registered and ready for profile setup. }
  -> duplicate(name: String) { A user with this name already exists. }
  -> error(message: String) { Creation failed due to a storage or validation error. }
}

```

### Terse or echo descriptions
Variant descriptions that echo the variant name or use a single generic word — they tell the reader nothing about the actual outcome.

**Bad:**
```
action create(name: String) {
  -> ok(user: U) { Created. }
  -> error(message: String) { Failed. }
}

```

**Good:**
```
action create(name: String) {
  -> ok(user: U) { New user registered and ready for authentication setup. }
  -> error(message: String) { Creation failed due to a storage or validation error. }
}

```
## Validation

*Generate a concept scaffold:*
```bash
npx tsx cli/src/index.ts scaffold concept --name User --actions create,update,delete
```
*Validate generated concept:*
```bash
npx tsx cli/src/index.ts check specs/app/user.concept
```
*Generate tests from invariants:*
```bash
npx tsx cli/src/index.ts test-gen --concept User --language typescript
```
*Run generated invariant tests:*
```bash
npx vitest run generated/tests/User.*
```
*Check invariant coverage:*
```bash
npx tsx cli/src/index.ts test-gen --coverage --concept User
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```
**Related tools:** [object Object], [object Object], [object Object], [object Object]

