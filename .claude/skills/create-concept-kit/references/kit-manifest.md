# Suite Manifest Reference

Complete specification for `suite.yaml` — the manifest file that declares a suite's contents, type alignments, sync tiers, integrations, infrastructure, and external concept references.

## File Location

```
kits/<kit-name>/suite.yaml
```

## Full Manifest Structure

### Framework Suite Manifest

```yaml
# Kit metadata
kit:
  name: content-management
  version: 0.1.0
  description: >
    Drupal-style entity/field/relation system for structured content.
    Provides typed entities with attachable fields and inter-entity
    relationships, with cascade lifecycle management.

# Concepts included in this suite
concepts:
  ConceptName:
    spec: ./concept-name.concept
    params:
      T: { as: shared-type-tag, description: "Human-readable description" }

# Syncs bundled with the suite
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

# External concepts from other suites that this suite's syncs reference.
# Required by default; set optional: true for conditional syncs
# that only load when the named kit is present.
uses:
  - kit: other-kit-name
    concepts:
      - name: ConceptName
        params:
          T: { as: shared-type-tag }
  - kit: another-kit
    optional: true
    concepts:
      - name: OptionalConcept
    syncs:
      - path: ./syncs/conditional-sync.sync
        description: >
          Only loads if another-kit is present.

# Optional: other suites this suite requires
dependencies: []
```

### Domain Suite Manifest

Domain suites add an `infrastructure` section and may include domain-specific top-level fields:

```yaml
kit:
  name: web3
  version: 0.1.0
  description: >
    Blockchain integration for Clef. Chain monitoring with
    finality-aware gating, IPFS content storage with pinning,
    and wallet-based authentication via signature verification.

concepts:
  ChainMonitor:
    spec: ./chain-monitor.concept
    params:
      B: { as: block-ref, description: "Reference to a tracked block" }
  Content:
    spec: ./content.concept
    params:
      C: { as: content-ref, description: "Reference to stored content (CID)" }
  Wallet:
    spec: ./wallet.concept
    params:
      W: { as: wallet-ref, description: "Reference to a wallet/address" }

syncs:
  required:
    - path: ./syncs/finality-gate.sync
      description: >
        Pattern sync for finality-aware gating. Routes through
        ChainMonitor/awaitFinality before cross-chain actions.
  recommended:
    - path: ./syncs/reorg-compensation.sync
      name: ReorgCompensation
      description: >
        When ChainMonitor detects a reorg, freeze or flag downstream
        actions triggered by the reorged completion.
    - path: ./syncs/content-pinning.sync
      name: ContentPinning
      description: >
        When Content/store completes, automatically pin the CID.
        Disable if managing pinning manually.

integrations:
  - kit: auth
    syncs:
      - path: ./syncs/wallet-auth.sync
        description: >
          Wire Wallet/verify into the auth suite's JWT flow.

# Domain suite infrastructure — pre-conceptual code (Section 10.3)
infrastructure:
  transports:
    - name: evm
      path: ./transports/evm-transport.ts
      description: >
        EVM JSON-RPC transport adapter. Maps concept invoke() to
        contract calls via ethers.js/viem, query() to storage reads.
    - name: starknet
      path: ./transports/starknet-transport.ts
      description: >
        StarkNet transport adapter for Cairo VM chains.
  storage:
    - name: ipfs
      path: ./storage/ipfs-storage.ts
      description: >
        IPFS content-addressed storage adapter. Maintains a mutable
        index (key -> CID) on top of immutable content storage.
  deployTemplates:
    - path: ./deploy-templates/ethereum-mainnet.deploy.yaml
    - path: ./deploy-templates/arbitrum.deploy.yaml
    - path: ./deploy-templates/multi-chain.deploy.yaml

# Domain-specific configuration (optional, kit-specific)
chainConfigs:
  ethereum:
    chainId: 1
    finality:
      type: confirmations
      threshold: 12
  arbitrum:
    chainId: 42161
    finality:
      type: l1-batch
      softFinality: sequencer

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

### `uses` (optional)

Declares external concepts from other suites that this suite's syncs reference. The `clef suite validate` command checks that all concept references in syncs are either local concepts, declared in `uses`, or built-in (e.g., `Web`).

Each entry is **required by default** — the external kit must be present for this suite to function. Set `optional: true` for conditional entries whose syncs only load when the named kit is present (what was previously handled by a separate `integrations` section).

**Required uses** (default):

```yaml
uses:
  - kit: auth
    concepts:
      - name: User
        params:
          U: { as: user-ref }
      - name: JWT
```

**Optional uses** (conditional syncs):

```yaml
uses:
  - kit: auth
    optional: true
    concepts:
      - name: User
      - name: JWT
    syncs:
      - path: ./syncs/entity-ownership.sync
        description: >
          When a user creates an entity, record ownership.
          Only loads if the auth suite is present.
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kit` | string | Yes | Name of the external kit providing the concepts |
| `optional` | boolean | No | When `true`, the entry's syncs only load if the named kit is present. Default: `false` (required). |
| `concepts` | list | Yes | Concept entries from that kit |
| `syncs` | list | No | Sync files that depend on the external kit. Primarily used with `optional: true`. |

**Concept entry fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Concept name as referenced in syncs (e.g., `User`) |
| `params` | map | No | Type parameter alignment using `as` tags, same format as the `concepts` section |

**Relationship to `dependencies`:**

| Section | Purpose |
|---------|---------|
| `dependencies` | Kit-level version constraint |
| `uses` | Concept-level declarations — which external concepts this suite's syncs reference |

A required `uses` entry implies the external kit must be present. Consider also listing it in `dependencies` for version constraint enforcement.

**Validation behavior:**
- If a `uses` section is present, syncs referencing undeclared external concepts produce **errors**
- If no `uses` section exists, undeclared external references produce **warnings** (backward compatibility)
- Optional uses syncs are exempt from strict validation — they only load conditionally
- Concepts declared in `uses` but never referenced by any sync produce a **warning**
- A required `uses` kit not listed in `dependencies` produces a **warning**

### `infrastructure` (optional, domain suites only)

Pre-conceptual code that the suite's concepts require to function. Only present in domain suites that introduce new deployment targets.

```yaml
infrastructure:
  transports:
    - name: evm
      path: ./transports/evm-transport.ts
      description: EVM JSON-RPC transport adapter
  storage:
    - name: ipfs
      path: ./storage/ipfs-storage.ts
      description: IPFS content-addressed storage adapter
  deployTemplates:
    - path: ./deploy-templates/mainnet.deploy.yaml
```

**Transport entries:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Transport name, used in deploy manifests |
| `path` | string | Yes | Relative path to the transport adapter source file |
| `description` | string | No | What the transport does, what protocol it speaks |

**Storage entries:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Storage backend name, used in deploy manifests |
| `path` | string | Yes | Relative path to the storage adapter source file |
| `description` | string | No | What the storage does, what backend it wraps |

**Deploy template entries:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | Yes | Relative path to the `.deploy.yaml` template |

**The infrastructure boundary rule**: The `infrastructure/` directory contains only transport adapters, storage backends, and deploy templates. Never concepts, syncs, or implementations. This code is pre-conceptual (Section 10.3). The suite installer copies infrastructure into the appropriate kernel extension paths; `clef suite validate` verifies that infrastructure code implements the correct interfaces (`ConceptTransport`, `ConceptStorage`).

### Domain-specific config (optional)

Kits may define their own top-level configuration fields for domain-specific settings. These are not part of the standard manifest schema — they're kit-specific extensions.

Example: the web3 suite defines `chainConfigs` for per-chain finality settings:

```yaml
chainConfigs:
  ethereum:
    chainId: 1
    finality:
      type: confirmations
      threshold: 12
  arbitrum:
    chainId: 42161
    finality:
      type: l1-batch
      softFinality: sequencer
  starknet:
    chainId: "SN_MAIN"
    finality:
      type: validity-proof
    transport: starknet
```

The framework doesn't validate domain-specific config — the suite's own tooling or implementation reads these values.

### `dependencies` (optional)

Other suites that must be present for this suite to function:

```yaml
dependencies:
  - name: auth
    version: ">=0.1.0"
```

Most suites have no dependencies. Use optional `uses` entries (conditional enhancement) over dependencies (hard requirement) when possible.

## App-Side Usage

Apps reference suites in their deployment manifest (`deploy.yaml`):

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
| `overrides` | map | No | Map of sync name -> replacement sync file path |
| `disable` | list | No | List of recommended sync names to disable |

**Override**: The app provides a different sync with the same name. The app's version replaces the suite's version.

**Disable**: The app removes the sync entirely. Only works for recommended syncs — the compiler errors if you try to disable a required sync.

## Validation

The `clef suite validate` command checks:

1. `suite.yaml` exists and is parseable
2. All referenced `.concept` files exist and parse successfully
3. All referenced `.sync` files exist and parse successfully
4. Sync tier annotations match the manifest declarations
5. Type parameter alignment consistency (advisory warnings)
6. Infrastructure files exist and implement correct interfaces (domain suites)
7. Deploy templates are valid YAML (domain suites)
8. Sync concept references — all concepts referenced in syncs must be local, declared in `uses`, or built-in (`Web`)
9. Optional uses syncs are exempt from strict reference checking (they only load conditionally)

```bash
npx tsx cli/src/index.ts suite validate kits/<kit-name>
```

Output for a framework suite:
```
Validating kit: kits/content-management

  Kit: content-management
  Uses: 2 external concept(s) from 1 kit
    [OK] User (from auth)
    [OK] JWT (from auth)
  Concepts: 4
    [OK] Entity (entity.concept)
    [OK] Field (field.concept)
    [OK] Relation (relation.concept)
    [OK] Node (node.concept)
  Syncs: 7
    [OK] CascadeDeleteFields (syncs/cascade-delete-fields.sync)
    [OK] CascadeDeleteRelations (syncs/cascade-delete-relations.sync)
    ...
  Sync tiers: 3 required, 3 recommended

Kit is valid.
```

Output for a domain suite:
```
Validating kit: kits/web3

  Kit: web3
  Concepts: 3
    [OK] ChainMonitor (chain-monitor.concept) [@gate]
    [OK] Content (content.concept)
    [OK] Wallet (wallet.concept)
  Syncs: 3
    [OK] finality-gate (syncs/finality-gate.sync) [required]
    [OK] ReorgCompensation (syncs/reorg-compensation.sync) [recommended]
    [OK] ContentPinning (syncs/content-pinning.sync) [recommended]
  Infrastructure:
    Transports: 2
      [OK] evm (transports/evm-transport.ts) implements ConceptTransport
      [OK] starknet (transports/starknet-transport.ts) implements ConceptTransport
    Storage: 1
      [OK] ipfs (storage/ipfs-storage.ts) implements ConceptStorage
    Deploy templates: 3
      [OK] deploy-templates/ethereum-mainnet.deploy.yaml
      [OK] deploy-templates/arbitrum.deploy.yaml
      [OK] deploy-templates/multi-chain.deploy.yaml
  Sync tiers: 1 required, 2 recommended

Kit is valid.
```
