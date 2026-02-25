---
name: kit-scaffold-gen
description: Use when creating a new COPF kit from scratch. Generates a kit.yaml manifest with concept declarations, sync tier groupings, type parameter alignment, and directory structure stubs.
argument-hint: --name <kit-name>
allowed-tools: Read, Write, Bash
---

# KitScaffoldGen

Scaffold a new COPF kit named **$ARGUMENTS** with a kit.yaml manifest, concept spec stubs, and sync directory structure.

> **When to use:** Use when creating a new COPF kit from scratch. Generates a kit.yaml manifest with concept declarations, sync tier groupings, type parameter alignment, and directory structure stubs.

## Design Principles

- **Convention Over Configuration:** Generated kit.yaml follows the standard layout — concepts at top, syncs by tier, uses for external references. Tools work without extra configuration.
- **Type Parameter Alignment:** Every concept's type parameter has an `as` tag that enables cross-concept type alignment. Concepts sharing the same `as` tag share the same entity type.
- **Sync Tier Discipline:** Required syncs protect data integrity. Recommended syncs provide useful defaults. Integration syncs wire to external kits. Never promote a recommended sync to required without justification.

## Generation Pipeline

This scaffold generator participates in the COPF generation pipeline. The full flow is:

1. **Register** -- Generator self-registers with PluginRegistry and KindSystem (KitConfig → KitManifest).
2. **Track Input** -- Scaffold configuration is recorded as a Resource for change detection.
3. **Check Cache** -- BuildCache determines if regeneration is needed based on input hash.
4. **Preview** -- Dry-run via Emitter content-addressing shows what files would change.
5. **Generate** -- The actual kit manifest and directory stubs are produced.
6. **Emit & Record** -- Files are written through Emitter with provenance; the run is recorded in GenerationPlan.

## Step-by-Step Process

### Step 1: Register Generator

Self-register with PluginRegistry so the scaffolding kit's KindSystem can track KitConfig → KitManifest transformations. Registers inputKind → outputKind transformation in KindSystem for pipeline validation.

**Examples:**
*Register the kit scaffold generator*
```typescript
const result = await kitScaffoldGenHandler.register({}, storage);
// { variant: 'ok', name: 'KitScaffoldGen', inputKind: 'KitConfig', ... }

```

### Step 2: Track Input via Resource

Register the scaffold configuration as a tracked resource using Resource/upsert. This enables change detection -- if the same configuration is provided again, Resource reports it as unchanged and downstream steps can be skipped.

**Pipeline:** `Resource/upsert(locator, kind: "KitConfig", digest)`

**Checklist:**
- [ ] Input configuration serialized deterministically?
- [ ] Resource locator uniquely identifies this scaffold request?

### Step 3: Check BuildCache

Query BuildCache/check to determine if this scaffold needs regeneration. If the input hash matches the last successful run and the transform is deterministic, the cached output can be reused without re-running the generator.

**Pipeline:** `BuildCache/check(stepKey: "KitScaffoldGen", inputHash, deterministic: true)`

**Checklist:**
- [ ] Cache hit returns previous output reference?
- [ ] Cache miss triggers full generation?

### Step 4: Preview Changes

Dry-run the generation using Emitter content-addressing to classify each output file as new, changed, or unchanged. No files are written -- this step shows what *would* happen.

**Pipeline:** `KitScaffoldGen/preview(...) → Emitter content-hash comparison`

**Examples:**
*Preview scaffold changes*
```bash
copf scaffold kit preview --name auth --concepts User,Session,Password
```

### Step 5: Generate Kit Manifest

Generate a kit.yaml manifest with concept declarations, sync tier groupings, type parameter alignment, and directory structure stubs.

**Examples:**
*Generate a basic kit*
```bash
copf scaffold kit --name auth --concepts User,Session,Password
```
*Generate a domain kit with infrastructure*
```bash
copf scaffold kit --name web3 --concepts Token,Wallet --domain
```
*Generate programmatically*
```typescript
import { kitScaffoldGenHandler } from './kit-scaffold-gen.impl';
const result = await kitScaffoldGenHandler.generate({
  name: 'auth',
  description: 'Authentication and identity management.',
  concepts: ['User', 'Session', 'Password'],
  syncs: [
    { name: 'ValidateSession', tier: 'required' },
    { name: 'RefreshExpired', tier: 'recommended' },
  ],
}, storage);

```

**Checklist:**
- [ ] Kit name is kebab-case?
- [ ] Version is valid semver?
- [ ] All listed concepts have matching .concept stub files?
- [ ] Syncs are grouped by tier (required/recommended/integration)?
- [ ] Type parameter `as` tags are kebab-case with -ref suffix?
- [ ] Dependencies use semver constraints?

### Step 6: Emit via Emitter & Record in GenerationPlan

Write generated files through Emitter/writeBatch with source provenance tracking. Then record the step outcome in GenerationPlan/recordStep for run history and status reporting.

**Pipeline:** `Emitter/writeBatch(files, sources) → GenerationPlan/recordStep(stepKey, status: "done")`

**Checklist:**
- [ ] All files written through Emitter (not directly to disk)?
- [ ] Source provenance attached to each file?
- [ ] Generation step recorded in GenerationPlan?

## References

- [Kit manifest (kit.yaml) schema reference](references/kit-manifest-schema.md)
- [Cross-concept type parameter alignment](references/type-alignment.md)

## Supporting Materials

- [End-to-end kit scaffolding walkthrough](examples/scaffold-a-kit.md)

## Quick Reference

| Input | Type | Purpose |
|-------|------|---------|
| name | String | Kit name (kebab-case) |
| description | String | Kit purpose description |
| concepts | list String | PascalCase concept names |
| syncs | list {name, tier} | Sync declarations with tiers |
| dependencies | list String | External kit dependencies |
| isDomain | Boolean | Include infrastructure section |


## Anti-Patterns

### Missing type parameter alignment
Concepts in the same kit lack `as` tags, preventing cross-concept type unification.

**Bad:**
```
concepts:
  User:
    spec: ./user.concept
    params:
      U: {}
  Session:
    spec: ./session.concept
    params:
      S: {}
```

**Good:**
```
concepts:
  User:
    spec: ./user.concept
    params:
      U: { as: user-ref }
  Session:
    spec: ./session.concept
    params:
      S: { as: session-ref }
      U: { as: user-ref }
```

### Flat sync list without tiers
All syncs listed without tier annotation — impossible to know which are safe to override.

**Bad:**
```
syncs:
  - syncs/validate.sync
  - syncs/notify.sync
  - syncs/audit.sync
```

**Good:**
```
syncs:
  required:
    - path: ./syncs/validate.sync
  recommended:
    - path: ./syncs/notify.sync
      name: Notify
```

## Validation

*Generate a kit scaffold:*
```bash
npx tsx tools/copf-cli/src/index.ts scaffold kit --name my-kit --concepts User,Session
```
*Validate generated kit:*
```bash
npx tsx tools/copf-cli/src/index.ts kit validate ./kits/my-kit
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```

## Related Skills

| Skill | When to Use |
| --- | --- |
| kit-lifecycle | Manage kit versions and dependencies after scaffolding |
| concept-scaffold | Generate concept specs for the kit's concepts |
| sync-scaffold | Generate sync rules for the kit's syncs |
| `/emitter` | Write scaffold files with content-addressing and source traceability |
| `/build-cache` | Skip unchanged scaffolds via incremental build cache |
| `/resource` | Track scaffold input configurations for change detection |
| `/generation-plan` | Monitor scaffold generation runs and status |
| `/kind-system` | Validate scaffold input/output kind transformations |

