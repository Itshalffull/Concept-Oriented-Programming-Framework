---
name: create-suite
description: Create a new Clef suite — a package of related concepts, syncs (with required/recommended tiers), type parameter alignment, implementations, and tests. Covers both framework suites (concepts + syncs only) and domain suites (concepts + syncs + infrastructure). Use when bundling concepts that naturally work together into a reusable suite.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<suite-name>"
---

# Create a Clef Suite

Package a set of related concepts into a reusable **suite** named **$ARGUMENTS**.

## What is a Suite?

A suite is a package of concepts, their standard syncs, and a type parameter mapping that declares how the concepts relate to each other. Kits are a **packaging convention**, not a language construct — the framework loads the specs and syncs like any others. The suite manifest (`suite.yaml`) is metadata for humans, LLMs, package managers, and the compiler's validation tooling.

There are **two types of kits**:

### Framework Suites

Pure concept + sync bundles. No infrastructure. Used for domain-agnostic functionality that works with any deployment target.

```
kits/auth/
├── suite.yaml
├── user.concept
├── password.concept
├── jwt.concept
├── syncs/
│   ├── registration.sync             # recommended
│   └── token-refresh.sync            # recommended
├── implementations/
│   └── typescript/
│       ├── user.handler.ts
│       ├── password.handler.ts
│       └── jwt.handler.ts
└── tests/
    ├── conformance/
    └── integration/
```

**Examples**: auth, content-management, rate-limiting, e-commerce

### Domain Suites

Concept + sync bundles **plus infrastructure** (transport adapters, storage backends, deploy templates). Used when a suite introduces a new deployment target — a new chain, edge runtime, device class, or protocol — that requires pre-conceptual code the framework kernel doesn't include.

```
kits/web3/
├── suite.yaml
├── chain-monitor.concept             # async gate: finality, reorgs
├── contract.concept                  # on-chain concept wrapper
├── content.concept                   # IPFS content management
├── wallet.concept                    # signature verification
├── syncs/
│   ├── finality-gate.sync            # required
│   ├── reorg-compensation.sync       # recommended
│   ├── content-pinning.sync          # recommended
│   └── wallet-auth.sync             # integration (auth suite)
├── implementations/
│   └── typescript/
│       ├── chain-monitor.handler.ts
│       ├── contract.handler.ts
│       ├── content.handler.ts
│       └── wallet.handler.ts
├── infrastructure/                   # pre-conceptual, domain-specific
│   ├── transports/
│   │   ├── evm-transport.ts          # EVM JSON-RPC adapter
│   │   └── starknet-transport.ts     # StarkNet adapter
│   ├── storage/
│   │   └── ipfs-storage.ts           # IPFS content-addressed adapter
│   └── deploy-templates/
│       ├── ethereum-mainnet.deploy.yaml
│       ├── arbitrum.deploy.yaml
│       └── multi-chain.deploy.yaml
└── tests/
    ├── conformance/
    └── integration/
```

**Examples**: web3, iot, workflow

### The Infrastructure Boundary Rule

The `infrastructure/` directory contains **only** transport adapters, storage backends, and deploy templates — **never** concepts, syncs, or implementations. This code is pre-conceptual (Section 10.3 of the architecture doc). The suite installer copies infrastructure into the appropriate kernel extension paths; `clef suite validate` verifies that infrastructure code implements the correct interfaces (`ConceptTransport`, `ConceptStorage`).

### How to Choose

| Question | Framework Suite | Domain Suite |
|----------|--------------|------------|
| Does the suite introduce a new deployment target? | No | Yes |
| Does the suite need custom transport adapters? | No | Yes |
| Does the suite need custom storage backends? | No | Yes |
| Does the suite bundle deploy templates? | No | Yes |
| Does the suite work with any existing transport/storage? | Yes | N/A |

If you answer "No" to all domain suite questions, build a framework suite. Only add `infrastructure/` when the suite's concepts literally cannot function without domain-specific pre-conceptual code.

## Step-by-Step Process

### Step 1: Identify the Kit Boundary

A suite should contain concepts that **naturally form a coherent system** when connected by syncs. The test: if you remove any one concept from the suite, do the remaining concepts lose significant value?

Good suite candidates:
- **Auth suite** (framework): User + Password + JWT (session management makes no sense without credentials or identity)
- **Content management suite** (framework): Entity + Field + Relation + Node (fields and relations are meaningless without entities)
- **Web3 suite** (domain): ChainMonitor + Contract + Content + Wallet (chain monitoring is meaningless without contracts to monitor)
- **IoT suite** (domain): FreshnessGate + Device + TelemetryIngest (freshness checks are meaningless without devices producing telemetry)

Bad suite candidates:
- "Everything suite" — if concepts don't need each other's syncs, they don't belong in the same suite
- Single concept — if there's only one concept, it doesn't need suite packaging

**Key rule**: One purpose per concept, even within a suite. A suite doesn't change the concept design rules — it just bundles independently-designed concepts with their connecting syncs.

### Step 2: Determine Kit Type

Ask: **Does this suite introduce a new deployment target?**

- If the suite's concepts work with existing transports and storage -> **framework suite** (skip Step 9)
- If the suite needs custom transports, storage, or deploy templates -> **domain suite** (include Step 9)

### Step 3: Design the Type Parameter Alignment

Read [references/type-alignment.md](references/type-alignment.md) for the full alignment system.

The `params` section in `suite.yaml` declares a shared identity namespace using `as` tags. This tells the compiler and humans which type parameters across different concepts carry the same kind of identifier:

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

### Step 4: Design the Sync Tiers

Read [references/sync-tiers.md](references/sync-tiers.md) for the tier system and override mechanics.

Every sync in a suite is either **required** or **recommended**:

| Tier | When to use | App can override? | App can disable? |
|------|------------|-------------------|-----------------|
| **Required** | Removal causes data corruption (orphaned records, dangling refs) | No | No (compiler error) |
| **Recommended** | Useful default behavior most apps want | Yes (same-name override) | Yes (disable list) |

**Minimize required syncs.** Only syncs where removal breaks data integrity. "Cascade delete fields when entity is deleted" is required. "Send notification when entity is created" is recommended.

### Step 5: Identify Async Gate Concepts

Read [references/async-gates.md](references/async-gates.md) for the async gate convention.

If any concept in the suite may complete actions asynchronously (chain finality, human approval, TTL checks, rate limiting), it should follow the **async gate convention**:

1. Annotate the concept spec with `@gate`
2. Include an `ok` variant meaning "condition met, proceed"
3. Include at least one non-ok variant with domain semantics (`reorged`, `stale`, `rejected`, etc.)
4. Track pending requests in state

Use the **two-sync chain pattern** to wire gate concepts:

```
# Step 1: Route through gate
sync WaitForFinality {
  when { ArbitrumVault/lock: [] => ok(txHash: ?tx) }
  then { ChainMonitor/awaitFinality: [ txHash: ?tx; level: "l1-batch" ] }
}

# Step 2: Proceed on ok, handle failure on non-ok
sync BridgeAfterFinality {
  when { ChainMonitor/awaitFinality: [ txHash: ?tx ] => ok(chain: ?chain; block: ?block) }
  then { OptimismVault/mint: [ proof: ?tx ] }
}
```

### Step 6: Scaffold the Kit

Use the CLI to scaffold the directory structure:

```bash
npx tsx cli/src/index.ts suite init $ARGUMENTS
```

This creates:
```
kits/$ARGUMENTS/
├── suite.yaml                 # Template manifest
├── example.concept          # Placeholder concept
├── syncs/example.sync       # Placeholder sync
├── handlers/ts/
└── tests/
```

For domain suites, also create the infrastructure directory:
```bash
mkdir -p kits/$ARGUMENTS/infrastructure/{transports,storage,deploy-templates}
```

### Step 7: Write the Suite Manifest

Read [references/suite-manifest.md](references/suite-manifest.md) for the complete manifest format.

Replace the template `suite.yaml` with your actual manifest. The manifest declares:

1. **Kit metadata**: name, version, description
2. **Concepts**: specs and type parameter alignment (`as` tags)
3. **Syncs**: paths, tier (required/recommended), names, descriptions
4. **Integrations** (optional): syncs that activate when other suites are present
5. **Infrastructure** (domain suites only): transports, storage, deploy templates
6. **Dependencies** (optional): other suites this suite requires
7. **Domain-specific config** (optional): e.g., `chainConfigs` for web3

### Step 8: Write the Concept Specs

For each concept in the suite, create a `.concept` file at `kits/$ARGUMENTS/<name>.concept`.

Use the `/create-concept` skill to design each concept properly — the suite doesn't change concept design rules. Each concept must still be:
- **Singular** (one purpose)
- **Independent** (no references to other concepts' types)
- **Sufficient** (state contains everything actions need)

For async gate concepts, include the `@gate` annotation and ensure the convention is followed (see Step 5).

### Step 9: Write Infrastructure (Domain Suites Only)

If this is a domain suite, write the pre-conceptual infrastructure code:

**Transport adapters** — Use the `/create-transport-adapter` skill:
- Place in `kits/$ARGUMENTS/infrastructure/transports/`
- Must implement `ConceptTransport` interface
- Handle domain-specific protocol concerns (gas estimation, MQTT QoS, etc.)

**Storage adapters** — Use the `/create-storage-adapter` skill:
- Place in `kits/$ARGUMENTS/infrastructure/storage/`
- Must implement `ConceptStorage` interface
- Handle domain-specific persistence (content-addressed, time-series, etc.)

**Deploy templates** — Use the `/configure-deployment` skill:
- Place in `kits/$ARGUMENTS/infrastructure/deploy-templates/`
- Provide ready-to-use deployment manifests for common configurations

### Step 10: Write the Kit Syncs

Create sync files under `kits/$ARGUMENTS/syncs/`. Use the `/create-sync` skill and the sync tier annotations:

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

### Step 11: Write Default Implementations

For each concept, create a TypeScript implementation at `kits/$ARGUMENTS/handlers/ts/<name>.handler.ts`.

Use the `/create-implementation` skill. A suite should **ship implementations, not just specs**. Apps can use them as-is or provide their own.

### Step 12: Write Tests

Create conformance tests (from invariants) and integration tests (suite-level flows):

```
kits/$ARGUMENTS/tests/
├── conformance/     # Auto-generated from concept invariants
└── integration/     # Test that suite syncs work end-to-end
```

### Step 13: Validate the Kit

```bash
# Validate suite manifest, concept specs, sync parsing, and tier annotations
npx tsx cli/src/index.ts suite validate kits/$ARGUMENTS

# Run suite conformance and integration tests
npx tsx cli/src/index.ts suite test kits/$ARGUMENTS

# List all suites in the project
npx tsx cli/src/index.ts suite list

# Verify app overrides reference valid sync names
npx tsx cli/src/index.ts suite check-overrides

# Validate async gate convention (if suite has @gate concepts)
npx tsx cli/src/index.ts check --pattern async-gate kits/$ARGUMENTS/<gate-concept>.concept
```

### Step 14: Document App Integration

Show how apps use this suite in their deployment manifest:

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
- **One purpose per concept, even within a suite** — suites bundle, they don't merge
- **Design for override at the recommended level** — ask "what would an app replace this with?"
- **Ship implementations, not just specs** — apps should be able to use the suite out of the box
- **Type parameter alignment is documentation, not enforcement** — `as` tags are advisory
- **Infrastructure goes in `infrastructure/` only** — never mix pre-conceptual code with concepts, syncs, or implementations
- **Prefer framework suites over domain suites** — only add infrastructure when concepts literally can't function without it
- **Gate concepts follow the async gate convention** — `@gate` annotation, ok/non-ok variants, pending state
- **Description quality is mandatory** — Every concept must have a clear purpose (1-3 sentences, what/why/how), every action variant must have a meaningful description, and every sync must have a one-line comment. See the `create-concept` and `create-sync` skills for the full description quality rules.

## Examples

See [examples/content-management-suite.md](examples/content-management-suite.md) for a complete framework suite walkthrough (Entity, Field, Relation, Node) showing the full manifest, all sync tiers, type alignment, and override patterns.

See [examples/web3-domain-suite.md](examples/web3-domain-suite.md) for a complete domain suite walkthrough (ChainMonitor, Contract, Content, Wallet) showing infrastructure bundling, async gate concepts, chain configs, and deploy templates.

See [templates/suite-scaffold.md](templates/suite-scaffold.md) for copy-paste suite manifest templates (both framework and domain variants).

## Related Skills

This skill orchestrates the suite creation process. Use these companion skills for individual components:

| Skill | When to Use |
|-------|------------|
| `/create-concept` | Design each concept in the suite (Step 8) |
| `/create-sync` | Write individual sync rules (Step 10) |
| `/create-implementation` | Write TypeScript implementations for each concept (Step 11) |
| `/create-transport-adapter` | Write transport adapters for domain suites (Step 9) |
| `/create-storage-adapter` | Write storage adapters for domain suites (Step 9) |
| `/configure-deployment` | Create deploy templates for domain suites (Step 9) |
| `/decompose-feature` | Break down a feature into concepts before suite packaging |
