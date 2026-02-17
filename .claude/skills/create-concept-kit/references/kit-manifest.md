# Kit Manifest Reference

Complete specification for `kit.yaml` — the manifest file that declares a concept kit's contents, type alignments, sync tiers, and integrations.

## File Location

```
kits/<kit-name>/kit.yaml
```

## Full Manifest Structure

```yaml
# Kit metadata
kit:
  name: content-management
  version: 0.1.0
  description: >
    Drupal-style entity/field/relation system for structured content.
    Provides typed entities with attachable fields and inter-entity
    relationships, with cascade lifecycle management.

# Concepts included in this kit
concepts:
  ConceptName:
    spec: ./concept-name.concept
    params:
      T: { as: shared-type-tag, description: "Human-readable description" }

# Syncs bundled with the kit
syncs:
  required:
    - path: ./syncs/sync-name.sync
      description: >
        Why this sync is required. What breaks without it.

  recommended:
    - path: ./syncs/sync-name.sync
      name: SyncRuleName
      description: >
        What this sync does. How apps can override it.

# Optional: syncs that activate when other kits are present
integrations:
  - kit: other-kit-name
    syncs:
      - path: ./syncs/integration-sync.sync
        description: >
          What this integration does.

# Optional: other kits this kit requires
dependencies: []
```

## Section Details

### `kit` (required)

Kit-level metadata.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Kit name, kebab-case. Used in deployment manifests. |
| `version` | string | Yes | Semver version string. |
| `description` | string | Yes | Multi-line description. First sentence should summarize. |

### `concepts` (required)

Map of concept names to their specs and parameter alignments.

```yaml
concepts:
  Entity:
    spec: ./entity.concept
    params:
      E: { as: entity-ref, description: "Reference to an entity" }

  Field:
    spec: ./field.concept
    params:
      F: { as: field-ref, description: "Reference to a field instance" }
      T: { as: entity-ref }    # Aligned with Entity's E
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `spec` | string | Yes | Relative path to the `.concept` file |
| `params` | map | Yes | Type parameter declarations with `as` alignment tags |

**Param entry fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `as` | string | Yes | Shared type identity tag (e.g., `entity-ref`, `user-ref`) |
| `description` | string | No | Human-readable description of what this parameter represents |

### `syncs` (required)

Grouped by tier — `required` and `recommended`.

**Required syncs:**

```yaml
syncs:
  required:
    - path: ./syncs/cascade-delete-fields.sync
      description: >
        When an entity is deleted, all attached fields are detached
        and deleted. Without this, the Field concept accumulates
        orphaned records.
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | Yes | Relative path to the `.sync` file |
| `description` | string | Yes | Why this sync is required — what breaks without it |

**Recommended syncs:**

```yaml
syncs:
  recommended:
    - path: ./syncs/default-title-field.sync
      name: DefaultTitleField
      description: >
        When a node is created, automatically attach a title field.
        Override if your app uses a different title convention.
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | Yes | Relative path to the `.sync` file |
| `name` | string | Yes | The sync rule name — used for overrides and disables |
| `description` | string | Yes | What it does and how apps might customize it |

**Why `name` is required for recommended but not required syncs**: Apps override recommended syncs by declaring a sync with the same name. Required syncs can't be overridden, so naming is informational only.

### `integrations` (optional)

Syncs that activate only when another kit is also present in the app:

```yaml
integrations:
  - kit: auth
    syncs:
      - path: ./syncs/entity-ownership.sync
        description: >
          When a user creates an entity, record ownership. Requires
          the auth kit's User concept.
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kit` | string | Yes | Name of the other kit |
| `syncs` | list | Yes | Sync files that activate with the integration |

**Key**: Integration syncs are neither required nor recommended. They're conditional — they only load if the named kit is also present.

### `dependencies` (optional)

Other kits that must be present for this kit to function:

```yaml
dependencies:
  - name: auth
    version: ">=0.1.0"
```

Most kits have no dependencies. Use integrations (optional enhancement) over dependencies (hard requirement) when possible.

## App-Side Usage

Apps reference kits in their deployment manifest (`deploy.yaml`):

```yaml
kits:
  - name: content-management
    path: ./kits/content-management
    overrides:
      # Replace DefaultTitleField with a custom sync
      DefaultTitleField: ./syncs/custom-title.sync
    disable:
      # Don't auto-update timestamps
      - UpdateTimestamp

  - name: auth
    path: ./kits/auth
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Kit name (matches `kit.name` in manifest) |
| `path` | string | Yes | Relative path to kit directory |
| `overrides` | map | No | Map of sync name → replacement sync file path |
| `disable` | list | No | List of recommended sync names to disable |

**Override**: The app provides a different sync with the same name. The app's version replaces the kit's version.

**Disable**: The app removes the sync entirely. Only works for recommended syncs — the compiler errors if you try to disable a required sync.

## Validation

The `copf kit validate` command checks:

1. `kit.yaml` exists and is parseable
2. All referenced `.concept` files exist and parse successfully
3. All referenced `.sync` files exist and parse successfully
4. Sync tier annotations match the manifest declarations
5. Type parameter alignment consistency (advisory warnings)

```bash
npx tsx tools/copf-cli/src/index.ts kit validate kits/<kit-name>
```

Output:
```
Validating kit: kits/content-management

  Kit: content-management
  Concepts: 4
    [OK] Entity (entity.concept)
    [OK] Field (field.concept)
    [OK] Relation (relation.concept)
    [OK] Node (node.concept)
  Syncs: 6
    [OK] CascadeDeleteFields (syncs/cascade-delete-fields.sync)
    [OK] CascadeDeleteRelations (syncs/cascade-delete-relations.sync)
    ...
  Sync tiers: 3 required, 3 recommended

Kit is valid.
```
