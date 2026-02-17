---
name: create-concept-kit
description: Create a new COPF concept kit — a package of related concepts, syncs (with required/recommended tiers), type parameter alignment, implementations, and tests. Use when bundling concepts that naturally work together into a reusable kit.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<kit-name>"
---

# Create a COPF Concept Kit

Package a set of related concepts into a reusable **concept kit** named **$ARGUMENTS**.

## What is a Concept Kit?

A kit is a package of concepts, their standard syncs, and a type parameter mapping that declares how the concepts relate to each other. Kits are a **packaging convention**, not a language construct — the framework loads the specs and syncs like any others. The kit manifest (`kit.yaml`) is metadata for humans, LLMs, package managers, and the compiler's validation tooling.

```
kits/<kit-name>/
├── kit.yaml                    # Kit manifest — concepts, params, syncs, tiers
├── <concept-a>.concept         # Concept specs
├── <concept-b>.concept
├── syncs/
│   ├── <required-sync>.sync    # Required: removal causes data corruption
│   └── <recommended-sync>.sync # Recommended: overridable/disableable by apps
├── implementations/
│   └── typescript/             # Default implementations for all concepts
│       ├── <concept-a>.impl.ts
│       └── <concept-b>.impl.ts
└── tests/
    ├── conformance/            # Generated from invariants
    └── integration/            # Kit-level integration tests
```

## Step-by-Step Process

### Step 1: Identify the Kit Boundary

A kit should contain concepts that **naturally form a coherent system** when connected by syncs. The test: if you remove any one concept from the kit, do the remaining concepts lose significant value?

Good kit candidates:
- **Auth kit**: User + Password + JWT (session management makes no sense without credentials or identity)
- **Content management kit**: Entity + Field + Relation + Node (fields and relations are meaningless without entities)
- **E-commerce kit**: Product + Cart + Order + Payment (a cart without orders is half a system)

Bad kit candidates:
- "Everything kit" — if concepts don't need each other's syncs, they don't belong in the same kit
- Single concept — if there's only one concept, it doesn't need kit packaging

**Key rule**: One purpose per concept, even within a kit. A kit doesn't change the concept design rules — it just bundles independently-designed concepts with their connecting syncs.

### Step 2: Design the Type Parameter Alignment

Read [references/type-alignment.md](references/type-alignment.md) for the full alignment system.

The `params` section in `kit.yaml` declares a shared identity namespace using `as` tags. This tells the compiler and humans which type parameters across different concepts carry the same kind of identifier:

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
      T: { as: entity-ref }    # Same as Entity's E — they share the wire type
```

**Alignment rules:**
- Parameters with the same `as` tag carry the same kind of opaque identifier at runtime
- Syncs can safely pass values between aligned parameters
- The compiler warns (but doesn't error) if a sync passes a `field-ref` where an `entity-ref` is expected
- At runtime, all type parameters are strings — alignment is advisory

### Step 3: Design the Sync Tiers

Read [references/sync-tiers.md](references/sync-tiers.md) for the tier system and override mechanics.

Every sync in a kit is either **required** or **recommended**:

| Tier | When to use | App can override? | App can disable? |
|------|------------|-------------------|-----------------|
| **Required** | Removal causes data corruption (orphaned records, dangling refs) | No | No (compiler error) |
| **Recommended** | Useful default behavior most apps want | Yes (same-name override) | Yes (disable list) |

**Minimize required syncs.** Only syncs where removal breaks data integrity. "Cascade delete fields when entity is deleted" is required. "Send notification when entity is created" is recommended.

### Step 4: Scaffold the Kit

Use the CLI to scaffold the directory structure:

```bash
npx tsx tools/copf-cli/src/index.ts kit init $ARGUMENTS
```

This creates:
```
kits/$ARGUMENTS/
├── kit.yaml                 # Template manifest
├── example.concept          # Placeholder concept
├── syncs/example.sync       # Placeholder sync
├── implementations/typescript/
└── tests/
```

### Step 5: Write the Kit Manifest

Read [references/kit-manifest.md](references/kit-manifest.md) for the complete manifest format.

Replace the template `kit.yaml` with your actual manifest. The manifest declares:

1. **Kit metadata**: name, version, description
2. **Concepts**: specs and type parameter alignment (`as` tags)
3. **Syncs**: paths, tier (required/recommended), names, descriptions
4. **Integrations** (optional): syncs that activate when other kits are present
5. **Dependencies** (optional): other kits this kit requires

### Step 6: Write the Concept Specs

For each concept in the kit, create a `.concept` file at `kits/$ARGUMENTS/<name>.concept`.

Use the `create-concept` skill to design each concept properly — the kit doesn't change concept design rules. Each concept must still be:
- **Singular** (one purpose)
- **Independent** (no references to other concepts' types)
- **Sufficient** (state contains everything actions need)

### Step 7: Write the Kit Syncs

Create sync files under `kits/$ARGUMENTS/syncs/`. Use the sync tier annotations:

```
// Required: removal causes orphaned field records
sync CascadeDeleteFields [required]
when {
  Entity/delete: [ entity: ?entity ] => [ entity: ?entity ]
}
where {
  Field: { ?field target: ?entity }
}
then {
  Field/detach: [ field: ?field ]
}
```

```
// Recommended: apps can override or disable
sync DefaultTitleField [recommended]
when {
  Web/request: [ method: "create_node"; title: ?title ] => []
  Entity/create: [ entity: ?entity ] => [ entity: ?entity ]
}
where {
  bind(uuid() as ?field)
}
then {
  Field/attach: [ field: ?field; target: ?entity; name: "title"; value: ?title ]
}
```

### Step 8: Write Default Implementations

For each concept, create a TypeScript implementation at `kits/$ARGUMENTS/implementations/typescript/<name>.impl.ts`.

A kit should **ship implementations, not just specs**. Apps can use them as-is or provide their own.

### Step 9: Write Tests

Create conformance tests (from invariants) and integration tests (kit-level flows):

```
kits/$ARGUMENTS/tests/
├── conformance/     # Auto-generated from concept invariants
└── integration/     # Test that kit syncs work end-to-end
```

### Step 10: Validate the Kit

```bash
# Validate kit manifest, concept specs, sync parsing, and tier annotations
npx tsx tools/copf-cli/src/index.ts kit validate kits/$ARGUMENTS

# Run kit conformance and integration tests
npx tsx tools/copf-cli/src/index.ts kit test kits/$ARGUMENTS

# List all kits in the project
npx tsx tools/copf-cli/src/index.ts kit list

# Verify app overrides reference valid sync names
npx tsx tools/copf-cli/src/index.ts kit check-overrides
```

### Step 11: Document App Integration

Show how apps use this kit in their deployment manifest:

```yaml
# In the app's deploy.yaml
kits:
  - name: $ARGUMENTS
    path: ./kits/$ARGUMENTS
    overrides:
      # Replace a recommended sync with a custom one
      SyncName: ./syncs/custom-version.sync
    disable:
      # Disable a recommended sync entirely
      - AnotherSyncName
```

## Kit Design Guidelines

- **Keep required syncs minimal** — only where removal causes data corruption
- **One purpose per concept, even within a kit** — kits bundle, they don't merge
- **Design for override at the recommended level** — ask "what would an app replace this with?"
- **Ship implementations, not just specs** — apps should be able to use the kit out of the box
- **Type parameter alignment is documentation, not enforcement** — `as` tags are advisory

## Example

See [examples/content-management-kit.md](examples/content-management-kit.md) for a complete walkthrough of the content management kit (Entity, Field, Relation, Node) showing the full manifest, all sync tiers, type alignment, and override patterns.

See [templates/kit-scaffold.md](templates/kit-scaffold.md) for a copy-paste kit manifest template.
