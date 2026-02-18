# Async Gate Convention

How to design concepts that gate sync chains on asynchronous conditions — chain finality, human approval, TTL freshness, rate limiting, and other domain-specific waits.

## The Problem

Some sync chains need to pause: "wait for 12 block confirmations before minting on L2," "wait for manager approval before releasing funds," "wait for fresh sensor data before computing." The sync engine has no built-in wait mechanism — it processes completions immediately. How do you express asynchronous waits without modifying the engine?

## The Solution: Gate Concepts

A **gate concept** is an ordinary concept whose implementation holds invocations and completes them later when a domain-specific condition is met. The engine doesn't know the action takes minutes or days — it just processes the completion when it arrives, like any other.

This is a **convention**, not a language construct. The engine doesn't know about async gates. But the CLI can validate the pattern and the trace renderer can annotate gating steps specially.

## The Convention

An async gate concept has:

### 1. At least one action that may complete asynchronously

The invocation is received now; the completion arrives later (possibly much later). The concept's implementation holds the request and sends the completion when its condition is met.

### 2. An `ok` variant meaning "condition met, proceed"

Downstream syncs pattern-match on `ok` to continue the chain.

### 3. At least one non-ok variant with domain-specific semantics

`reorged`, `stale`, `rejected`, `throttled`, `timeout`, etc. These trigger compensating or error-handling sync chains.

### 4. State tracking pending requests

The concept must know what it's waiting on, so it can complete requests when conditions change or time them out.

## Spec-Level Annotation

Gate concepts declare themselves with `@gate` so tooling can identify them:

```
@gate
concept ChainMonitor [B] {
  purpose "Monitor blockchain state for finality, reorgs, and confirmation tracking"

  state {
    subscriptions: set B    // pending finality requests
    confirmed: map B -> Int // block -> confirmation count
  }

  actions {
    action awaitFinality(txHash: String, level: String) {
      -> ok(chain: String, block: Int, confirmations: Int) {
        // Condition met — enough confirmations or batch posted
      }
      -> reorged(txHash: String, depth: Int) {
        // Chain reorg invalidated the transaction
      }
      -> timeout(txHash: String) {
        // Exceeded maximum wait time
      }
    }
  }
}
```

The `@gate` annotation is metadata — the engine ignores it entirely. It enables two pieces of tooling.

## CLI Validation

**`copf check --pattern async-gate <concept>`**

Validates that a concept follows the async gate convention:

```
$ copf check --pattern async-gate chain-monitor.concept

chain-monitor.concept: async-gate pattern validation
  OK Has @gate annotation
  OK Has at least one action with ok variant (awaitFinality)
  OK Has at least one non-ok variant (reorged, timeout)
  OK Has state tracking pending requests (subscriptions: set B)
  WARN Consider adding a timeout variant to 'subscribe' action
     (gate actions should have explicit timeout handling)

1 warning, 0 errors
```

The checker validates structural conformance: presence of `@gate`, at least one ok and one non-ok variant on a gate action, state for tracking pending items. It does not enforce specific variant names — `reorged`, `stale`, and `throttled` are all valid non-ok variants. The warning about timeouts is a heuristic: long-running actions without explicit timeout handling are a common source of stuck flows.

## Trace Rendering

When the trace renderer encounters an action on a `@gate` concept, it annotates the output differently from normal actions.

### Completed Gate (success)

```
flow-bridge-001  Cross-Chain Bridge  (14m 23s total, OK)
|
+-- OK ArbitrumVault/lock -> ok                   2.3s
|  +-- [WaitForFinality] ->
|  |  +-- WAIT ChainMonitor/awaitFinality -> ok   14m 18s  (async gate)
|  |     level: "l1-batch"
|  |     waited for: Arbitrum batch #4891 posted to L1
|  |     +-- [BridgeAfterFinality] ->
|  |     |  +-- OK OptimismVault/mint -> ok        4.7s
|  |     +-- [LogBridge] ->
|  |        +-- OK ActionLog/append -> ok          0ms
```

Key differences from normal trace output:
- **WAIT icon** instead of OK or FAIL for gate actions (indicates async wait, not instant execution)
- **"(async gate)" label** after timing, so developers immediately see this was a gating step
- **"waited for:" line** showing what condition was met (from the completion's fields)
- **Duration in human-friendly units** — gate actions can take minutes, hours, or days, so the renderer uses `14m 18s` instead of `858000ms`

### Pending Gate (in progress)

```
flow-bridge-002  Cross-Chain Bridge  (3m 12s elapsed, IN PROGRESS)
|
+-- OK ArbitrumVault/lock -> ok                   2.1s
|  +-- [WaitForFinality] ->
|  |  +-- WAIT ChainMonitor/awaitFinality          3m 10s  (async gate, pending)
|  |     level: "l1-batch"
|  |     status: 847/~900 blocks until batch post
|  |
|  |  BLOCKED [BridgeAfterFinality] blocked
|  |    (waiting on: ChainMonitor/awaitFinality -> ok)
```

The BLOCKED icon and "blocked" label distinguish "sync hasn't fired because the gate hasn't completed yet" from "sync didn't fire because of a pattern mismatch" (which uses a warning icon). The status line comes from the gate concept's implementation reporting progress — this is optional and concept-specific.

### Failed Gate

```
|  +-- [WaitForFinality] ->
|  |  +-- WAIT ChainMonitor/awaitFinality -> reorged  7m 45s  (async gate, FAILED)
|  |     txHash: "0xabc..."
|  |     depth: 3
|  |     +-- [HandleReorg] ->
|  |     |  +-- OK ArbitrumVault/unlock -> ok      1.2s
```

The gate's non-ok variant triggers compensating syncs, which appear as children in the trace — same as any other sync chain.

## Programmatic Access

The `TraceNode` interface gains an optional gate annotation:

```typescript
interface TraceNode {
  action: string;
  variant: string;
  durationMs: number;
  fields: Record<string, unknown>;
  children: TraceSyncNode[];

  // Present only for actions on @gate concepts
  gate?: {
    pending: boolean;          // true if action hasn't completed yet
    waitDescription?: string;  // human-readable, from concept impl
    progress?: {               // optional progress reporting
      current: number;
      target: number;
      unit: string;            // e.g. "blocks", "items", "approvals"
    };
  };
}

interface TraceSyncNode {
  syncName: string;
  fired: boolean;
  blocked: boolean;           // true when waiting on incomplete gate
  missingPattern?: string;
  child?: TraceNode;
}
```

The `gate` field is populated by the trace builder when it detects the target concept has `@gate` in its AST. The `waitDescription` and `progress` are optional fields that gate concept implementations can include in their completion or in-progress reporting — they're not required by the convention.

## The Two-Sync Chain Pattern

The standard way to wire gate concepts uses two syncs:

```
# Sync 1: Route through gate after upstream action completes
sync WaitForFinality {
  when {
    ArbitrumVault/lock: [] => ok(txHash: ?tx)
  }
  then {
    ChainMonitor/awaitFinality: [ txHash: ?tx; level: "l1-batch" ]
  }
}

# Sync 2: Proceed when gate completes with ok
sync BridgeAfterFinality {
  when {
    ChainMonitor/awaitFinality: [ txHash: ?tx ]
      => ok(chain: ?chain; block: ?block)
  }
  then {
    OptimismVault/mint: [ proof: ?tx ]
  }
}

# Sync 3 (optional): Handle gate failure
sync HandleReorg {
  when {
    ChainMonitor/awaitFinality: [ txHash: ?tx ]
      => reorged(txHash: ?tx; depth: ?depth)
  }
  then {
    ArbitrumVault/unlock: [ txHash: ?tx ]
  }
}
```

No new annotations, no engine changes, no special handling. The engine processes `ChainMonitor/awaitFinality -> ok` the same way it processes any other completion. The chain monitor's implementation decides when to send that completion.

## Engine/Concept Boundary Principle

The sync engine owns only **delivery semantics** — the mechanics of getting messages between concepts:

| Engine annotation | What it controls |
|-------------------|-----------------|
| `[eager]` | Process immediately on completion |
| `[eventual]` | Queue if target unavailable, retry when available |
| `[local]` | Evaluate only on local engine, don't forward upstream |
| `[idempotent]` | Safe to retry without side effects |

Everything else is a **domain concern** that belongs in concepts:

| Domain concern | Concept pattern | Why not an engine annotation |
|---------------|----------------|------------------------------|
| Chain finality | `ChainMonitor/awaitFinality` | Finality rules are chain-specific (confirmations, L1-batch, validity-proof) |
| Batch accumulation | `BatchAccumulator/add` | Batch size and flush strategy are app-specific |
| TTL / freshness | `FreshnessGate/check` | Staleness thresholds vary by data type |
| Human approval | `ApprovalQueue/submit` | Approval workflows have domain-specific escalation |
| Rate limiting | `RateLimiter/check` | Quotas and windows are per-client or per-endpoint |
| Authorization | `JWT/verify`, `Wallet/verify` | Auth rules are app-specific |

**The rule**: if you find yourself wanting a new engine annotation to change sync evaluation behavior, write a concept instead and put it in a sync chain. The engine stays at ~584 LOC forever.

## Common Gate Concepts by Kit

| Kit | Gate Concept | Gate Action | ok variant | Non-ok variants |
|-----|-------------|-------------|-----------|-----------------|
| web3 | ChainMonitor | awaitFinality | ok(chain, block, confirmations) | reorged(txHash, depth), timeout(txHash) |
| iot | FreshnessGate | check | ok(data, age) | stale(lastSeen, threshold), unreachable(device) |
| workflow | ApprovalQueue | submit | ok(approver, timestamp) | rejected(reason), timeout(escalatedTo), escalated(level) |
| rate-limiting | RateLimiter | check | ok(remaining, resetAt) | throttled(retryAfter, limit) |

## Designing a New Gate Concept

1. **Identify the wait condition** — What is the concept waiting for? Block confirmations? Human input? Fresh data? Timer expiry?

2. **Define the ok variant** — What fields does downstream code need? Include enough context for the next sync to proceed without additional lookups.

3. **Define non-ok variants** — What can go wrong? Each failure mode gets its own variant with domain-specific fields. Common: `timeout`, `rejected`, `stale`, `reorged`.

4. **Design pending state** — The concept needs to track what it's waiting on. Use a set or map of pending request identifiers.

5. **Consider progress reporting** — Can the concept report progress? If so, include `waitDescription` and `progress` fields in the implementation's in-progress reporting. This is optional but greatly improves the trace output for long-running gates.

6. **Add timeout handling** — Every gate action should have explicit timeout behavior. Either a `timeout` variant or a configurable maximum wait time. Long-running actions without timeout handling are a common source of stuck flows.

7. **Annotate with `@gate`** — Add the annotation to the concept spec so tooling can recognize it.

8. **Validate** — Run `copf check --pattern async-gate` to verify convention conformance.
