---
name: sync-scaffold-gen
description: Use when creating a new sync rule to connect concepts. Generates a .sync file with when/where/then clauses from trigger and effect configurations.
argument-hint: --name <SyncName>
allowed-tools: Read, Write, Bash
---

# SyncScaffoldGen

Scaffold a sync rule **$ARGUMENTS** with trigger patterns, guard conditions, and effect actions.

> **When to use:** Use when creating a new sync rule to connect concepts. Generates a .sync file with when/where/then clauses from trigger and effect configurations.

## Design Principles

- **Declarative Wiring:** Syncs declare what happens when — they never contain imperative logic, loops, or conditionals beyond pattern matching.
- **Concept Independence:** Syncs reference concepts by name but concepts never know about syncs. The sync is the only place where concept names appear together.
- **Pattern Completeness:** The when clause must match specific action completions (concept/action with variant). The then clause invokes specific actions.

## Generation Pipeline

This scaffold generator participates in the COPF generation pipeline. The full flow is:

1. **Register** -- Generator self-registers with PluginRegistry and KindSystem (SyncConfig → SyncSpec).
2. **Track Input** -- Scaffold configuration is recorded as a Resource for change detection.
3. **Check Cache** -- BuildCache determines if regeneration is needed based on input hash.
4. **Preview** -- Dry-run via Emitter content-addressing shows what files would change.
5. **Generate** -- The actual sync rule file is produced.
6. **Emit & Record** -- Files are written through Emitter with provenance; the run is recorded in GenerationPlan.

## Step-by-Step Process

### Step 1: Register Generator

Self-register with PluginRegistry so the scaffolding kit's KindSystem can track SyncConfig → SyncSpec transformations. Registers inputKind → outputKind transformation in KindSystem for pipeline validation.

**Examples:**
*Register the sync scaffold generator*
```typescript
const result = await syncScaffoldGenHandler.register({}, storage);

```

### Step 2: Track Input via Resource

Register the scaffold configuration as a tracked resource using Resource/upsert. This enables change detection -- if the same configuration is provided again, Resource reports it as unchanged and downstream steps can be skipped.

**Pipeline:** `Resource/upsert(locator, kind: "SyncConfig", digest)`

**Checklist:**
- [ ] Input configuration serialized deterministically?
- [ ] Resource locator uniquely identifies this scaffold request?

### Step 3: Check BuildCache

Query BuildCache/check to determine if this scaffold needs regeneration. If the input hash matches the last successful run and the transform is deterministic, the cached output can be reused without re-running the generator.

**Pipeline:** `BuildCache/check(stepKey: "SyncScaffoldGen", inputHash, deterministic: true)`

**Checklist:**
- [ ] Cache hit returns previous output reference?
- [ ] Cache miss triggers full generation?

### Step 4: Preview Changes

Dry-run the generation using Emitter content-addressing to classify each output file as new, changed, or unchanged. No files are written -- this step shows what *would* happen.

**Pipeline:** `SyncScaffoldGen/preview(...) → Emitter content-hash comparison`

**Examples:**
*Preview scaffold changes*
```bash
copf scaffold sync preview --name CreateProfile --from User/create --to Profile/init
```

### Step 5: Generate Sync Rule

Generate a .sync file with when clause (trigger pattern), optional where clause (guard conditions), and then clause (effect actions).

**Examples:**
*Generate a simple sync*
```bash
copf scaffold sync --name CreateProfile --from User/create --to Profile/init
```
*Generate an eager sync*
```bash
copf scaffold sync --name ValidateOrder --tier required --eager
```

**Checklist:**
- [ ] Sync name is PascalCase?
- [ ] Tier annotation matches intended behavior ([eager], [required], [recommended])?
- [ ] When clause references a valid concept/action?
- [ ] Variable bindings in where clause use ?prefix?
- [ ] Then clause references a valid concept/action?
- [ ] Purpose statement explains why the sync exists?

### Step 6: Emit via Emitter & Record in GenerationPlan

Write generated files through Emitter/writeBatch with source provenance tracking. Then record the step outcome in GenerationPlan/recordStep for run history and status reporting.

**Pipeline:** `Emitter/writeBatch(files, sources) → GenerationPlan/recordStep(stepKey, status: "done")`

**Checklist:**
- [ ] All files written through Emitter (not directly to disk)?
- [ ] Source provenance attached to each file?
- [ ] Generation step recorded in GenerationPlan?

## References

- [Sync rule writing guide](references/sync-rule-guide.md)

## Supporting Materials

- [Sync rule scaffolding walkthrough](examples/scaffold-sync.md)

## Quick Reference

| Input | Type | Purpose |
|-------|------|---------|
| name | String | PascalCase sync name |
| tier | String | Sync tier (required, recommended) |
| eager | Boolean | Fire immediately (default: true) |
| trigger | Trigger | When clause (concept, action, params, variant) |
| conditions | list Condition | Where clause guards |
| effects | list Effect | Then clause actions |


## Anti-Patterns

### Sync with imperative logic
Sync tries to express conditionals or loops instead of pattern matching.

**Bad:**
```
# Pseudo-code in sync — not valid!
if user.isAdmin then
  AdminPanel/grant: [user: ?u]
```

**Good:**
```
where {
  bind(?meta.role as ?role)
  any(?role = "admin")
}
then {
  AdminPanel/grant: [user: ?u]
}
```

## Validation

*Generate a sync scaffold:*
```bash
npx tsx tools/copf-cli/src/index.ts scaffold sync --name CreateProfile --from User/create --to Profile/init
```
*Validate generated sync:*
```bash
npx tsx tools/copf-cli/src/index.ts sync validate syncs/create-profile.sync
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```

## Related Skills

| Skill | When to Use |
| --- | --- |
| sync-designer | Design syncs using formal patterns before generating |
| concept-scaffold | Generate concept specs referenced by the sync |
| sync-validator | Validate compiled syncs |
| `/emitter` | Write scaffold files with content-addressing and source traceability |
| `/build-cache` | Skip unchanged scaffolds via incremental build cache |
| `/resource` | Track scaffold input configurations for change detection |
| `/generation-plan` | Monitor scaffold generation runs and status |
| `/kind-system` | Validate scaffold input/output kind transformations |

