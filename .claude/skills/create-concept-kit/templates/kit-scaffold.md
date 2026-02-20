# Template: Kit Manifest

Copy the appropriate template for `kit.yaml` and replace all `TODO` markers.

## Prerequisites

- Concepts are designed (use `create-concept` skill for each)
- Sync tiers are decided (required vs. recommended)
- Type parameter alignment is mapped
- Kit type determined (framework vs. domain)

## Framework Kit Template

Use this template for kits that contain only concepts and syncs — no custom transports, storage, or deploy templates.

```yaml
kit:
  name: TODO-kit-name
  version: 0.1.0
  description: >
    TODO: 1-3 sentence description of what this kit provides.
    What domain does it cover? What value does bundling these
    concepts together deliver?

concepts:
  TODO_ConceptA:
    spec: ./todo-concept-a.concept
    params:
      TODO_PARAM: { as: TODO-type-ref, description: "TODO: What this parameter represents" }

  TODO_ConceptB:
    spec: ./todo-concept-b.concept
    params:
      TODO_PARAM: { as: TODO-type-ref, description: "TODO: What this parameter represents" }
      TODO_SECONDARY: { as: TODO-shared-ref }  # Aligned with another concept's param

syncs:
  required:
    # Only syncs where removal causes data corruption
    - path: ./syncs/TODO-required-sync.sync
      description: >
        TODO: Describe what this sync enforces and what breaks without it.
        Must explain the data corruption that would occur.

  recommended:
    # Useful defaults that apps can override or disable
    - path: ./syncs/TODO-recommended-sync.sync
      name: TODO_SyncRuleName
      description: >
        TODO: Describe what this sync does and how apps might customize it.
        What would an app replace this with?

# External concepts from other kits that this kit's syncs reference.
# Required by default; set optional: true for conditional syncs.
# uses:
#   - kit: TODO-other-kit
#     concepts:
#       - name: TODO_ConceptName
#         params:
#           TODO_PARAM: { as: TODO-type-ref }
#   - kit: TODO-optional-kit
#     optional: true
#     concepts:
#       - name: TODO_OptionalConcept
#     syncs:
#       - path: ./syncs/TODO-conditional-sync.sync
#         description: >
#           TODO: Only loads if TODO-optional-kit is present.

dependencies: []
```

## Domain Kit Template

Use this template for kits that introduce a new deployment target and bundle infrastructure (transport adapters, storage backends, deploy templates) alongside concepts.

```yaml
kit:
  name: TODO-kit-name
  version: 0.1.0
  description: >
    TODO: 1-3 sentence description of what this kit provides.
    What deployment target does it introduce? What infrastructure
    does it bundle?

concepts:
  TODO_ConceptA:
    spec: ./todo-concept-a.concept
    params:
      TODO_PARAM: { as: TODO-type-ref, description: "TODO: What this parameter represents" }

  # Gate concepts should be annotated with @gate in their .concept file
  TODO_GateConcept:
    spec: ./todo-gate-concept.concept
    params:
      TODO_PARAM: { as: TODO-type-ref, description: "TODO: What this parameter represents" }

syncs:
  required:
    - path: ./syncs/TODO-required-sync.sync
      description: >
        TODO: Describe what this sync enforces and what breaks without it.

  recommended:
    - path: ./syncs/TODO-recommended-sync.sync
      name: TODO_SyncRuleName
      description: >
        TODO: Describe what this sync does and how apps might customize it.

# Optional: syncs that activate when another kit is present
# integrations:
#   - kit: TODO-other-kit
#     syncs:
#       - path: ./syncs/TODO-integration-sync.sync
#         description: >
#           TODO: What this integration provides.

# Domain kit infrastructure — pre-conceptual code
infrastructure:
  transports:
    - name: TODO-transport-name
      path: ./transports/TODO-transport.ts
      description: >
        TODO: What protocol this transport speaks, what it maps
        invoke() and query() to.

  # Optional: only if the kit needs custom storage
  # storage:
  #   - name: TODO-storage-name
  #     path: ./storage/TODO-storage.ts
  #     description: >
  #       TODO: What storage backend this wraps and how it differs
  #       from standard storage.

  deployTemplates:
    - path: ./deploy-templates/TODO-deployment.deploy.yaml

# Optional: domain-specific configuration
# TODO_domainConfigs:
#   TODO_config_key:
#     TODO_setting: TODO_value

dependencies: []
```

## Customization Guide

| TODO Marker | Replace With | Example |
|-------------|-------------|---------|
| `TODO-kit-name` | Kit name in kebab-case | `web3` |
| `TODO_ConceptA` | Concept name in PascalCase | `ChainMonitor` |
| `todo-concept-a.concept` | Concept file name in kebab-case | `chain-monitor.concept` |
| `TODO_GateConcept` | Gate concept name in PascalCase | `FreshnessGate` |
| `TODO_PARAM` | Type parameter letter | `B` |
| `TODO-type-ref` | Shared type identity tag (kebab-case, `-ref` suffix) | `block-ref` |
| `TODO_SyncRuleName` | Sync rule name in PascalCase (used for overrides) | `ReorgCompensation` |
| `TODO-required-sync.sync` | Sync file name in kebab-case | `finality-gate.sync` |
| `TODO-recommended-sync.sync` | Sync file name in kebab-case | `reorg-compensation.sync` |
| `TODO-other-kit` | Name of kit to integrate with or use concepts from | `auth` |
| `TODO_ConceptName` (in uses) | External concept name in PascalCase | `User` |
| `TODO-transport-name` | Transport name in kebab-case | `evm` |
| `TODO-transport.ts` | Transport file name | `evm-transport.ts` |
| `TODO-storage-name` | Storage backend name | `ipfs` |
| `TODO-deployment.deploy.yaml` | Deploy template file name | `ethereum-mainnet.deploy.yaml` |
| `TODO_domainConfigs` | Domain-specific config key | `chainConfigs` |

## After Customization

### Framework Kit

1. Scaffold the directory:
   ```bash
   npx tsx tools/copf-cli/src/index.ts kit init <kit-name>
   ```
   Then replace the generated `kit.yaml` with your filled template.

2. Write each concept spec (use `create-concept` skill):
   ```bash
   # For each concept in the kit
   /create-concept <ConceptName> --domain app
   ```
   Place concept files directly in the kit directory (not in `specs/app/`).

3. Write syncs under `kits/<kit-name>/syncs/`. Use `[required]` or `[recommended]` annotations.

4. Write implementations under `kits/<kit-name>/implementations/typescript/`.

5. Validate:
   ```bash
   npx tsx tools/copf-cli/src/index.ts kit validate kits/<kit-name>
   npx tsx tools/copf-cli/src/index.ts kit test kits/<kit-name>
   ```

### Domain Kit

1. Scaffold the directory:
   ```bash
   npx tsx tools/copf-cli/src/index.ts kit init <kit-name>
   mkdir -p kits/<kit-name>/infrastructure/{transports,storage,deploy-templates}
   ```

2. Write each concept spec (use `create-concept` skill). For gate concepts, include `@gate` annotation.

3. Write transport adapters (use `create-transport-adapter` skill):
   ```bash
   /create-transport-adapter <transport-name>
   ```
   Place in `kits/<kit-name>/infrastructure/transports/`.

4. Write storage adapters if needed (use `create-storage-adapter` skill):
   ```bash
   /create-storage-adapter <storage-name>
   ```
   Place in `kits/<kit-name>/infrastructure/storage/`.

5. Write deploy templates (use `configure-deployment` skill):
   Place in `kits/<kit-name>/infrastructure/deploy-templates/`.

6. Write syncs under `kits/<kit-name>/syncs/`. Use `[required]` or `[recommended]` annotations.

7. Write implementations under `kits/<kit-name>/implementations/typescript/`.

8. Validate:
   ```bash
   npx tsx tools/copf-cli/src/index.ts kit validate kits/<kit-name>
   npx tsx tools/copf-cli/src/index.ts kit test kits/<kit-name>
   # For gate concepts:
   npx tsx tools/copf-cli/src/index.ts check --pattern async-gate kits/<kit-name>/<gate>.concept
   ```

## Sync File Templates

### Required Sync Template

```
// Required: TODO describe what breaks without this sync
sync TODO_SyncName [required]
when {
  TODO_Concept/TODO_action: [ TODO_field: ?var ] => [ TODO_field: ?var ]
}
where {
  TODO_Concept: { ?entity TODO_field: ?var }
}
then {
  TODO_Concept/TODO_action: [ TODO_field: ?entity ]
}
```

### Recommended Sync Template

```
// Recommended: TODO describe what this sync does and how to customize
sync TODO_SyncName [recommended]
when {
  Web/request: [ method: "TODO_method"; TODO_field: ?var ] => []
  TODO_Concept/TODO_action: [ TODO_field: ?var ] => [ TODO_field: ?var ]
}
where {
  bind(uuid() as ?id)
}
then {
  TODO_Concept/TODO_action: [ TODO_field: ?id; TODO_field: ?var ]
}
```

### Two-Sync Gate Chain Template

```
// Step 1: Route through gate after upstream action completes
sync TODO_WaitSync {
  when {
    TODO_UpstreamConcept/TODO_action: [] => ok(TODO_field: ?var)
  }
  then {
    TODO_GateConcept/TODO_gateAction: [ TODO_field: ?var; level: "TODO_level" ]
  }
}

// Step 2: Proceed when gate completes with ok
sync TODO_ProceedSync {
  when {
    TODO_GateConcept/TODO_gateAction: [ TODO_field: ?var ]
      => ok(TODO_resultField: ?result)
  }
  then {
    TODO_DownstreamConcept/TODO_action: [ TODO_field: ?var ]
  }
}

// Step 3 (optional): Handle gate failure
sync TODO_HandleFailureSync {
  when {
    TODO_GateConcept/TODO_gateAction: [ TODO_field: ?var ]
      => TODO_failureVariant(TODO_field: ?var)
  }
  then {
    TODO_CompensatingConcept/TODO_action: [ TODO_field: ?var ]
  }
}
```
