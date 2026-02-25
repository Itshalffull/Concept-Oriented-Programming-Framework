---
name: concept-scaffold-gen
description: Use when creating a new concept specification from scratch. Generates a .concept file with purpose, state, actions, variants, invariants, and a register() action following Jackson's methodology.
argument-hint: --name <ConceptName>
allowed-tools: Read, Write, Bash
---

# ConceptScaffoldGen

Scaffold a concept spec for **$ARGUMENTS** with state declarations, typed action signatures, and a register() action.

> **When to use:** Use when creating a new concept specification from scratch. Generates a .concept file with purpose, state, actions, variants, invariants, and a register() action following Jackson's methodology.

## Design Principles

- **Singularity:** Each concept serves exactly one purpose — if the purpose has 'and', it's two concepts.
- **Independence:** A concept never references another concept's types or calls another concept's actions. Use type parameters and syncs.
- **Sufficiency & Necessity:** Every state field is needed by at least one action. Every action serves the concept's purpose. No dead state.
- **Invariant Completeness:** Key properties are captured as formal invariants documenting what must be true after each action.

## Step-by-Step Process

### Step 1: Register Generator

Self-register with PluginRegistry so the scaffolding kit's KindSystem can track ConceptConfig → ConceptSpec transformations.

**Examples:**
*Register the concept scaffold generator*
```typescript
const result = await conceptScaffoldGenHandler.register({}, storage);

```

### Step 2: Generate Concept Spec

Generate a .concept specification file with purpose block, typed state declarations, action signatures with variants, and a register() action for PluginRegistry discovery.

**Examples:**
*Generate a basic concept*
```bash
copf scaffold concept --name User --actions create,update,delete
```
*Generate with custom state*
```bash
copf scaffold concept --name Article --param A --category domain
```

**Checklist:**
- [ ] Concept name is PascalCase?
- [ ] Type parameter is a single capital letter?
- [ ] Purpose block describes why, not what?
- [ ] State fields use correct relation types (set, ->, option, list)?
- [ ] Every action has at least one variant?
- [ ] register() action is included for PluginRegistry?
- [ ] Annotations (@category, @visibility) are present?

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
| stateFields | list StateField | State declarations |
| actions | list ActionDef | Action signatures with variants |


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
  -> ok(user: U) { Created. }
  -> duplicate(name: String) { Name taken. }
  -> error(message: String) { Failed. }
}
```

## Validation

*Generate a concept scaffold:*
```bash
npx tsx tools/copf-cli/src/index.ts scaffold concept --name User --actions create,update,delete
```
*Validate generated concept:*
```bash
npx tsx tools/copf-cli/src/index.ts check specs/app/user.concept
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```

## Related Skills

| Skill | When to Use |
| --- | --- |
| concept-designer | Design concepts using Jackson's methodology before generating |
| handler-scaffold | Generate handler implementations for the concept |
| sync-scaffold | Generate sync rules connecting the concept |

