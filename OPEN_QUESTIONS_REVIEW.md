# Architecture Open Questions: Implementation Review

Review of the 9 open questions from `Archiecture and Implementation.md` §15 against the current codebase.

---

## Summary Table

| # | Question | Status | DX Quality |
|---|---------|--------|------------|
| 1 | Ordering guarantees | **Answered by implementation** | Adequate but undocumented |
| 2 | Conflict resolution for eventual syncs | **Partially answered** | Needs work |
| 3 | Sync composition | **Answered (no)** | Good — simplicity is correct |
| 4 | Hot reloading | **Unanswered** | Needs design |
| 5 | Testing syncs in isolation | **Answered by implementation** | Good but could be better |
| 6 | Schema migration | **Unanswered** | Needs design |
| 7 | Authorization model | **Answered by implementation** | Good |
| 8 | Lite query mode boundaries | **Answered by implementation** | Adequate |
| 9 | Observability | **Partially answered** | Needs work |

---

## Detailed Analysis

### Q1: Ordering Guarantees

> "When multiple syncs fire from the same completion, what is the execution order?"

**Status: Answered by the implementation.**

The implementation in `engine.ts:437-475` uses a deterministic strategy: when a completion arrives, the engine iterates candidate syncs in **sync-index insertion order** (the order they were registered via `registerSync`). For each sync, bindings are evaluated sequentially. The `processFlow` function in `index.ts:310-352` processes the resulting invocations with a **FIFO queue** (`queue.shift()`), meaning breadth-first execution within a flow.

Key details:
- `engine.ts:437`: `for (const sync of candidates)` — iteration order is `Set` insertion order
- `index.ts:328`: `queue.shift()` — breadth-first processing
- The firing guard (`hasSyncEdge` at `engine.ts:449`) prevents duplicate firing, making order mostly irrelevant for correctness
- `MAX_ITERATIONS = 1000` safety limit prevents infinite loops

**DX assessment: Adequate but undocumented.** The ordering is deterministic and the breadth-first approach is sensible, but developers have no visibility into why syncs fire in a particular order. The architecture doc should document this as a deliberate choice.

**Recommendation:** Add a short note to the architecture doc:
> Syncs fire in registration order. Within a flow, execution is breadth-first (all invocations from one completion are dispatched before processing their results). The firing guard ensures order doesn't affect correctness — the same set of syncs will fire regardless of order, just the invocation sequence may vary.

---

### Q2: Conflict Resolution for Eventual Syncs

> "When a phone concept and a server concept both modify the same logical entity while disconnected, how are conflicts resolved?"

**Status: Partially answered.**

The `DistributedSyncEngine` in `eventual-queue.ts` implements eventual sync queuing with retry on availability. The offline-to-online cycle is well-tested (`test-stage6.test.ts:770-953`). However, **actual conflict resolution is not implemented**. The current behavior is effectively **last-writer-wins at the action level** — when a queued eventual sync fires on reconnect, it simply invokes the target action, which overwrites whatever state exists on the server.

What exists:
- `eventual-queue.ts:307-344`: `evaluateSyncWithFallback` queues bindings when targets are unavailable
- `eventual-queue.ts:181-252`: `onAvailabilityChange` retries queued syncs
- No merge functions, no conflict detection, no CRDT support

**DX assessment: Needs work.** For simple cases (phone edits profile, server receives it), last-writer-wins is fine. For concurrent edits to the same entity, data loss is silently possible. Developers have no tools to detect or handle this.

**Recommendation:** The best DX answer is a **layered approach**:

1. **Default (now):** Last-writer-wins. Document it explicitly so developers aren't surprised.
2. **Opt-in conflict detection:** Add an optional `onConflict` handler to `ConceptHandler`. When an eventual sync fires and the target action returns a new `conflict` variant, the engine can surface it. This requires no framework changes — concepts can already return arbitrary variants. The framework just needs a convention:
   ```
   action replicate(user: U, data: Bytes) {
     -> ok() { Applied successfully }
     -> conflict(local: Bytes, remote: Bytes) { Both sides modified }
   }
   ```
3. **Future:** CRDT-based merge for specific state types. This is a concept-level concern — the concept chooses its storage strategy. The framework could provide CRDT storage adapters as an optional library.

Document option 1 now, design option 2 as the first enhancement.

---

### Q3: Sync Composition

> "Can syncs reference other syncs?"

**Status: Answered — no, and the implementation confirms this is correct.**

Syncs only reference concept actions (`engine.ts:337-369`, `sync-parser.ts`). The `ThenAction` type (`types.ts:123-127`) only accepts `concept` + `action` pairs. There's no mechanism for a sync to enable/disable/reference another sync.

The architecture achieves composition through **chaining**: Sync A fires concept X, whose completion triggers Sync B. This is demonstrated throughout the test suite — the login flow chains `LoginCheckPassword` → `LoginSuccess` → `LoginResponse` via intermediate completions.

**DX assessment: Good.** Keeping syncs flat and using completion-driven chaining is the right call. "Meta-syncs" would add a confusing layer of indirection. The existing pattern is traceable through the action log.

**Recommendation:** Close this question with the current answer. Add a "Composition Patterns" section to the architecture doc showing the chaining pattern explicitly, since this is something every developer will need to understand:

> Syncs compose through **completion chaining**, not through direct references. Sync A's `then` clause invokes concept X. Concept X's completion triggers Sync B's `when` clause. The action log records the full causal chain, making the composition debuggable.

---

### Q4: Hot Reloading

> "Can syncs be added/removed/modified at runtime without restarting the engine?"

**Status: Unanswered.**

The current `SyncEngine.registerSync` (`engine.ts:410-420`) adds syncs to the index but provides no `unregisterSync` or `updateSync`. The `SyncIndex` is a `Map<string, Set<CompiledSync>>`, which could support removal, but no API exists. The `DistributedSyncEngine` has the same limitation.

What would be needed:
- `unregisterSync(name: string)` — remove from index
- `replaceSync(name: string, newSync: CompiledSync)` — atomic update
- Handling in-flight flows: syncs that are currently being evaluated when a replacement happens
- Clearing provenance edges for the old sync version (otherwise the firing guard would suppress the new version from firing on old completions)

**DX assessment: Needs design.**

**Recommendation:** The simplest approach that creates good DX:

1. Add `unregisterSync(name)` and `reloadSyncs(syncs: CompiledSync[])` to both `SyncEngine` and `DistributedSyncEngine`.
2. `reloadSyncs` does an atomic swap: rebuild the entire `SyncIndex` from the new list. This avoids complex partial-update logic.
3. In-flight flows continue with the sync set that was active when the flow started (snapshot isolation). New flows use the new syncs. This avoids race conditions.
4. Provenance edges are scoped to flow IDs, so old edges don't interfere with new sync versions in new flows.

Implementation sketch:
```typescript
// On SyncEngine:
reloadSyncs(syncs: CompiledSync[]): void {
  this.index = buildSyncIndex(syncs);
}
```

This is simple, correct, and matches how developers think about "reload config."

---

### Q5: Testing Syncs in Isolation

> "How do you unit-test a sync without standing up all referenced concepts?"

**Status: Answered by the implementation, using two complementary patterns.**

**Pattern A — Mock concept handlers:** Tests create lightweight inline handlers that satisfy the action interface, then register them with the kernel. This is used throughout the test suite:

```typescript
// test-stage6.test.ts:212-219
const passwordHandler: ConceptHandler = {
  async set(input, storage) {
    return { variant: 'ok', user: input.user };
  },
};
registry.register('urn:copf/Password',
  createInProcessAdapter(passwordHandler, createInMemoryStorage()));
```

**Pattern B — Direct engine testing:** Tests bypass the kernel and work directly with `DistributedSyncEngine`, feeding it synthetic completions and checking the resulting invocations. This tests sync matching logic without executing any concept:

```typescript
// test-stage6.test.ts:236-249
const completion = makeCompletion('urn:copf/Password', 'set', { user: 'u-1' });
const invocations = await engine.onCompletion(completion);
expect(invocations).toHaveLength(0);  // queued
```

**DX assessment: Good, but could be better.** Pattern B is excellent for testing sync matching in isolation. Pattern A requires knowing the handler interface and writing boilerplate. What's missing is a **test helper that auto-generates mock handlers from specs**.

**Recommendation:** Add a `createMockHandler(ast: ConceptAST)` utility that generates a mock handler returning `{ variant: 'ok' }` for every action in the spec, with inputs echoed to output. This would reduce test boilerplate from 5-10 lines per mock concept to 1 line:

```typescript
const mockPassword = createMockHandler(parseConceptFile(readSpec('app', 'password')));
registry.register('urn:copf/Password',
  createInProcessAdapter(mockPassword, createInMemoryStorage()));
```

This utility is ~20 lines of code and would significantly improve the testing DX.

---

### Q6: Schema Migration

> "When a concept's state schema changes across versions, how is migration handled?"

**Status: Unanswered.**

There is no versioning in the current implementation. `ConceptManifest` (`types.ts:332-346`) has no `version` field. The storage interface (`types.ts:48-54`) is schema-agnostic — it stores raw key-value records with no validation against the spec's state schema. This means a concept's storage can drift from its spec without error.

The `ConceptStorage` interface:
```typescript
put(relation: string, key: string, value: Record<string, unknown>): Promise<void>;
get(relation: string, key: string): Promise<Record<string, unknown> | null>;
```

No schema enforcement on `put` or `get`.

**DX assessment: Needs design.** Since each concept owns its storage, migration is conceptually the right place (concept-internal), but the framework provides no tooling.

**Recommendation:** A layered approach matching the framework's philosophy:

1. **Add `version` to ConceptManifest and `.concept` files.** This is metadata — `concept Password [U] @version(2) { ... }`. The compiler can detect version changes.

2. **Convention-based migration.** Add an optional `migrate` action to concept handlers:
   ```typescript
   async migrate(input: { fromVersion: number, toVersion: number }, storage) {
     // concept-specific migration logic
     return { variant: 'ok' };
   }
   ```
   The kernel calls this on startup if the registered concept version differs from what's stored.

3. **GraphQL schema federation handles version skew** by having the engine regenerate the federated schema on concept registration. Since concepts come and go (especially in distributed deployments), the engine already needs to handle schema changes gracefully — the `ConceptRegistry.register` path is the right place.

Start with option 1 (version field) and the convention. The framework's principle of sovereign storage means migration logic belongs in the concept, not the framework.

---

### Q7: Authorization Model

> "Is handling auth via syncs sufficient for all auth patterns, or does the engine need a first-class authorization layer?"

**Status: Answered by the implementation — syncs are sufficient.**

The Stage 7 RealWorld tests demonstrate a complete auth pattern using only syncs and a JWT concept:

- `login.sync`: `LoginCheckPassword` verifies credentials via `Password/check`, then `LoginSuccess` issues a JWT via `JWT/issue`
- `articles.sync`, `comments.sync`, `social.sync`, `profile.sync`: All auth-requiring flows start with a JWT verification step — `JWT/verify` is called in the sync's `then` clause, and subsequent syncs pattern-match on the `verify -> ok` completion to extract the user ID.

Example from the login flow (`syncs/app/login.sync`):
```
sync LoginCheckPassword
when { Web/request: [method: "login"; email: ?email; password: ?password] => [request: ?request] }
where { query User: [email: ?email => user: ?u] }
then { Password/check: [user: ?u; password: ?password] }
```

This is clean, composable, and keeps auth logic visible in the sync layer rather than hidden in middleware.

**DX assessment: Good.** The pattern works well for JWT/token-based auth. Role-based access control (RBAC) can be modeled as another concept (`Role` with `check` action). OAuth flows can be modeled as sync chains with redirect concepts. The sync-based approach keeps authorization declarative and auditable.

**Recommendation:** Close this question. Document the JWT-via-syncs pattern as the canonical auth approach. Add a note that more complex auth patterns (RBAC, ABAC, multi-tenant) are modeled as additional concepts, not as framework features. This aligns with the "total independence" principle — auth is just another concept.

---

### Q8: Lite Query Mode Boundaries

> "What happens when a `where` clause requires a join across two relations within the same lite-mode concept?"

**Status: Answered by the implementation.**

The `LiteQueryAdapter` in `lite-query.ts:44-109` implements the three-tier resolution strategy described in the architecture doc:

1. **Fast path** (`lite-query.ts:64-68`): Single-key lookup via `lookup()`
2. **Medium path** (`lite-query.ts:71-76`): Simple filter via `filter()`
3. **Slow path** (`lite-query.ts:78-85`): Full `snapshot()` + in-engine filtering

For cross-relation joins, the engine fetches a full snapshot and joins in-memory (`engine.ts:270-332`, `evaluateWhere`). The `where` clause evaluation builds query args from bindings and dispatches to the transport's `query` method.

The `createStorageLiteProtocol` (`lite-query.ts:118-147`) auto-generates a lite protocol from any `ConceptStorage`, making it easy for concepts to expose their state without manual implementation.

**DX assessment: Adequate.** The three-tier approach is practical. The concern about large state on constrained devices is real but hasn't manifested in the test suite (all test concepts have small state). The `cacheTtlMs` parameter (`LiteQueryAdapter` constructor) gives developers a knob for performance tuning.

**Recommendation:** Add a diagnostic/warning when the engine falls back to the slow path for large snapshots. The `LiteQueryAdapter.resolve` method could log a warning when `snapshot.relations[relation].length > threshold`, signaling that the concept should implement `lookup` or `filter`, or switch to full GraphQL mode. This is a simple DX improvement:

```typescript
if (entries.length > 1000) {
  console.warn(`Lite query on "${relation}": ${entries.length} entries fetched via snapshot. Consider implementing lookup/filter or switching to GraphQL mode.`);
}
```

---

### Q9: Observability

> "How do we expose the action log and provenance graph as standard observability (OpenTelemetry traces, metrics)?"

**Status: Partially answered.**

The `ActionLog` (`engine.ts:23-105`) records every invocation and completion with:
- Unique IDs, concept/action names, flow IDs, timestamps
- Parent-child relationships (`parent` field in `ActionRecord`)
- Sync provenance edges (`addSyncEdge`, `addSyncEdgeForMatch`)

The `Kernel.getFlowLog(flowId)` method (`index.ts:264-266`) returns the full execution trace for a flow, and tests use this extensively to verify causal chains.

What's missing:
- No OpenTelemetry integration (no spans, no trace context propagation)
- No metrics emission (action counts, latencies, error rates)
- No structured logging beyond `console.warn`
- No way to subscribe to the action log in real-time (only poll via `getFlowLog`)

**DX assessment: Needs work.** The data model is excellent — `ActionRecord` maps almost 1:1 to OpenTelemetry spans. The `flow` field is a trace ID; the `parent` field is a parent span ID. The gap is the export pipeline.

**Recommendation:** The best DX approach is a **hook-based observer pattern** that decouples the action log from specific observability backends:

1. **Add an `onRecord` hook to `ActionLog`:**
   ```typescript
   type ActionLogObserver = (record: ActionRecord) => void;

   class ActionLog {
     private observers: ActionLogObserver[] = [];

     addObserver(observer: ActionLogObserver): void {
       this.observers.push(observer);
     }

     append(completion, parentId?) {
       const record = /* ... existing logic ... */;
       this.records.push(record);
       for (const observer of this.observers) observer(record);
       return record;
     }
   }
   ```

2. **Provide an OpenTelemetry adapter as an optional package:**
   ```typescript
   function createOtelObserver(tracer: Tracer): ActionLogObserver {
     return (record) => {
       const span = tracer.startSpan(`${record.concept}/${record.action}`, {
         attributes: { 'copf.flow': record.flow, 'copf.variant': record.variant },
       });
       span.end();
     };
   }
   ```

3. **Provide a simple console/debug observer for development:**
   ```typescript
   function createDebugObserver(): ActionLogObserver {
     return (record) => {
       console.log(`[${record.type}] ${record.concept}/${record.action} → ${record.variant || 'pending'}`);
     };
   }
   ```

This is 30-40 lines of framework code plus optional adapter packages. It keeps the core minimal while making observability trivially easy to add.

---

## Priority Ranking for Unanswered/Partially Answered Questions

Based on developer impact and implementation effort:

1. **Q9 Observability (hook-based observer)** — Small implementation, high DX impact. Every developer needs debugging visibility. The action log already has the data; just add the hook.

2. **Q5 Testing helpers (`createMockHandler`)** — Tiny implementation (~20 lines), directly improves every developer's testing workflow.

3. **Q4 Hot reloading (`reloadSyncs`)** — Small implementation, important for development workflow. Without it, every sync change requires a full restart.

4. **Q2 Conflict resolution (document LWW, convention for conflict variant)** — Mostly documentation plus a convention. Critical for distributed deployments.

5. **Q6 Schema migration (version field + convention)** — Low urgency now (pre-production), but important before anyone has production data.

6. **Q8 Lite query diagnostics (warning on large snapshots)** — One-line change, nice to have.
