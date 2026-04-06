# View Query Split Execution Flow — Architecture Design

**Card:** MAG-516
**PRD:** `docs/research/view-query-migration-prd.md` Section 3.2
**Status:** Design Draft
**Date:** 2026-04-06

---

## 1. End-to-End Flow Overview

The complete path from a named view to final result rows, after the migration to
split execution, runs in five sequential stages:

```
[1] ViewShell/resolve
        │
        ▼
[2] ViewResolve sync — parallel fan-out to child spec gets
        │  DataSourceSpec/get → sourceConfig, kind
        │  FilterSpec/get × N → filterTree, sourceType per filter
        │  SortSpec/get       → sortKeys
        │  GroupSpec/get      → groupingConfig, aggregations (if present)
        │  ProjectionSpec/get → projectionFields
        │
        ▼
[3] compile-split-query.sync
        │  Partition FilterSpecs by sourceType
        │  Build backend FilterNode (AND of system + contextual trees)
        │  Build residual FilterNode (AND of interactive + search trees)
        │  Emit QueryProgram/create × 2 (backend program, residual program)
        │
        ▼
[4] execute-split-query.sync
        │  Dispatch backend program → QueryExecution/execute(kind per DataSourceSpec)
        │  [E2EE only: decrypt step between scan result and residual]
        │  Feed backend result rows into residual program as inline data source
        │  Dispatch residual program → QueryExecution/execute(kind: "in-memory")
        │
        ▼
[5] Result rows returned to caller (ViewRenderer / Pilot / API layer)
```

Nothing in stage 1 or 2 changes from the current implementation. Stages 3–5
replace the current monolithic `compile-query.sync` + `execute-query.sync` pair.

---

## 2. Filter Partitioning by sourceType

FilterSpec declares a `sourceType` field with four values. Before compilation the
filters attached to a view are split into two buckets:

| sourceType | Execution bucket | Rationale |
|------------|-----------------|-----------|
| `system` | **Backend** | Always-on invariant filters (soft-delete exclusion, tenant scoping). Never changes per interaction; safe to push to kernel. |
| `contextual` | **Backend** | Derived from URL or navigation context (e.g., `entityId = :currentEntity`). Bound before the query runs; value is stable for the lifetime of the request. |
| `interactive` | **Residual** | User toggle clicks, search boxes, facet selections. Changes on every interaction; must stay local to avoid round-trips. |
| `search` | **Residual** (default) | Full-text predicates. May be promoted to backend pushdown by a provider that declares `search` in its `pushdownOps`, but defaults to residual. |

**Partitioning algorithm:**

Given the list of FilterSpec names attached to a ViewShell, the compiler loads
each FilterSpec and classifies it:

```
backendFilters  = filters where sourceType in { "system", "contextual" }
residualFilters = filters where sourceType in { "interactive", "search" }
```

Each bucket is then composed into a single FilterNode using AND semantics:

- If a bucket has zero filters: the identity node `{ type: "true" }` is used,
  meaning that stage is a no-op.
- If a bucket has exactly one filter: its tree is used verbatim.
- If a bucket has two or more filters: an `{ type: "and", conditions: [...] }`
  wrapper node is constructed from all trees in the bucket.

This partitioning happens entirely within the sync `where` clause before any
QueryProgram instructions are emitted.

---

## 3. compile-split-query.sync — Design

The new sync replaces the monolithic `compile-query.sync` for views that need
split execution. It fires on the same trigger (`ViewShell/resolve => ok`) but
emits two programs instead of one.

### Pseudo-sync (annotated)

```
sync CompileSplitQuery [eager]
  purpose: "Partition filters by sourceType and compile two QueryPrograms —
            a backend program pushed to the kernel provider, and a residual
            program evaluated in-memory on the backend result."
when {
  ViewShell/resolve: [ name: ?name ]
    => ok(view: ?view)
}
where {
  // Load the view's child spec references
  ViewShell: {
    ?view
    dataSource: ?dataSource
    filter: ?filterRef        // may be a single name or a comma-separated list
    sort: ?sort
    group: ?group
    projection: ?projection
  }

  // Hydrate each FilterSpec and classify it
  // (In sync grammar this expands to one or more FilterSpec/get calls
  //  with a guard on sourceType)
  FilterSpec/list: [ view: ?view ]
    => ok(filters: ?allFilters)

  // Partition into backend and residual trees
  // (Expressed here as derived bindings produced by the where clause interpreter)
  bind(partitionFilters(?allFilters, ["system","contextual"]) as ?backendFilterTree)
  bind(partitionFilters(?allFilters, ["interactive","search"])  as ?residualFilterTree)

  // Load the remaining specs
  DataSourceSpec/get: [ name: ?dataSource ]
    => ok(source: _; kind: ?sourceKind; config: ?sourceConfig; parameters: _)
  SortSpec/get: [ name: ?sort ]
    => ok(sort: _; keys: ?sortKeys)
  ProjectionSpec/get: [ name: ?projection ]
    => ok(projection: _; fields: ?projectionFields)

  // Generate two unique IDs — one per program
  bind(uuid() as ?backendProgram)
  bind(uuid() as ?residualProgram)

  // Tag with the view name so execute-split-query.sync can correlate them
  bind(?name as ?viewKey)
}
then {
  // ── Backend program ──────────────────────────────────────────────────────
  QueryProgram/create: [ program: ?backendProgram; tag: "backend"; viewKey: ?viewKey ]
}
then {
  QueryProgram/scan: [ program: ?backendProgram; source: ?sourceConfig; bindAs: "records" ]
}
then {
  // schema join inserted here when sourceKind = "node" (see Section 7)
  QueryProgram/filter: [ program: ?backendProgram; node: ?backendFilterTree; bindAs: "filtered" ]
}
then {
  QueryProgram/sort: [ program: ?backendProgram; keys: ?sortKeys; bindAs: "sorted" ]
}
then {
  QueryProgram/project: [ program: ?backendProgram; fields: ?projectionFields; bindAs: "projected" ]
}
then {
  QueryProgram/pure: [ program: ?backendProgram; variant: "ok"; output: "projected" ]
}
then {
  // ── Residual program ─────────────────────────────────────────────────────
  // No scan — data is injected as inline rows after backend execution
  QueryProgram/create: [ program: ?residualProgram; tag: "residual"; viewKey: ?viewKey ]
}
then {
  // Placeholder scan — will be overwritten by execute-split-query with inline rows
  QueryProgram/scan: [ program: ?residualProgram; source: { kind: "inline", rows: [] }; bindAs: "records" ]
}
then {
  QueryProgram/filter: [ program: ?residualProgram; node: ?residualFilterTree; bindAs: "filtered" ]
}
then {
  QueryProgram/pure: [ program: ?residualProgram; variant: "ok"; output: "filtered" ]
}
```

**Key design decisions:**

- The backend program is a complete, sealed program (scan → filter → sort →
  project → pure). It is ready to be dispatched to the kernel provider immediately.
- The residual program is structurally complete but contains an empty inline scan.
  The execute-split-query sync replaces that scan with the backend result rows
  before dispatching it to the in-memory provider.
- Both programs are tagged with a shared `viewKey` (the view name). This lets
  execute-split-query.sync find both programs when the backend program completes.
- The group stage is omitted from the residual program intentionally: grouping
  aggregates that happen in the backend are already reflected in the projected
  rows; interactive filters only need to further narrow that set. If grouping
  must be re-applied after interactive filtering, the residual program should
  include a group step (see Section 7 for the GroupSpec variant).

---

## 4. execute-split-query.sync — Design

The current `execute-query.sync` fires when any QueryProgram is sealed and
dispatches it to the kernel provider. The new sync replaces this for programs
tagged as "backend" and handles the full two-leg dispatch.

### Pseudo-sync (annotated)

```
sync ExecuteSplitQuery [eager]
  purpose: "When a backend-tagged QueryProgram is sealed, dispatch it to the
            appropriate kernel provider, then pipe the result rows into the
            paired residual program and dispatch that to the in-memory provider."
when {
  QueryProgram/pure: [ program: ?backendProgram ]
    => ok(program: ?backendProgram)
}
where {
  // Only handle programs tagged as "backend"
  QueryProgram: { ?backendProgram tag: "backend"; viewKey: ?viewKey }

  // Locate the paired residual program by shared viewKey
  QueryProgram: { ?residualProgram tag: "residual"; viewKey: ?viewKey }

  // Look up the data source kind for dispatch routing
  ViewShell/get: [ name: ?viewKey ]
    => ok(view: _; dataSource: ?dataSource)
  DataSourceSpec/get: [ name: ?dataSource ]
    => ok(source: _; kind: ?sourceKind)

  // Derive the execution kind: "kernel" for concept-action sources,
  // "remote" for remote-api, "e2ee" for encrypted-local
  bind(kindForSource(?sourceKind) as ?execKind)
}
then {
  // Dispatch backend program to kernel (or remote) provider
  QueryExecution/execute: [ program: ?backendProgram; kind: ?execKind ]
    => ok(rows: ?backendRows; metadata: _)
}
then {
  // Inject backend result rows into the residual program's scan instruction
  QueryProgram/updateScan: [
    program: ?residualProgram;
    source: { kind: "inline", rows: ?backendRows }
  ]
}
then {
  // Dispatch residual program to in-memory provider
  QueryExecution/execute: [ program: ?residualProgram; kind: "in-memory" ]
}
```

**Dispatch routing table:**

| DataSourceSpec kind | `?execKind` passed to backend execute | Notes |
|--------------------|--------------------------------------|-------|
| `concept-action` | `"kernel"` | Standard kernel invocation |
| `remote-api` | `"remote"` | Delegated to RemoteQueryProvider |
| `encrypted-local` | `"e2ee"` | Scan only; decrypt step before residual (Section 6) |

The `kindForSource` derivation is a deterministic bind expression, not a
concept action. It reads only the string value of `?sourceKind` and maps it
to the registered execution kind.

---

## 5. Feeding Backend Rows into the Residual Program

After `QueryExecution/execute` returns `ok(rows: ?backendRows)` for the backend
program, the residual program must receive those rows as its data source.

There are two equivalent mechanisms; the preferred one depends on whether
QueryProgram supports mutation of a sealed program:

**Option A — QueryProgram/updateScan (preferred)**

Add a `updateScan` action to QueryProgram that replaces the scan instruction's
source config in-place. The residual program was sealed at compile time with an
empty inline scan; `updateScan` replaces the `rows: []` with the backend result
rows before dispatch. The program re-seals (a new `pure` call is not needed
because the structure hasn't changed, only the data).

The in-memory provider's `execute` function accepts a `data` parameter (the
second argument in `execute(program, data)`). Option B exploits this.

**Option B — Pass rows as the `data` argument (simpler, no new action needed)**

The in-memory provider's execute signature is:
```typescript
execute(program: QueryProgram, data: Record<string, unknown>[] = []): Row[]
```

When a scan instruction encounters a non-inline source config, it falls back to
`data`. If `execute-split-query.sync` passes `?backendRows` as the `data`
argument when invoking `QueryExecution/execute` for the residual program, no
`updateScan` action is needed on QueryProgram at all.

In sync terms this means `QueryExecution/execute` for the in-memory kind accepts
an optional `data` field alongside `program`:

```
QueryExecution/execute: [
  program: ?residualProgram;
  kind: "in-memory";
  data: ?backendRows      // injected here
]
```

The in-memory provider reads `data` and uses it as the starting row set when the
scan instruction does not contain inline rows.

**Recommendation:** Option B is preferred for the initial implementation. It
requires no new concept actions, aligns with the existing `execute` signature, and
keeps QueryProgram immutable after sealing. Option A should be revisited if
mutable program patching becomes needed for other reasons (e.g., hot-swapping
parameter bindings).

---

## 6. E2EE Decrypt Between Scan and Residual Filter

For views backed by an `encrypted-local` DataSourceSpec, the backend program
fetches ciphertext rows from the kernel and returns them as opaque blobs. Before
the residual filter can run, each row must be decrypted client-side. This decrypt
step inserts between stage 4a (backend execution) and stage 4b (residual
dispatch).

### Modified execute-split-query flow for E2EE

```
when {
  QueryProgram/pure: [ program: ?backendProgram ]
    => ok(program: ?backendProgram)
}
where {
  QueryProgram: { ?backendProgram tag: "backend"; viewKey: ?viewKey }
  DataSourceSpec: { ?ds kind: "encrypted-local" }   // guard: E2EE path only
  ...
}
then {
  // Execute backend — returns ciphertext blobs, not plaintext rows
  QueryExecution/execute: [ program: ?backendProgram; kind: "e2ee" ]
    => ok(rows: ?ciphertextRows; metadata: _)
}
then {
  // E2EEProvider/decrypt takes the ciphertext rows and the key material
  // identified by the DataSourceSpec's keyRef. Returns plaintext rows.
  E2EEProvider/decrypt: [ rows: ?ciphertextRows; keyRef: ?keyRef ]
    => ok(rows: ?plaintextRows)
}
then {
  // Feed plaintext rows into residual program via inline data injection
  QueryExecution/execute: [
    program: ?residualProgram;
    kind: "in-memory";
    data: ?plaintextRows
  ]
}
```

**Provider capability declaration for E2EE:**

The `e2ee` provider registers with `capabilities: ["scan"]` only. When
`QueryExecution/planPushdown` is called for this provider, every instruction
except scan is returned in the residual. This means the backend program for an
E2EE view contains only a scan instruction; filter, sort, group, and project
are all in the residual program.

The decrypt step is not a QueryProgram instruction — it is an explicit sync
step between the two execution legs. This keeps the QueryProgram language
pure and provider-agnostic. E2EE key management is handled by a separate
concept (E2EEProvider) and is outside the scope of this document.

---

## 7. Interaction with the Three Existing CompileQuery Variants

The current `compile-query.sync` has three variants that handle progressively
richer program structures. The new split-execution design must preserve the
same program-shape variations.

### CompileQuery (baseline)

The simplest variant: scan → filter → sort → project → pure. In split
execution:

- Backend program: scan → filter(backend) → sort → project → pure
- Residual program: filter(residual) → pure

This is the direct split of the existing CompileQuery variant.

### CompileQueryWithSchemaJoin

Applies when `?sourceConfig = "node"` (ContentNode sources). The join step
enriches each scanned row with schema membership data before the filter runs.
In split execution the join must remain in the backend program (it joins
against a server-side relation):

- Backend program: scan → join(membership) → filter(backend) → sort → project → pure
- Residual program: filter(residual) → pure

The `guard(?sourceConfig = "node")` test from the existing sync is preserved
in the `where` clause of `compile-split-query.sync`. When true, the join
instruction is inserted between scan and filter in the backend program. The
residual program is unchanged.

### CompileQueryWithGroup

Applies when `?group != ""` — the view has a non-empty GroupSpec. Grouping
is an aggregation that must happen after initial filtering and before sorting.
In split execution:

**Standard case (group is backend-only):**

- Backend program: scan → filter(backend) → group → sort → project → pure
- Residual program: filter(residual) → pure

Post-grouping interactive filters operate on the already-grouped and aggregated
rows. This works correctly because the in-memory provider handles filter
instructions on GroupBucket objects by treating `key + aggregates` as a flat
row.

**If interactive filters reference ungrouped fields:**

If any residual FilterSpec references a raw record field that is not preserved
in the projected group key or aggregation aliases, those filters cannot be
applied after grouping. This is a compile-time validation concern (checked
against the ProjectionSpec) rather than a runtime concern. The design doc for
MAG-517 (FilterSpec sourceType routing rules) should enforce that filters on
non-projected fields must be `system` or `contextual`, not `interactive`.

The `guard(?group != "")` test from the existing `CompileQueryWithGroup` is
preserved in `compile-split-query.sync` to select the group-inclusive backend
program shape.

### Precedence between variants

All three variants fire on the same trigger (`ViewShell/resolve => ok`). The
existing `compile-query.sync` uses guards to select the right variant; the new
`compile-split-query.sync` must do the same:

| Condition | Backend program shape |
|-----------|----------------------|
| `sourceConfig = "node"` AND `group != ""` | scan → join → filter(B) → group → sort → project → pure |
| `sourceConfig = "node"` | scan → join → filter(B) → sort → project → pure |
| `group != ""` | scan → filter(B) → group → sort → project → pure |
| (none of the above) | scan → filter(B) → sort → project → pure |

These four shapes can be expressed as four `sync` declarations in
`compile-split-query.sync`, each with the appropriate guards, mirroring the
existing three-variant pattern. Alternatively a single sync with conditional
instruction emission may be used if the sync grammar supports it.

---

## 8. Edge Cases

### 8.1 All filters are interactive — no backend filter

When a view has filters but all of them are `interactive` or `search`:

- `backendFilterTree` evaluates to `{ type: "true" }` (identity node).
- The backend program becomes: scan → filter(true) → sort → project → pure.
- The `filter(true)` instruction is a no-op that passes every scanned row
  through unchanged.
- The runtime cost of a no-op filter is negligible; the instruction can
  optionally be elided by a compile-time optimization pass that detects
  `{ type: "true" }` filter nodes.
- The residual program carries the full interactive filter tree and does all
  meaningful filtering.

This is the correct behavior: all records are fetched from the backend, all
filtering happens locally.

### 8.2 All filters are system/contextual — no residual filter

When a view has filters but all of them are `system` or `contextual`:

- `residualFilterTree` evaluates to `{ type: "true" }` (identity node).
- The residual program becomes: filter(true) → pure.
- The `filter(true)` instruction is a no-op.
- The final result rows are exactly the backend result rows with no further
  transformation.

An optimization: if `residualFilterTree = { type: "true" }` AND the residual
program contains no other non-trivial instructions, the execute-split-query sync
can skip the second `QueryExecution/execute` call entirely and return the backend
rows directly. This avoids an unnecessary in-memory provider invocation.

Whether to apply this optimization is a runtime concern and does not affect the
compile-time sync structure.

### 8.3 View has no filters at all

When a ViewShell has `filter: ""` (empty string reference):

- The `ViewResolve` sync still calls `FilterSpec/get(name: "")`.
- The FilterSpec handler should return `notfound` for an empty name.
- The `where` clause in `compile-split-query.sync` guards on this: if
  FilterSpec/get returns `notfound`, the filter name is absent and the sync
  should treat both trees as `{ type: "true" }`.

Concretely: the `where` clause should use a `not` guard or optional pattern to
detect the empty-filter case and bind identity nodes as the default for both
`?backendFilterTree` and `?residualFilterTree`.

Both the backend program and the residual program then contain no-op filter
instructions. The full pipeline still executes but applies no predicates. This
is semantically correct: a view with no filters returns all records.

### 8.4 ViewShell has no sort or projection

If `sort: ""` or `projection: ""`:

- SortSpec/get and ProjectionSpec/get return `notfound` for empty names.
- The backend program omits the sort or project instruction respectively.
- The minimal backend program for a bare view (no filter, no sort, no
  projection) is: scan → pure.
- This is valid; the in-memory provider handles an empty instruction list
  by returning an empty result (per its current implementation). The sync
  should emit at minimum a scan and a pure instruction to produce a well-formed
  sealed program.

### 8.5 Backend execution returns zero rows

When the backend program executes and returns an empty result set:

- `?backendRows` is an empty JSON array `[]`.
- The inline scan in the residual program receives `rows: []`.
- The in-memory provider's filter, sort, project instructions all operate on
  an empty array and return an empty array.
- The final result is an empty row set. This is correct behavior.

### 8.6 search sourceType with a provider that declares search pushdown

For `search` filters, the default routing is residual. A provider may declare
`"search"` in its `pushdownOps` (e.g., a full-text search index). The
`compile-split-query.sync` should check the DataSourceSpec's `pushdownOps`
field and promote `search` filters to the backend bucket when the provider
declares it:

```
searchFilters = filters where sourceType = "search"
if dataSourceSpec.pushdownOps includes "search":
    backendFilters += searchFilters
else:
    residualFilters += searchFilters
```

This promotion happens at compile time in the `where` clause. It is a
per-view, per-provider decision and does not require any change to the
FilterSpec concept.

---

## 9. Conceptual Boundaries: What Each Artifact Owns

| Artifact | Responsibility |
|----------|---------------|
| `ViewShell` | Stable name; holds references to child spec names. Owns no query logic. |
| `FilterSpec` | Single predicate tree + sourceType classification. No knowledge of execution. |
| `DataSourceSpec` | Source kind, connection config, pushdown capability declarations. |
| `QueryProgram` | Ordered instruction sequence. Immutable after sealing. No knowledge of providers. |
| `QueryExecution` | Provider registry + dispatch. Knows kinds and capabilities; knows nothing about view structure. |
| `compile-split-query.sync` | Partitioning logic. Bridges ViewShell resolution to QueryProgram compilation. |
| `execute-split-query.sync` | Two-leg dispatch. Bridges QueryProgram sealing to QueryExecution invocation. |
| `in-memory-provider.ts` | Pure evaluation of all instruction types against in-process row arrays. |
| `filter-evaluator.ts` (legacy) | To be retired after Phase H. Currently duplicates in-memory-provider logic. |

---

## 10. Files Affected by This Design

| File | Change type |
|------|-------------|
| `syncs/view/compile-split-query.sync` | New — implements the split compilation logic described in Section 3 |
| `syncs/view/execute-split-query.sync` | New — implements the two-leg dispatch described in Section 4 |
| `syncs/view/compile-query.sync` | Preserved as-is — simple-path fallback for views without split-execution tagging |
| `syncs/view/execute-query.sync` | Preserved as-is — fallback for programs not tagged with "backend" |
| `handlers/ts/view/query-execution.handler.ts` | Extend `execute` to accept optional `data` field (Option B from Section 5) |
| `handlers/ts/view/providers/kernel-query-provider.ts` | Register with declared capabilities: `["scan","filter","sort","limit","join"]` |
| `handlers/ts/view/providers/in-memory-provider.ts` | Accept `data` argument in `execute` call path when `kind = "in-memory"` is invoked with explicit data |
| `handlers/ts/view/providers/e2ee-provider.ts` | New (Phase F) — scan-only provider; decrypt step wired in sync |
