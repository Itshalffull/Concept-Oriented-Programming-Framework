---
name: interface-scaffold-gen
description: Use when creating a new interface generation manifest. Generates interface.yaml with target configurations for REST, GraphQL, gRPC, CLI, MCP, and Claude Skills, plus SDK settings and spec outputs.
argument-hint: --name <interface-name>
allowed-tools: Read, Write, Bash
---

# InterfaceScaffoldGen

Scaffold an interface.yaml for **$ARGUMENTS** with target configs, SDK settings, and per-concept overrides.

> **When to use:** Use when creating a new interface generation manifest. Generates interface.yaml with target configurations for REST, GraphQL, gRPC, CLI, MCP, and Claude Skills, plus SDK settings and spec outputs.

## Design Principles

- **Target Independence:** Each target (REST, GraphQL, CLI, etc.) generates independently — they share concept specs but produce separate output trees.
- **Layered Configuration:** Configuration flows from global defaults → target defaults → per-concept overrides. Specific settings override general ones.
- **SDK Completeness:** Each SDK target should generate a fully-functional client library — types, methods, error handling, and documentation.

## Generation Pipeline

This scaffold generator participates in the COPF generation pipeline. The full flow is:

1. **Register** -- Generator self-registers with PluginRegistry and KindSystem (InterfaceConfig → InterfaceManifest).
2. **Track Input** -- Scaffold configuration is recorded as a Resource for change detection.
3. **Check Cache** -- BuildCache determines if regeneration is needed based on input hash.
4. **Preview** -- Dry-run via Emitter content-addressing shows what files would change.
5. **Generate** -- The actual interface manifest and target stubs are produced.
6. **Emit & Record** -- Files are written through Emitter with provenance; the run is recorded in GenerationPlan.

## Step-by-Step Process

### Step 1: Register Generator

Self-register with PluginRegistry so the scaffolding kit's KindSystem can track InterfaceConfig → InterfaceManifest transformations. Registers inputKind → outputKind transformation in KindSystem for pipeline validation.

**Examples:**
*Register the interface scaffold generator*
```typescript
const result = await interfaceScaffoldGenHandler.register({}, storage);

```

### Step 2: Track Input via Resource

Register the scaffold configuration as a tracked resource using Resource/upsert. This enables change detection -- if the same configuration is provided again, Resource reports it as unchanged and downstream steps can be skipped.

**Pipeline:** `Resource/upsert(locator, kind: "InterfaceConfig", digest)`

**Checklist:**
- [ ] Input configuration serialized deterministically?
- [ ] Resource locator uniquely identifies this scaffold request?

### Step 3: Check BuildCache

Query BuildCache/check to determine if this scaffold needs regeneration. If the input hash matches the last successful run and the transform is deterministic, the cached output can be reused without re-running the generator.

**Pipeline:** `BuildCache/check(stepKey: "InterfaceScaffoldGen", inputHash, deterministic: true)`

**Checklist:**
- [ ] Cache hit returns previous output reference?
- [ ] Cache miss triggers full generation?

### Step 4: Preview Changes

Dry-run the generation using Emitter content-addressing to classify each output file as new, changed, or unchanged. No files are written -- this step shows what *would* happen.

**Pipeline:** `InterfaceScaffoldGen/preview(...) → Emitter content-hash comparison`

**Examples:**
*Preview scaffold changes*
```bash
copf scaffold interface preview --name my-api --targets rest,graphql --sdks typescript
```

### Step 5: Generate Interface Manifest

Generate an interface.yaml manifest with target configurations (REST, GraphQL, gRPC, CLI, MCP, Claude Skills), SDK settings, spec outputs, and per-concept overrides.

**Examples:**
*Generate a REST + GraphQL interface*
```bash
copf scaffold interface --name my-api --targets rest,graphql --sdks typescript
```
*Generate a full-stack interface*
```bash
copf scaffold interface --name my-api --targets rest,graphql,grpc,cli,mcp,claude-skills --sdks typescript,python,go
```

**Checklist:**
- [ ] Interface name is valid?
- [ ] At least one target is specified?
- [ ] Each target has sensible defaults?
- [ ] SDK package names are unique per language?
- [ ] Per-concept overrides reference valid concepts?
- [ ] Grouping strategy is set?

### Step 6: Emit via Emitter & Record in GenerationPlan

Write generated files through Emitter/writeBatch with source provenance tracking. Then record the step outcome in GenerationPlan/recordStep for run history and status reporting.

**Pipeline:** `Emitter/writeBatch(files, sources) → GenerationPlan/recordStep(stepKey, status: "done")`

**Checklist:**
- [ ] All files written through Emitter (not directly to disk)?
- [ ] Source provenance attached to each file?
- [ ] Generation step recorded in GenerationPlan?

## References

- [Interface manifest (interface.yaml) schema reference](references/interface-manifest-schema.md)

## Supporting Materials

- [Interface manifest scaffolding walkthrough](examples/scaffold-interface.md)

## Quick Reference

| Input | Type | Purpose |
|-------|------|---------|
| name | String | Interface name |
| targets | list String | Target types (rest, graphql, grpc, cli, mcp, claude-skills) |
| sdks | list String | SDK languages (typescript, python, go, rust, java, swift) |
| concepts | list String | Concepts with per-concept overrides |
| openapi | Boolean | Generate OpenAPI spec (default: true) |
| asyncapi | Boolean | Generate AsyncAPI spec (default: false) |


## Anti-Patterns

### Targets without concept overrides
All concepts use the same REST base path — collision risk.

**Bad:**
```
targets:
  rest: { basePath: /api }
# No per-concept overrides — all concepts share /api
```

**Good:**
```
targets:
  rest: { basePath: /api }
concepts:
  User:
    rest: { basePath: /api/users }
  Article:
    rest: { basePath: /api/articles }
```

## Validation

*Generate an interface scaffold:*
```bash
npx tsx tools/copf-cli/src/index.ts scaffold interface --name my-api --targets rest,graphql
```
*Generate interfaces from manifest:*
```bash
npx tsx tools/copf-cli/src/index.ts interface generate --manifest my-api.interface.yaml
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```

## Related Skills

| Skill | When to Use |
| --- | --- |
| kit-scaffold | Generate kits whose concepts the interface exposes |
| concept-scaffold | Generate concept specs for interface concepts |
| deployment-config | Deploy the service that hosts the generated interface |
| `/emitter` | Write scaffold files with content-addressing and source traceability |
| `/build-cache` | Skip unchanged scaffolds via incremental build cache |
| `/resource` | Track scaffold input configurations for change detection |
| `/generation-plan` | Monitor scaffold generation runs and status |
| `/kind-system` | Validate scaffold input/output kind transformations |

