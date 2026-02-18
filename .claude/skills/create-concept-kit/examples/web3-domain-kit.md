# Worked Example: Web3 Domain Kit

A complete walkthrough of the web3 domain kit (ChainMonitor, Contract, Content, Wallet) — a domain kit that bundles infrastructure alongside concepts.

## Kit Purpose

> Blockchain integration for COPF. Chain monitoring with finality-aware gating, IPFS content storage with pinning, and wallet-based authentication via signature verification.

This kit enables any COPF app to interact with EVM-compatible blockchains and IPFS without reinventing chain monitoring, finality handling, or wallet authentication. Unlike framework kits (auth, content-management), this kit introduces new deployment targets (blockchain networks, IPFS) that require custom transport adapters and storage backends.

## Why This is a Domain Kit

The web3 kit needs:
- **Transport adapters**: EVM JSON-RPC and StarkNet adapters to communicate with blockchain networks
- **Storage adapters**: IPFS content-addressed storage adapter for decentralized content
- **Deploy templates**: Pre-configured deployment manifests for Ethereum mainnet, Arbitrum, multi-chain setups

None of this infrastructure exists in the framework kernel — it's domain-specific. Without it, the kit's concepts can't function. That makes this a **domain kit**.

## Step 1: Identify the Kit Boundary

Four concepts belong together:

| Concept | Purpose | Why it's in the kit |
|---------|---------|-------------------|
| **ChainMonitor** | Track block confirmations, detect reorgs, gate on finality | Foundation — finality gating is the kit's core value |
| **Contract** | Wrap on-chain contract interactions as concept actions | Needs ChainMonitor for finality before downstream actions |
| **Content** | IPFS content storage with CID tracking and pinning | Needs IPFS transport/storage from the kit's infrastructure |
| **Wallet** | Signature verification and address management | Provides auth for chain interactions |

**The boundary test**: Remove any one concept — do the others lose significant value?
- Remove ChainMonitor -> Contract actions have no finality guarantees. Yes.
- Remove Contract -> No way to interact with on-chain state. Yes.
- Remove Content -> No IPFS content management, but chain concepts still work. Borderline — but IPFS is a primary use case for web3 apps.
- Remove Wallet -> No signature verification for chain transactions. Yes.

## Step 2: Determine Kit Type

Does this kit introduce a new deployment target? **Yes** — blockchain networks and IPFS are deployment targets that the framework kernel knows nothing about.

Does the kit need custom transports? **Yes** — EVM JSON-RPC, StarkNet.

Does the kit need custom storage? **Yes** — IPFS content-addressed storage.

Does the kit bundle deploy templates? **Yes** — Ethereum mainnet, Arbitrum, multi-chain.

**Decision: Domain kit.**

## Step 3: Type Parameter Alignment

```yaml
concepts:
  ChainMonitor:
    spec: ./chain-monitor.concept
    params:
      B: { as: block-ref, description: "Reference to a tracked block" }

  Contract:
    spec: ./contract.concept
    params:
      X: { as: tx-ref, description: "Reference to a transaction" }

  Content:
    spec: ./content.concept
    params:
      C: { as: content-ref, description: "Reference to stored content (CID)" }

  Wallet:
    spec: ./wallet.concept
    params:
      W: { as: wallet-ref, description: "Reference to a wallet/address" }
```

**Key alignment decisions:**
- Each concept has its own distinct ref type — a block reference is not a transaction reference is not a content CID
- No secondary parameters needed within this kit — the concepts connect through sync variable flow, not shared type parameters
- Cross-kit alignment: Wallet's `W` could align with the auth kit's `user-ref` via integration syncs, but within this kit it stays `wallet-ref` (a wallet address is not a user ID)

## Step 4: Sync Design with Tiers

### Required Syncs (1)

**1. Finality Gate**

Pattern sync that routes chain actions through ChainMonitor before triggering downstream cross-chain actions. Without this, cross-chain operations proceed before transaction finality, risking double-spends or orphaned operations on reorgs.

```
sync FinalityGate [required]
when {
  Contract/call: [ tx: ?tx ] => ok(txHash: ?hash; chain: ?chain)
}
where {
  // Look up the chain's finality configuration
}
then {
  ChainMonitor/awaitFinality: [ txHash: ?hash; level: "default" ]
}
```

**Why required**: Removing this sync means chain actions proceed without finality confirmation. A reorg could invalidate a transaction that downstream syncs already acted on — causing permanent state inconsistency across chains.

### Recommended Syncs (2)

**2. Reorg Compensation**

When ChainMonitor detects a reorg, freeze or flag any downstream actions that were triggered by the reorged completion.

```
sync ReorgCompensation [recommended]
when {
  ChainMonitor/awaitFinality: [ txHash: ?tx ]
    => reorged(txHash: ?tx; depth: ?depth)
}
then {
  Contract/flagReorged: [ tx: ?tx; depth: ?depth ]
}
```

**Override scenario**: An app might need custom compensation logic — rolling back minted tokens, notifying users, or retrying the transaction on a different chain. Override with name `ReorgCompensation`.

**3. Content Pinning**

When Content/store completes, automatically pin the CID via the configured pinning service.

```
sync ContentPinning [recommended]
when {
  Content/store: [ cid: ?cid ] => ok(cid: ?cid)
}
then {
  Content/pin: [ cid: ?cid ]
}
```

**Disable scenario**: An app might manage pinning externally (via a cron job, or a dedicated pinning service with its own scheduling). Disable `ContentPinning`.

### Integration Syncs (1)

**4. Wallet Auth** (activates with auth kit)

Wire Wallet/verify into the auth kit's JWT flow. Wallet signature verification as an authentication method.

```
sync WalletAuth [eager]
when {
  Wallet/verify: [ address: ?addr ] => ok(address: ?addr; signature: ?sig)
}
then {
  JWT/generate: [ subject: ?addr; claims: { wallet: ?addr } ]
}
```

## Step 5: Async Gate Concept — ChainMonitor

ChainMonitor is an **async gate concept**. It follows the gate convention:

```
@gate
concept ChainMonitor [B] {
  purpose "Monitor blockchain state for finality, reorgs, and confirmation tracking"

  state {
    subscriptions: set B         // pending finality requests
    confirmed: map B -> Int      // block -> confirmation count
    chainConfig: map String -> { // per-chain finality rules
      type: String,
      threshold: Int
    }
  }

  actions {
    action awaitFinality(txHash: String, level: String) {
      -> ok(chain: String, block: Int, confirmations: Int) {
        pre: subscriptions contains txHash
        post: subscriptions does not contain txHash
        // Finality condition met
      }
      -> reorged(txHash: String, depth: Int) {
        post: subscriptions does not contain txHash
        // Chain reorg invalidated the transaction
      }
      -> timeout(txHash: String) {
        post: subscriptions does not contain txHash
        // Exceeded maximum wait time
      }
    }
  }
}
```

**Convention checklist:**
1. Async action: `awaitFinality` — invocation received now, completion arrives later
2. `ok` variant: condition met, includes chain/block/confirmations for downstream use
3. Non-ok variants: `reorged` (chain reorg) and `timeout` (exceeded wait)
4. Pending state: `subscriptions: set B` tracks what's being waited on

## Step 6: Infrastructure

### Transport Adapters

**EVM Transport** (`infrastructure/transports/evm-transport.ts`):
- Maps concept `invoke()` to contract calls via ethers.js/viem
- Maps concept `query()` to storage reads via eth_call
- Handles gas estimation, nonce management, receipt polling
- Supports Ethereum, Arbitrum, Optimism, Base, and other EVM chains

**StarkNet Transport** (`infrastructure/transports/starknet-transport.ts`):
- Maps concept `invoke()` to StarkNet transaction submission
- Maps concept `query()` to StarkNet storage reads
- Handles Cairo VM-specific encoding/decoding

### Storage Adapters

**IPFS Storage** (`infrastructure/storage/ipfs-storage.ts`):
- Content-addressed storage: store returns CID, retrieve by CID
- Maintains a mutable index (key -> CID) on top of immutable content
- Supports Pinata, web3.storage, and self-hosted IPFS nodes
- Implements `ConceptStorage` interface with content-addressed semantics

### Deploy Templates

Three pre-configured deployment manifests:

- `ethereum-mainnet.deploy.yaml` — Single-chain Ethereum deployment with 12-confirmation finality
- `arbitrum.deploy.yaml` — L2 deployment with sequencer soft-finality and L1-batch hard-finality
- `multi-chain.deploy.yaml` — Multi-chain deployment with cross-chain bridge syncs

## Step 7: Full Kit Manifest

```yaml
kit:
  name: web3
  version: 0.1.0
  description: >
    Blockchain integration for COPF. Chain monitoring with
    finality-aware gating, IPFS content storage with pinning,
    and wallet-based authentication via signature verification.

concepts:
  ChainMonitor:
    spec: ./chain-monitor.concept
    params:
      B: { as: block-ref, description: "Reference to a tracked block" }
  Contract:
    spec: ./contract.concept
    params:
      X: { as: tx-ref, description: "Reference to a transaction" }
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
        Pattern sync for finality-aware gating. When a chain action
        completes, route through ChainMonitor/awaitFinality before
        triggering downstream cross-chain actions. Without this,
        reorgs cause permanent state inconsistency.

  recommended:
    - path: ./syncs/reorg-compensation.sync
      name: ReorgCompensation
      description: >
        When ChainMonitor detects a reorg, freeze or flag any
        downstream actions that were triggered by the reorged
        completion. Override with app-specific compensation logic.

    - path: ./syncs/content-pinning.sync
      name: ContentPinning
      description: >
        When Content/store completes, automatically pin the CID
        via the configured pinning service. Disable if managing
        pinning manually.

integrations:
  - kit: auth
    syncs:
      - path: ./syncs/wallet-auth.sync
        description: >
          Wire Wallet/verify into the auth kit's JWT flow.
          Wallet signature verification as an auth method.

infrastructure:
  transports:
    - name: evm
      path: ./transports/evm-transport.ts
      description: >
        EVM JSON-RPC transport adapter. Maps concept invoke() to
        contract calls via ethers.js/viem, query() to storage reads.
        Handles gas estimation, nonce management, receipt polling.

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
        Supports Pinata, web3.storage, and self-hosted IPFS nodes.

  deployTemplates:
    - path: ./deploy-templates/ethereum-mainnet.deploy.yaml
    - path: ./deploy-templates/arbitrum.deploy.yaml
    - path: ./deploy-templates/multi-chain.deploy.yaml

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
  optimism:
    chainId: 10
    finality:
      type: l1-batch
      softFinality: sequencer
  base:
    chainId: 8453
    finality:
      type: l1-batch
      softFinality: sequencer
  starknet:
    chainId: "SN_MAIN"
    finality:
      type: validity-proof
    transport: starknet

dependencies: []
```

## Step 8: App Usage Examples

### Basic usage (Ethereum only)

```yaml
# deploy.yaml
kits:
  - name: web3
    path: ./kits/web3
```

1 required + 2 recommended syncs load. Infrastructure (evm transport, ipfs storage) available for deployment. Integration syncs ignored (no auth kit).

### With auth kit integration

```yaml
kits:
  - name: web3
    path: ./kits/web3
  - name: auth
    path: ./kits/auth
```

All 3 kit syncs + 1 integration sync (WalletAuth) load. Users can authenticate via wallet signature.

### Multi-chain with custom reorg handling

```yaml
kits:
  - name: web3
    path: ./kits/web3
    overrides:
      ReorgCompensation: ./syncs/custom-reorg-handler.sync
    disable:
      - ContentPinning
```

1 required sync loads (always). ReorgCompensation replaced with app-specific handler. ContentPinning disabled (app manages pinning externally).

### Using a deploy template

```bash
# Start with a template, then customize
cp kits/web3/infrastructure/deploy-templates/multi-chain.deploy.yaml deploy.yaml
```

## Directory Structure

```
kits/web3/
├── kit.yaml
├── chain-monitor.concept              # @gate — async finality
├── contract.concept
├── content.concept
├── wallet.concept
├── syncs/
│   ├── finality-gate.sync             # Required
│   ├── reorg-compensation.sync        # Recommended
│   ├── content-pinning.sync           # Recommended
│   └── wallet-auth.sync              # Integration (auth)
├── implementations/
│   └── typescript/
│       ├── chain-monitor.impl.ts
│       ├── contract.impl.ts
│       ├── content.impl.ts
│       └── wallet.impl.ts
├── infrastructure/
│   ├── transports/
│   │   ├── evm-transport.ts           # EVM JSON-RPC adapter
│   │   └── starknet-transport.ts      # StarkNet adapter
│   ├── storage/
│   │   └── ipfs-storage.ts            # IPFS content-addressed adapter
│   └── deploy-templates/
│       ├── ethereum-mainnet.deploy.yaml
│       ├── arbitrum.deploy.yaml
│       └── multi-chain.deploy.yaml
└── tests/
    ├── conformance/
    └── integration/
```

## Design Decisions

**Why ChainMonitor is the only required sync**: The finality gate prevents cross-chain state inconsistency from reorgs. ReorgCompensation is recommended because different apps handle reorgs differently (some roll back, some flag, some retry). ContentPinning is recommended because some apps manage pinning externally.

**Why chainConfigs is a top-level field**: Finality rules are per-chain configuration, not concept state. They're read by the ChainMonitor implementation at startup, not modified by actions. Putting them in `kit.yaml` makes them visible and overridable at the deployment level.

**Why infrastructure is separate from implementations**: The EVM transport is pre-conceptual — it speaks JSON-RPC, manages gas and nonces, polls for receipts. That's plumbing, not concept logic. The `contract.impl.ts` implementation uses the transport to execute contract calls, but the transport itself is infrastructure that the kernel manages. Keeping them separate maintains the infrastructure boundary (Section 10.3).

**Framework kit vs. domain kit comparison**: The auth kit (User, Password, JWT) is a framework kit — it works with any transport and storage. The web3 kit is a domain kit — ChainMonitor literally can't function without an EVM transport, and Content can't function without IPFS storage. That's the deciding factor.
