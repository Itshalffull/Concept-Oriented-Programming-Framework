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

## Generation Pipeline

This scaffold generator participates in the COPF generation pipeline. The full flow is:

1. **Register** -- Generator self-registers with PluginRegistry and KindSystem (ConceptConfig → ConceptSpec).
2. **Track Input** -- Scaffold configuration is recorded as a Resource for change detection.
3. **Check Cache** -- BuildCache determines if regeneration is needed based on input hash.
4. **Preview** -- Dry-run via Emitter content-addressing shows what files would change.
5. **Generate** -- The actual concept specification file is produced.
6. **Emit & Record** -- Files are written through Emitter with provenance; the run is recorded in GenerationPlan.

## Step-by-Step Process

### Step 1: Register Generator

Self-register with PluginRegistry so the scaffolding kit's KindSystem can track ConceptConfig → ConceptSpec transformations. Registers inputKind → outputKind transformation in KindSystem for pipeline validation.

**Examples:**
*Register the concept scaffold generator*
```typescript
const result = await conceptScaffoldGenHandler.register({}, storage);

```

### Step 2: Track Input via Resource

Register the scaffold configuration as a tracked resource using Resource/upsert. This enables change detection -- if the same configuration is provided again, Resource reports it as unchanged and downstream steps can be skipped.

**Pipeline:** `Resource/upsert(locator, kind: "ConceptConfig", digest)`

**Checklist:**
- [ ] Input configuration serialized deterministically?
- [ ] Resource locator uniquely identifies this scaffold request?

### Step 3: Check BuildCache

Query BuildCache/check to determine if this scaffold needs regeneration. If the input hash matches the last successful run and the transform is deterministic, the cached output can be reused without re-running the generator.

**Pipeline:** `BuildCache/check(stepKey: "ConceptScaffoldGen", inputHash, deterministic: true)`

**Checklist:**
- [ ] Cache hit returns previous output reference?
- [ ] Cache miss triggers full generation?

### Step 4: Preview Changes

Dry-run the generation using Emitter content-addressing to classify each output file as new, changed, or unchanged. No files are written -- this step shows what *would* happen.

**Pipeline:** `ConceptScaffoldGen/preview(...) → Emitter content-hash comparison`

**Examples:**
*Preview scaffold changes*
```bash
copf scaffold concept preview --name User --actions create,update,delete
```

### Step 5: Generate Concept Spec

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

### Step 6: Emit via Emitter & Record in GenerationPlan

Write generated files through Emitter/writeBatch with source provenance tracking. Then record the step outcome in GenerationPlan/recordStep for run history and status reporting.

**Pipeline:** `Emitter/writeBatch(files, sources) → GenerationPlan/recordStep(stepKey, status: "done")`

**Checklist:**
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
| `/emitter` | Write scaffold files with content-addressing and source traceability |
| `/build-cache` | Skip unchanged scaffolds via incremental build cache |
| `/resource` | Track scaffold input configurations for change detection |
| `/generation-plan` | Monitor scaffold generation runs and status |
| `/kind-system` | Validate scaffold input/output kind transformations |

