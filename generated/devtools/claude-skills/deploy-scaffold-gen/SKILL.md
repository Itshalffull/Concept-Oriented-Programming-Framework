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

## Step-by-Step Process

### Step 1: Register Generator

Self-register with PluginRegistry so the scaffolding kit's KindSystem can track DeployConfig → DeployManifest transformations.

**Examples:**
*Register the deploy scaffold generator*
```typescript
const result = await deployScaffoldGenHandler.register({}, storage);

```

### Step 2: Generate Deploy Manifest

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

