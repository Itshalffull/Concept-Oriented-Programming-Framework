# Template: Kit Manifest

Copy this template for `kit.yaml` and replace all `TODO` markers.

## Prerequisites

- Concepts are designed (use `create-concept` skill for each)
- Sync tiers are decided (required vs. recommended)
- Type parameter alignment is mapped

## Template

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

# Optional: syncs that activate when another kit is present
# integrations:
#   - kit: TODO-other-kit
#     syncs:
#       - path: ./syncs/TODO-integration-sync.sync
#         description: >
#           TODO: What this integration provides.

dependencies: []
```

## Customization Guide

| TODO Marker | Replace With | Example |
|-------------|-------------|---------|
| `TODO-kit-name` | Kit name in kebab-case | `content-management` |
| `TODO_ConceptA` | Concept name in PascalCase | `Entity` |
| `todo-concept-a.concept` | Concept file name in kebab-case | `entity.concept` |
| `TODO_PARAM` | Type parameter letter | `E` |
| `TODO-type-ref` | Shared type identity tag (kebab-case, `-ref` suffix) | `entity-ref` |
| `TODO_SyncRuleName` | Sync rule name in PascalCase (used for overrides) | `DefaultTitleField` |
| `TODO-required-sync.sync` | Sync file name in kebab-case | `cascade-delete-fields.sync` |
| `TODO-recommended-sync.sync` | Sync file name in kebab-case | `default-title-field.sync` |
| `TODO-other-kit` | Name of kit to integrate with | `auth` |

## After Customization

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
