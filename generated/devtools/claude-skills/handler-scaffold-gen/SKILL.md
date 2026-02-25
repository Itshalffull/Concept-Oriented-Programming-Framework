---
name: handler-scaffold-gen
description: Use when implementing a concept handler in TypeScript. Generates a .impl.ts handler with register(), typed action methods, input extraction, storage patterns, and a conformance test file.
argument-hint: --concept <ConceptName>
allowed-tools: Read, Write, Bash
---

# HandlerScaffoldGen

Scaffold a TypeScript handler for concept **$ARGUMENTS** with typed actions, storage patterns, and a conformance test.

> **When to use:** Use when implementing a concept handler in TypeScript. Generates a .impl.ts handler with register(), typed action methods, input extraction, storage patterns, and a conformance test file.

## Design Principles

- **One Handler per Action:** Each action in the concept spec maps to exactly one async method in the handler.
- **Variant Completeness:** Every return variant declared in the spec must have a corresponding code path — no missing branches.
- **Storage Sovereignty:** Each concept owns its storage exclusively — no shared databases, no cross-concept state access.
- **Input Extraction:** Extract inputs with `as` casts at the top of each method. Validate required fields before processing.

## Generation Pipeline

This scaffold generator participates in the COPF generation pipeline. The full flow is:

1. **Register** -- Generator self-registers with PluginRegistry and KindSystem (HandlerConfig → HandlerImpl).
2. **Track Input** -- Scaffold configuration is recorded as a Resource for change detection.
3. **Check Cache** -- BuildCache determines if regeneration is needed based on input hash.
4. **Preview** -- Dry-run via Emitter content-addressing shows what files would change.
5. **Generate** -- The actual handler implementation and conformance test are produced.
6. **Emit & Record** -- Files are written through Emitter with provenance; the run is recorded in GenerationPlan.

## Step-by-Step Process

### Step 1: Register Generator

Self-register with PluginRegistry so the scaffolding kit's KindSystem can track HandlerConfig → HandlerImpl transformations. Registers inputKind → outputKind transformation in KindSystem for pipeline validation.

**Examples:**
*Register the handler scaffold generator*
```typescript
const result = await handlerScaffoldGenHandler.register({}, storage);

```

### Step 2: Track Input via Resource

Register the scaffold configuration as a tracked resource using Resource/upsert. This enables change detection -- if the same configuration is provided again, Resource reports it as unchanged and downstream steps can be skipped.

**Pipeline:** `Resource/upsert(locator, kind: "HandlerConfig", digest)`

**Checklist:**
- [ ] Input configuration serialized deterministically?
- [ ] Resource locator uniquely identifies this scaffold request?

### Step 3: Check BuildCache

Query BuildCache/check to determine if this scaffold needs regeneration. If the input hash matches the last successful run and the transform is deterministic, the cached output can be reused without re-running the generator.

**Pipeline:** `BuildCache/check(stepKey: "HandlerScaffoldGen", inputHash, deterministic: true)`

**Checklist:**
- [ ] Cache hit returns previous output reference?
- [ ] Cache miss triggers full generation?

### Step 4: Preview Changes

Dry-run the generation using Emitter content-addressing to classify each output file as new, changed, or unchanged. No files are written -- this step shows what *would* happen.

**Pipeline:** `HandlerScaffoldGen/preview(...) → Emitter content-hash comparison`

**Examples:**
*Preview scaffold changes*
```bash
copf scaffold handler preview --concept User --actions create,update,delete
```

### Step 5: Generate Handler Implementation

Generate a TypeScript .impl.ts handler with register() action, typed action methods, input extraction, storage patterns, and an optional conformance test.

**Examples:**
*Generate a handler*
```bash
copf scaffold handler --concept User --actions create,update,delete
```
*Generate with test only*
```bash
copf scaffold handler --concept Article
```

**Checklist:**
- [ ] Handler export name follows convention (camelCase + 'Handler')?
- [ ] register() returns correct name, inputKind, outputKind?
- [ ] Each action extracts input parameters with correct types?
- [ ] Each action returns all declared variants?
- [ ] Storage operations use correct relation names?
- [ ] Error handling catches and wraps exceptions?
- [ ] Conformance test covers register() and each action?

### Step 6: Emit via Emitter & Record in GenerationPlan

Write generated files through Emitter/writeBatch with source provenance tracking. Then record the step outcome in GenerationPlan/recordStep for run history and status reporting.

**Pipeline:** `Emitter/writeBatch(files, sources) → GenerationPlan/recordStep(stepKey, status: "done")`

**Checklist:**
- [ ] All files written through Emitter (not directly to disk)?
- [ ] Source provenance attached to each file?
- [ ] Generation step recorded in GenerationPlan?

## References

- [Handler implementation patterns](references/handler-implementation-guide.md)

## Supporting Materials

- [Handler implementation scaffolding walkthrough](examples/scaffold-handler.md)

## Quick Reference

| Input | Type | Purpose |
|-------|------|---------|
| conceptName | String | PascalCase concept name |
| actions | list ActionDef | Action signatures with params and variants |
| inputKind | String | KindSystem input kind |
| outputKind | String | KindSystem output kind |
| capabilities | list String | Generator capabilities |


## Anti-Patterns

### Missing error variant
Handler doesn't return error variant on failure — caller gets an unstructured exception.

**Bad:**
```
async create(input, storage) {
  const id = crypto.randomUUID();
  await storage.put('items', id, { name: input.name });
  return { variant: 'ok', item: id };
  // Exception propagates raw if storage.put fails!
}
```

**Good:**
```
async create(input, storage) {
  try {
    const id = crypto.randomUUID();
    await storage.put('items', id, { name: input.name });
    return { variant: 'ok', item: id };
  } catch (err) {
    return { variant: 'error', message: String(err) };
  }
}
```

## Validation

*Generate a handler scaffold:*
```bash
npx tsx tools/copf-cli/src/index.ts scaffold handler --concept User --actions create,update,delete
```
*Run generated conformance test:*
```bash
npx vitest run tests/user.conformance.test.ts
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```

## Related Skills

| Skill | When to Use |
| --- | --- |
| concept-scaffold | Generate concept specs before implementing handlers |
| implementation-builder | Use SchemaGen for more advanced handler generation |
| concept-validator | Validate concept specs before generating handlers |
| `/emitter` | Write scaffold files with content-addressing and source traceability |
| `/build-cache` | Skip unchanged scaffolds via incremental build cache |
| `/resource` | Track scaffold input configurations for change detection |
| `/generation-plan` | Monitor scaffold generation runs and status |
| `/kind-system` | Validate scaffold input/output kind transformations |

