---
name: deploy-scaffold-gen
description: Use when creating a new deployment manifest for a COPF application. Generates deploy.yaml with runtime configurations, infrastructure declarations, concept-to-runtime assignments, and build settings.
argument-hint: --app <app-name>
allowed-tools: Read, Write, Bash
---

# DeployScaffoldGen

Scaffold a deploy.yaml manifest for application **$ARGUMENTS** with runtime configs, infrastructure, and concept assignments.

> **When to use:** Use when creating a new deployment manifest for a COPF application. Generates deploy.yaml with runtime configurations, infrastructure declarations, concept-to-runtime assignments, and build settings.

## Design Principles

- **Declarative Over Imperative:** The deploy manifest declares intent (what runs where) — the framework resolves transport, storage, and engine assignments.
- **Runtime Isolation:** Each concept runs in exactly one runtime. Cross-runtime communication uses transport adapters configured in the infrastructure section.
- **Infrastructure as Code:** The IaC provider setting enables `copf deploy` to generate Terraform, CloudFormation, or Pulumi resources from the manifest.

## Generation Pipeline

This scaffold generator participates in the COPF generation pipeline. The full flow is:

1. **Register** -- Generator self-registers with PluginRegistry and KindSystem (DeployConfig → DeployManifest).
2. **Track Input** -- Scaffold configuration is recorded as a Resource for change detection.
3. **Check Cache** -- BuildCache determines if regeneration is needed based on input hash.
4. **Preview** -- Dry-run via Emitter content-addressing shows what files would change.
5. **Generate** -- The actual deploy manifest and infrastructure stubs are produced.
6. **Emit & Record** -- Files are written through Emitter with provenance; the run is recorded in GenerationPlan.

## Step-by-Step Process

### Step 1: Register Generator

Self-register with PluginRegistry so the scaffolding kit's KindSystem can track DeployConfig → DeployManifest transformations. Registers inputKind → outputKind transformation in KindSystem for pipeline validation.

**Examples:**
*Register the deploy scaffold generator*
```typescript
const result = await deployScaffoldGenHandler.register({}, storage);

```

### Step 2: Track Input via Resource

Register the scaffold configuration as a tracked resource using Resource/upsert. This enables change detection -- if the same configuration is provided again, Resource reports it as unchanged and downstream steps can be skipped.

**Pipeline:** `Resource/upsert(locator, kind: "DeployConfig", digest)`

**Checklist:**
- [ ] Input configuration serialized deterministically?
- [ ] Resource locator uniquely identifies this scaffold request?

### Step 3: Check BuildCache

Query BuildCache/check to determine if this scaffold needs regeneration. If the input hash matches the last successful run and the transform is deterministic, the cached output can be reused without re-running the generator.

**Pipeline:** `BuildCache/check(stepKey: "DeployScaffoldGen", inputHash, deterministic: true)`

**Checklist:**
- [ ] Cache hit returns previous output reference?
- [ ] Cache miss triggers full generation?

### Step 4: Preview Changes

Dry-run the generation using Emitter content-addressing to classify each output file as new, changed, or unchanged. No files are written -- this step shows what *would* happen.

**Pipeline:** `DeployScaffoldGen/preview(...) → Emitter content-hash comparison`

**Examples:**
*Preview scaffold changes*
```bash
copf scaffold deploy preview --app my-app
```

### Step 5: Generate Deploy Manifest

Generate a deploy.yaml manifest with runtime configurations, infrastructure declarations, concept-to-runtime assignments, and build settings.

**Examples:**
*Generate a basic deploy manifest*
```bash
copf scaffold deploy --app my-app
```
*Generate with custom runtimes*
```bash
copf scaffold deploy --app conduit --iac terraform
```
*Generate programmatically*
```typescript
import { deployScaffoldGenHandler } from './deploy-scaffold-gen.impl';
const result = await deployScaffoldGenHandler.generate({
  appName: 'conduit',
  runtimes: [
    { name: 'api', type: 'node', transport: 'http', storage: 'postgresql' },
    { name: 'worker', type: 'node', transport: 'sqs', storage: 'redis' },
  ],
  concepts: [
    { name: 'User', runtime: 'api' },
    { name: 'Article', runtime: 'api' },
  ],
  iacProvider: 'terraform',
}, storage);

```

**Checklist:**
- [ ] App name is valid?
- [ ] Every runtime has a type and transport?
- [ ] Infrastructure storage backends match runtime storage refs?
- [ ] Every listed concept has a runtime assignment?
- [ ] IaC provider is set (terraform, cloudformation, pulumi, docker-compose)?
- [ ] Build section specifies compiler and test runner?

### Step 6: Emit via Emitter & Record in GenerationPlan

Write generated files through Emitter/writeBatch with source provenance tracking. Then record the step outcome in GenerationPlan/recordStep for run history and status reporting.

**Pipeline:** `Emitter/writeBatch(files, sources) → GenerationPlan/recordStep(stepKey, status: "done")`

**Checklist:**
- [ ] All files written through Emitter (not directly to disk)?
- [ ] Source provenance attached to each file?
- [ ] Generation step recorded in GenerationPlan?

## References

- [Deploy manifest (deploy.yaml) schema reference](references/deploy-manifest-schema.md)

## Supporting Materials

- [Deployment manifest scaffolding walkthrough](examples/scaffold-deploy.md)

## Quick Reference

| Input | Type | Purpose |
|-------|------|---------|
| appName | String | Application name |
| version | String | Semver version |
| runtimes | list Runtime | Runtime configs (name, type, transport, storage) |
| concepts | list Assignment | Concept-to-runtime mappings |
| iacProvider | String | IaC provider (terraform, cloudformation, pulumi) |


## Anti-Patterns

### Concept without runtime assignment
Concept listed in deploy manifest but not assigned to any runtime.

**Bad:**
```
concepts:
  User:
    spec: ./specs/user.concept
    # No implementations or runtime!
```

**Good:**
```
concepts:
  User:
    spec: ./specs/user.concept
    implementations:
      - language: typescript
        runtime: api
        storage: postgresql
```

### Mismatched storage backends
Runtime references a storage backend not declared in infrastructure.

**Bad:**
```
runtimes:
  api: { storage: mongodb }  # Not in infrastructure!
infrastructure:
  storage:
    postgresql: { type: postgresql }
```

**Good:**
```
runtimes:
  api: { storage: postgresql }
infrastructure:
  storage:
    postgresql: { type: postgresql }
```

## Validation

*Generate a deploy scaffold:*
```bash
npx tsx tools/copf-cli/src/index.ts scaffold deploy --app my-app
```
*Validate deploy manifest:*
```bash
npx tsx tools/copf-cli/src/index.ts deploy --validate
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```

## Related Skills

| Skill | When to Use |
| --- | --- |
| deployment-config | Validate and refine generated deploy manifests |
| kit-scaffold | Generate kits referenced by the deploy manifest |
| build-orchestration | Build concepts for the declared runtimes |
| `/emitter` | Write scaffold files with content-addressing and source traceability |
| `/build-cache` | Skip unchanged scaffolds via incremental build cache |
| `/resource` | Track scaffold input configurations for change detection |
| `/generation-plan` | Monitor scaffold generation runs and status |
| `/kind-system` | Validate scaffold input/output kind transformations |

