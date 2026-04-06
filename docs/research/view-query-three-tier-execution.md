# Three-Tier Query Execution Model

**Status:** Design
**Date:** 2026-04-06
**PRD Reference:** `docs/research/view-query-migration-prd.md` Sections 3.1–3.4
**Card:** MAG-515

---

## 1. Overview

The view query pipeline supports three distinct execution tiers, each determined by the `kind` field of a `DataSourceSpec`. The tier drives which provider handles backend execution, what it can push down natively, and what must run as a residual in-memory pass. The three tiers are:

| Tier | DataSourceSpec kind | Backend operation | Residual operation |
|------|---------------------|-------------------|--------------------|
| **Kernel** | `concept-action` | scan + system/contextual filters + sort + project | interactive filters, exposed sort overrides |
| **Remote** | `remote-api` | what the API supports per `pushdownOps` | everything else |
| **E2EE Local** | `encrypted-local` | scan only (fetch ciphertext) | client decrypt → all filter/sort/group/project |

The fourth DataSourceSpec kind, `inline`, uses the in-memory provider for everything and does not have a separate backend tier.

---

## 2. Tier Definitions and Kind Mapping

### 2.1 Kernel Tier (`concept-action`)

The kernel tier invokes a registered concept action (e.g., `ContentNode/list`) to fetch rows from the Clef kernel. The kernel provider can receive a partial program consisting of scan, filter (system/contextual only), sort, limit, and project instructions and execute them against the concept's storage layer. The kernel does not support group or interactive-filter pushdown.

**Kind → Provider mapping:**

```
DataSourceSpec.kind = "concept-action"
  → backend provider:  kernelQueryProvider  (kind: "kernel")
  → residual provider: inMemoryProvider     (kind: "in-memory")
```

**Backend program receives:** scan, filter (system + contextual), sort, limit, project
**Residual program receives:** filter (interactive + search), exposed sort overrides

### 2.2 Remote Tier (`remote-api`)

The remote tier delegates execution to a registered `RemoteQueryProvider`. Each provider declares a `pushdownOps` set (e.g., `["filter", "sort", "limit"]`) that describes which instruction types the external API handles natively via query parameters or request body fields. Instructions not in `pushdownOps` remain in the residual program and run in-memory after the HTTP response arrives.

**Kind → Provider mapping:**

```
DataSourceSpec.kind = "remote-api"
  → backend provider:  RemoteQueryProvider  (kind: "remote", name = DataSourceSpec.config.providerName)
  → residual provider: inMemoryProvider     (kind: "in-memory")
```

**Backend program receives:** instructions matching the provider's `pushdownOps`
**Residual program receives:** all other instructions

The `planPushdown` action on `RemoteQueryProvider` performs this split. It inspects each instruction type against `pushdownOps` and returns a `pushdown` program, a `residual` program, and an `apiParams` map that translates the pushdown instructions into HTTP request fields.

### 2.3 E2EE Local Tier (`encrypted-local`)

The E2EE tier fetches encrypted ciphertext rows from the backend without exposing any predicate information. The backend program contains only a scan instruction. After the scan completes, a client-side decrypt step transforms the ciphertext rows into plaintext. The entire filter/sort/group/project pipeline then runs locally via the in-memory provider on the decrypted data.

**Kind → Provider mapping:**

```
DataSourceSpec.kind = "encrypted-local"
  → backend provider:  e2eeProvider    (kind: "e2ee", capabilities: ["scan"])
  → residual provider: inMemoryProvider (kind: "in-memory")
```

**Backend program receives:** scan only
**Residual program receives:** all filter, sort, group, project, limit instructions

This tier has no provider-side pushdown of predicates by design. Leaking filter predicates to the backend would compromise end-to-end encryption guarantees.

---

## 3. Provider Capability Declarations

Each provider registers with `QueryExecution/registerKind` and `QueryExecution/register`, declaring a `capabilities` JSON array. The `planPushdown` logic uses these capabilities to split programs.

```
kernelQueryProvider:
  kind:         "kernel"
  capabilities: ["scan", "filter", "sort", "limit"]
  note:         "filter" here means only system/contextual filters.
                Interactive filters are excluded from pushdown regardless
                of this declaration (see Section 4).

inMemoryProvider:
  kind:         "in-memory"
  capabilities: ["filter", "sort", "group", "project", "limit"]
  note:         planPushdown returns all instructions as pushdown; residual
                is always empty. This provider absorbs whatever is left
                after the backend runs.

remoteQueryProvider (per registration):
  kind:         "remote"
  capabilities: per pushdownOps field — declared at registration time
  example:      ["filter", "sort", "limit"] for a REST API with
                query-param filter support

e2eeProvider:
  kind:         "e2ee"
  capabilities: ["scan"]
  note:         Only fetches ciphertext. Everything else is residual.
```

The in-memory provider's `planPushdown` always returns the full instruction list as pushdown because it operates entirely client-side — it can handle every instruction type. This means the residual passed to it after a backend execution is always handled completely, with nothing left over.

---

## 4. FilterSpec sourceType → Tier Routing Rules

The `FilterSpec.sourceType` field classifies each filter by its lifecycle and who controls it. This classification drives which program a filter instruction lands in during split compilation.

| sourceType | Routing | Reason |
|-----------|---------|--------|
| `system` | Backend pushdown (all tiers except E2EE) | Always-on constraints like soft-delete exclusion and tenant scoping. Known before any user interaction and never change per session. Backend enforcing them reduces data exposure. |
| `contextual` | Backend pushdown (all tiers except E2EE) | Derived from navigation context (URL parameters, current entity ID). Resolved before the query executes. Stable within a page visit. |
| `interactive` | Local residual (all tiers) | User-driven toggle clicks and dynamic inputs. Change frequently during a session. Running them in-memory avoids a round-trip per user interaction. |
| `search` | Backend pushdown if provider supports it, otherwise local residual | Full-text search may map to a search index query parameter on the kernel or a remote API. Falls back to local substring matching if the provider does not declare search capability. |

For the E2EE tier, the routing table above does not apply to the backend program. All filters — including system and contextual — run in the residual program after client-side decrypt. The backend only receives the scan instruction regardless of filter sourceType. This is a hard constraint, not a performance choice.

---

## 5. How planPushdown Splits a QueryProgram

The `planPushdown` action on `QueryExecution` takes a complete compiled `QueryProgram` and the name of the target backend provider. It returns a `pushdown` program and a `residual` program.

### 5.1 Split Algorithm

```
given: program P with instruction sequence I = [i₁, i₂, ..., iₙ]
given: provider capabilities C = {"scan", "filter", "sort", "limit"}
given: filter routing table (sourceType → tier)

for each instruction iₖ in I:
  if iₖ.type = "scan":
    → pushdown (all tiers — scan always goes to backend)

  if iₖ.type = "filter":
    if tier = "e2ee":
      → residual (E2EE never pushes filters)
    else:
      inspect iₖ.sourceType (carried on the filter instruction):
        "system" or "contextual" → pushdown (if "filter" in C)
        "interactive" or "search" → residual
        "search" with "search" in C → pushdown

  if iₖ.type in {"sort", "group", "project", "limit"}:
    if iₖ.type in C:
      → pushdown
    else:
      → residual
```

The `compile-split-query.sync` (MAG-521) builds two separate programs before `planPushdown` is called — one containing only backend-eligible instructions and one containing only residual instructions. The `planPushdown` action on `QueryExecution` is called with the combined program to perform this split, or the split can occur during compilation. Both approaches are valid; the sync-based approach described in MAG-521 composes the split at compile time, which is preferable because it avoids redundant parsing at execution time.

### 5.2 Instruction Ordering After Split

The split must preserve ordering invariants. Specifically:

- The `scan` instruction always appears first in the backend program.
- Residual `filter` instructions that depend on fields produced by a backend `join` (e.g., the membership join in `CompileQueryWithSchemaJoin`) must follow the join in the residual program, not precede it.
- The `pure` termination instruction is added to each sub-program independently.

If a `sort` instruction applies to fields produced by a backend `group`, the sort must remain in the residual program even if the provider declares `sort` capability, because the grouped rows are not available until the local group step completes.

---

## 6. E2EE Decrypt Step

The E2EE pipeline inserts a decrypt transform between the backend scan result and the residual filter/sort/group/project pipeline.

### 6.1 Execution Sequence

```
1. compile-split-query.sync produces:
     backendProgram  = [scan]
     residualProgram = [filter(system), filter(contextual), filter(interactive),
                        sort, group, project, limit, pure]

2. execute-split-query.sync fires for kind="encrypted-local":
     QueryExecution/execute(backendProgram, kind="e2ee")
     → returns ciphertextRows (opaque blobs from the backend store)

3. Decrypt step (client-side, outside QueryExecution):
     for each row in ciphertextRows:
       plaintextRow = decrypt(row.ciphertext, clientKey)
     → produces plaintextRows

4. QueryExecution/execute(residualProgram, kind="in-memory")
     with initial data = plaintextRows
     → returns finalRows after all filter/sort/group/project
```

### 6.2 Where the Decrypt Step Lives

The decrypt step is not expressed as a QueryProgram instruction. It is a side-effecting transform that requires access to client-held key material that is never sent to the backend. It runs between the two `QueryExecution/execute` calls.

In practice, the decrypt step is wired as a `perform` transport effect in the StorageProgram that the `execute-split-query` sync compiles to, or as explicit logic in the ViewRenderer component that handles E2EE data sources. The key constraint is: no predicate from the residual program is sent to the backend, and no key material is sent to the backend.

The `e2eeProvider` export shape mirrors `inMemoryProvider`:

```typescript
export const e2eeProvider = {
  name: 'e2ee-local',
  kind: 'e2ee',
  capabilities: ['scan'],   // scan = fetch ciphertext blob array
  execute,                  // fetches ciphertext, decrypt is caller's responsibility
  planPushdown,             // returns scan as pushdown, everything else as residual
};
```

The caller (ViewRenderer or execute-split-query sync) is responsible for invoking the decrypt function between `e2eeProvider.execute` and `inMemoryProvider.execute`.

---

## 7. Sync Wiring Design for Tier Selection

### 7.1 Current State

`execute-query.sync` hardcodes `kind: "kernel"` in its `then` clause:

```sync
sync ExecuteQuery [eager]
when { QueryProgram/pure: [ program: ?program ] => ok(program: ?program) }
then { QueryExecution/execute: [ program: ?program; kind: "kernel" ] }
```

This fires for every sealed QueryProgram regardless of which data source tier it belongs to. It cannot distinguish kernel programs from remote programs from E2EE programs.

`compile-query.sync` is a monolithic sync that produces a single QueryProgram mixing all filter sourceTypes into one flat instruction sequence.

### 7.2 New Sync Design

Two new syncs replace the monolithic flow.

**`compile-split-query.sync`** (MAG-521) — triggers on `ViewShell/resolve` and produces two separate QueryPrograms based on filter sourceType partitioning:

```
when {
  ViewShell/resolve: [ name: ?name ] => ok(view: ?view)
}
where {
  ViewShell: { ?view dataSource: ?dataSource; filters: ?filterNames; ... }
  DataSourceSpec/get: [ name: ?dataSource ] => ok(kind: ?sourceKind; ...)

  // Partition filters by sourceType
  for each filter in ?filterNames:
    FilterSpec/get: [ name: filter ] => ok(sourceType: ?st; tree: ?tree; ...)
    if ?st in {"system", "contextual"}: append tree to ?backendFilterList
    if ?st in {"interactive", "search"}:  append tree to ?residualFilterList

  bind(uuid() as ?backendProg)
  bind(uuid() as ?residualProg)
  bind(?sourceKind as ?tier)
}
then {
  // Backend program: scan + backend filters + sort + project
  QueryProgram/create: [ program: ?backendProg ]
  QueryProgram/scan:   [ program: ?backendProg; source: ?sourceConfig; bindAs: "records" ]
  QueryProgram/filter: [ program: ?backendProg; node: ?composedBackendFilter; bindAs: "filtered" ]
    // (omitted when tier = "encrypted-local" — E2EE never pushes filters)
  QueryProgram/sort:   [ program: ?backendProg; keys: ?sortKeys; bindAs: "sorted" ]
  QueryProgram/project:[ program: ?backendProg; fields: ?projectionFields; bindAs: "projected" ]
  QueryProgram/pure:   [ program: ?backendProg; variant: "ok"; output: "projected" ]

  // Residual program: interactive/search filters + limit
  QueryProgram/create: [ program: ?residualProg ]
  QueryProgram/filter: [ program: ?residualProg; node: ?composedResidualFilter; bindAs: "filtered" ]
  QueryProgram/limit:  [ program: ?residualProg; count: ?pageSize; output: "page" ]
  QueryProgram/pure:   [ program: ?residualProg; variant: "ok"; output: "page" ]
}
```

**`execute-split-query.sync`** (MAG-522) — triggers on the backend QueryProgram completing and dispatches to the correct backend tier, then runs the residual:

```
when {
  QueryProgram/pure: [ program: ?backendProg ] => ok(program: ?backendProg)
}
where {
  // Read the tier from the program's associated DataSourceSpec kind
  query(?backendProg) => { tier: ?tier }
  guard(?tier in {"kernel", "remote", "e2ee"})
}
then {
  // Dispatch backend program to the correct kind
  QueryExecution/execute: [ program: ?backendProg; kind: ?tier ]
    => ok(rows: ?backendRows)

  // [E2EE only] decrypt step fires as a perform transport effect here

  // Run residual program in-memory on the backend result rows
  QueryExecution/execute: [ program: ?residualProg; kind: "in-memory" ]
    with initial: ?backendRows   // or decryptedRows for E2EE
}
```

### 7.3 Tier Tagging

The connection between a backend QueryProgram and its `tier` is established during compilation. `compile-split-query.sync` tags each created program with its tier string (derived from `DataSourceSpec.kind`) so that `execute-split-query.sync` can read it in its `where` clause without re-querying the DataSourceSpec.

A `bind` clause in the `where` block sets `?tier`:

```
DataSourceSpec/get: [ name: ?dataSource ]
  => ok(kind: ?rawKind; ...)
bind(kindToTier(?rawKind) as ?tier)
// kindToTier: "concept-action" → "kernel"
//             "remote-api"     → "remote"
//             "encrypted-local"→ "e2ee"
//             "inline"         → "in-memory"
```

### 7.4 Existing Syncs Preserved

`compile-query.sync` and `execute-query.sync` are kept as-is during the migration to preserve the legacy fallback path. Views not yet migrated to the split-execution model continue to use the monolithic flow. Once all views are migrated (PRD Phase G), the existing monolithic syncs are deprecated.

---

## 8. Execution Flow Examples

### 8.1 Kernel Tier — ContentNode List with System + Interactive Filters

**Setup:**
- DataSourceSpec: `kind="concept-action"`, `config.concept="ContentNode"`, `config.action="list"`
- FilterSpec A: `name="show-active"`, `sourceType="system"`, `tree={"type":"eq","field":"status","value":"active"}`
- FilterSpec B: `name="type-toggle"`, `sourceType="interactive"`, `tree={"type":"in","field":"kind","values":["concept"]}`
- SortSpec: `keys=[{"field":"node","direction":"asc"}]`

**Execution trace:**

```
1. ViewShell/resolve → ok

2. compile-split-query.sync fires:
   - filter "show-active" (system)  → backendFilters
   - filter "type-toggle" (interactive) → residualFilters
   - creates backendProg:
       [scan(ContentNode/list), filter(show-active), sort(node asc), pure]
   - creates residualProg:
       [filter(type-toggle), pure]
   - tags both with tier="kernel"

3. backendProg seals (pure fires) →
   execute-split-query.sync fires:
     QueryExecution/execute(backendProg, kind="kernel")
     → kernel fetches ContentNode/list, applies system filter and sort
     → returns 87 rows matching status=active, sorted by node

4. QueryExecution/execute(residualProg, kind="in-memory")
   with rows = [87 kernel rows]
   → in-memory provider applies interactive filter kind=in=["concept"]
   → returns 24 rows matching kind=concept

5. ViewRenderer receives 24 rows for display
```

**Result:** The system filter runs once on the backend (single round-trip). The interactive filter runs in-memory on every toggle click without a network request.

---

### 8.2 Remote Tier — Dev.to API with Partial Pushdown

**Setup:**
- DataSourceSpec: `kind="remote-api"`, `config.providerName="devto-provider"`
- RemoteQueryProvider: `pushdownOps=["filter","sort","limit"]`
- FilterSpec: `name="tag-filter"`, `sourceType="interactive"`, `tree={"type":"eq","field":"tag","value":"javascript"}`
- SortSpec: `keys=[{"field":"published_at","direction":"desc"}]`
- Limit: 25

**Execution trace:**

```
1. compile-split-query.sync fires:
   - filter "tag-filter" (interactive) → residualFilters
     BUT tag-filter maps to a pushdown-eligible API param (see note below)
   - Because tier="remote", interactive search/tag filters are evaluated
     per pushdownOps rather than strictly by sourceType
   - RemoteQueryProvider.planPushdown classifies:
       filter(tag) → pushdown (devto supports ?tag= query param)
       sort(published_at) → pushdown (devto supports sort= param)
       limit(25) → pushdown (devto supports per_page= param)
   - backendProg: [scan, filter(tag), sort(published_at), limit(25), pure]
   - residualProg: [] (empty — everything pushed down)
   - tags both with tier="remote"

2. execute-split-query.sync fires:
     QueryExecution/execute(backendProg, kind="remote")
     → RemoteQueryProvider.planPushdown splits program
     → maps to: GET /api/articles?tag=javascript&sort=published_at&per_page=25
     → HTTP call fires via perform('http', ...)
     → response transformed via FieldTransform
     → returns 25 article rows

3. residualProg is empty → in-memory provider returns rows unchanged

4. ViewRenderer receives 25 rows
```

**Note on interactive filters for remote tier:** The remote tier uses `planPushdown` as the authoritative split mechanism rather than `sourceType`. The `sourceType` still guides the initial program composition, but `RemoteQueryProvider.planPushdown` overrides the residual classification for any instruction whose type appears in `pushdownOps`. Interactive filters that map to API parameters are pushed down even though they are `sourceType="interactive"`.

---

### 8.3 E2EE Tier — Encrypted Content Vault

**Setup:**
- DataSourceSpec: `kind="encrypted-local"`, `config.vaultId="vault-abc"`
- FilterSpec A: `name="owner-scope"`, `sourceType="contextual"`, `tree={"type":"eq","field":"ownerId","value":"{{userId}}"}`
- FilterSpec B: `name="type-toggle"`, `sourceType="interactive"`, `tree={"type":"in","field":"kind","values":["note"]}`
- Client holds decryption key `clientKey`

**Execution trace:**

```
1. compile-split-query.sync fires:
   - tier = "e2ee"
   - ALL filters → residualFilters (E2EE never pushes filters to backend)
   - backendProg: [scan(vault-abc), pure]   ← scan only
   - residualProg: [filter(owner-scope), filter(type-toggle), sort, pure]
   - tags both with tier="e2ee"

2. execute-split-query.sync fires:
     QueryExecution/execute(backendProg, kind="e2ee")
     → e2eeProvider fetches encrypted blob array from vault store
     → returns ciphertextRows = [{ciphertext: "…"}, …]
     → NO predicates sent to backend

3. Decrypt step (client-side, between the two execute calls):
     plaintextRows = ciphertextRows.map(r => decrypt(r.ciphertext, clientKey))
     → plaintext JSON objects: [{ownerId:"user-1", kind:"note", body:"…"}, …]

4. QueryExecution/execute(residualProg, kind="in-memory")
   with rows = plaintextRows
   → filter(owner-scope): keeps rows where ownerId = "user-1"
   → filter(type-toggle): keeps rows where kind = "note"
   → sort, limit applied
   → returns final rows

5. ViewRenderer receives final rows; no plaintext data was sent to server
```

**Security invariant:** Between steps 2 and 3, only ciphertext crosses the network. The backend has no visibility into filter predicates (`ownerId`, `kind`) or row values. The `e2eeProvider` capabilities list `["scan"]` enforces that `planPushdown` places every non-scan instruction into the residual regardless of what the compile-split-query sync produced.

---

## 9. Summary of Architectural Constraints

1. **The `kind` field on `DataSourceSpec` is the sole tier selector.** Provider selection flows from this field; no other configuration overrides it.

2. **The in-memory provider is always the residual provider.** It handles whatever the backend tier cannot. It never appears as the backend provider except for `inline` data sources.

3. **E2EE tier ignores `sourceType` for backend routing.** The E2EE constraint is structural: scan-only backend, regardless of filter classification.

4. **`planPushdown` is the authoritative split for remote providers.** For kernel and E2EE tiers the split is rule-based (kernel: by sourceType; E2EE: scan-only). For remote providers, `planPushdown` is called because the capabilities vary per registered provider.

5. **Both programs are sealed QueryPrograms.** The backend program and the residual program are each fully formed (scan → ... → pure). The in-memory provider receives the full residual program with the backend rows provided as the scan data.

6. **Decrypt is a first-class pipeline step for E2EE, not a QueryProgram instruction.** It is a client-side transform applied between the two `QueryExecution/execute` calls, not an instruction that `QueryProgram/create` can describe.
