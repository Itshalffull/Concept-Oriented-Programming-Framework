# PRD: View Query Pipeline Migration

Migrate clef-base from legacy monolithic View entities to the decomposed view query system (QueryProgram, FilterSpec, SortSpec, GroupSpec, ProjectionSpec, DataSourceSpec, PresentationSpec, ViewShell) with split-execution support for backend, local, and E2EE data sources.

**Status:** Draft
**Date:** 2026-04-06

---

## 1. Problem Statement

clef-base currently uses two parallel view systems:

1. **Legacy `View` entities** — monolithic JSON blobs with inline dataSource, filters, sorts, visibleFields, controls. This is what actually renders.
2. **Decomposed spec entities** — ViewShell, FilterSpec, SortSpec, DataSourceSpec, ProjectionSpec, PresentationSpec seeds exist (63 filters, 30 projections, 18 data sources, 13 presentations, 27 view shells) but are never hydrated or used for rendering.

ViewRenderer has a dual-path that tries ViewShell first, but ViewShell/resolve doesn't hydrate child specs, so it falls back to View/get every time. Filter evaluation uses a local copy (`filter-evaluator.ts`) extracted from the spec handlers — correct behavior, but disconnected from the spec system.

### Why this matters

- **No split execution** — all filtering happens either fully server-side or fully client-side. No way to push system filters to the backend while keeping interactive toggles local.
- **No E2EE support** — encrypted data sources need all processing done locally after decrypt. The current pipeline can't express "fetch ciphertext from kernel, decrypt, then filter/sort locally."
- **No query optimization** — without QueryProgram, there's no inspectable instruction sequence to analyze, cache, or pushdown.
- **Duplicated logic** — filter-evaluator.ts is a copy-paste of FilterSpec handler logic. Changes diverge.
- **No composability** — views can't share or compose filter/sort/projection configs.

---

## 2. Goals

1. **Complete the migration** from legacy View entities to the decomposed spec system
2. **Implement split execution** — backend pushdown + local residual for each view
3. **Support three data tiers** — normal (kernel), remote API, and E2EE (fully local)
4. **Eliminate filter-evaluator.ts duplication** — use the in-memory provider directly
5. **Preserve the dual-path** during migration — no big-bang cutover

---

## 3. Architecture: Three-Tier Execution Model

<!-- Card: MAG-515 -->

### 3.1 Execution Tiers

| Tier | Data Source Kind | Backend Pushdown | Local Residual | Example |
|------|-----------------|-----------------|----------------|---------|
| **Kernel** | `concept-action` | system + contextual filters, sort, group, project | interactive filters, exposed sorts | ContentNode/list, Schema/list |
| **Remote** | `remote-api` | what the API supports (per `pushdownOps`) | everything else | Dev.to API, GitHub API |
| **E2EE Local** | `encrypted-local` | scan only (fetch ciphertext) | decrypt → all filter/sort/group/project | E2EE content vaults |

### 3.2 Split Execution Flow

<!-- Card: MAG-516 -->

```
ViewShell/resolve
  → collect child specs (DataSourceSpec, FilterSpec, SortSpec, ...)
  → partition filters by sourceType:
      system + contextual  → backend program
      interactive + search → residual program
  → compile-query.sync builds TWO programs (or planPushdown splits one)
  → execute backend program via QueryExecution (kind per DataSourceSpec)
  → [E2EE only: decrypt step]
  → execute residual program via in-memory provider on result set
  → return final rows
```

### 3.3 FilterSpec sourceType → Execution Routing

<!-- Card: MAG-517 -->

| sourceType | Routing | Rationale |
|-----------|---------|-----------|
| `system` | Backend pushdown | Always-on filters (soft-delete exclusion, tenant scoping). Never changes per interaction. |
| `contextual` | Backend pushdown | Derived from URL/navigation context. Known before query. |
| `interactive` | Local residual | User toggle clicks, search boxes. Changes frequently, ephemeral. |
| `search` | Depends on provider | Full-text search may push down to search index or run locally. |

### 3.4 Provider Capabilities

<!-- Card: MAG-518 -->

Each QueryExecution provider declares what it can push down:

```
kernel provider:     capabilities = ["scan", "filter", "sort", "limit", "join"]
in-memory provider:  capabilities = ["filter", "sort", "group", "project", "limit"]
remote provider:     capabilities = per pushdownOps registration
e2ee provider:       capabilities = ["scan"]  // fetch only, everything else residual
```

The `planPushdown` action on QueryExecution splits a program based on these capabilities.

---

## 4. Migration Phases

### Phase A: Register Spec Concepts in Kernel

<!-- Card: MAG-519 -->

Register the 12 view suite concept handlers in clef-base's kernel registry so they can be invoked:

- FilterSpec, SortSpec, GroupSpec, ProjectionSpec
- DataSourceSpec, PresentationSpec, InteractionSpec
- ViewShell
- QueryProgram, QueryExecution
- FilterRepresentation, RemoteQueryProvider

**Files to modify:**
- `clef-base/lib/kernel.ts` or `generated/kernel-registry.ts` — add imports and registrations
- Verify handlers at `handlers/ts/view/*.handler.ts` are importable

**Acceptance:** `kernel.invokeConcept('urn:clef/FilterSpec', 'get', { name: 'schemas-toggle-filter' })` returns the seeded filter.

### Phase B: Wire ViewShell Hydration

<!-- Card: MAG-520 -->

Make ViewShell/resolve actually hydrate child spec references by loading them from their respective concepts.

**Current state:** ViewShell/resolve returns reference names as strings. ViewRenderer parses these as if they were inline JSON (which fails silently).

**Target state:** ViewShell/resolve returns a fully hydrated config with actual FilterNode trees, SortKey arrays, ProjectionField arrays, DataSourceConfig objects, etc.

**Approach:** Either:
- (a) Add a `resolveHydrated` action to ViewShell that calls FilterSpec/get, SortSpec/get, etc. and returns the assembled config, OR
- (b) Let the `view-resolve.sync` handle hydration by chaining child spec gets into the ViewShell completion

**Files to modify:**
- `handlers/ts/view/view-shell.handler.ts` — add hydration action or enrich resolve
- `syncs/view/view-resolve.sync` — wire child spec gets

**Acceptance:** ViewRenderer receives hydrated filter trees, sort keys, projection fields from ViewShell without calling View/get.

### Phase C: Implement Split-Execution Compilation

<!-- Card: MAG-521 -->

Modify compile-query.sync to partition filters by sourceType and produce a split program.

**Current state:** compile-query.sync builds one monolithic QueryProgram with all filters composed.

**Target state:** Two programs compiled:
1. **Backend program** — scan + system/contextual filters + sort + project + pure
2. **Residual program** — interactive/search filters + exposed sort overrides

**New sync:** `compile-split-query.sync`

```
when ViewShell/resolve => ok
where:
  - load all FilterSpecs for this view
  - partition by sourceType (system+contextual vs interactive+search)
  - compose backend filters into one FilterNode
  - compose residual filters into one FilterNode
then:
  - QueryProgram/create (backend) → scan → filter(backend) → sort → project → pure
  - QueryProgram/create (residual) → filter(residual) → pure
```

**Files to create:**
- `syncs/view/compile-split-query.sync`

**Files to modify:**
- `syncs/view/compile-query.sync` — keep as simple-path fallback

**Acceptance:** A view with both system and interactive filters produces two separate QueryPrograms.

### Phase D: Implement QueryExecution Dispatch

<!-- Card: MAG-522 -->

Wire QueryExecution to dispatch backend programs to the kernel provider and residual programs to the in-memory provider.

**Current state:** execute-query.sync hardcodes `kind: "kernel"`.

**Target state:** 
- Backend program → `QueryExecution/execute(program, "kernel")`
- Residual program → runs via in-memory provider on the backend result set
- E2EE sources → `QueryExecution/execute(program, "in-memory")` after client decrypt

**New sync:** `execute-split-query.sync`

**Files to create:**
- `syncs/view/execute-split-query.sync`

**Files to modify:**
- `handlers/ts/view/providers/kernel-query-provider.ts` — register with declared capabilities
- `handlers/ts/view/providers/in-memory-provider.ts` — register with declared capabilities

**Acceptance:** A split query executes backend portion on kernel, residual portion in-memory, returns unified result.

### Phase E: Update ViewRenderer to Use Hydrated Specs

<!-- Card: MAG-523 -->

Replace ViewRenderer's legacy View/get path with the hydrated ViewShell path.

**Current state:** ViewRenderer dual-path prefers ViewShell but falls back to View/get. Filter evaluation uses local filter-evaluator.ts functions.

**Target state:**
- ViewRenderer uses hydrated ViewShell config exclusively (for migrated views)
- Interactive filters still evaluated locally but via the in-memory provider (not duplicated filter-evaluator.ts)
- Legacy View/get path preserved as fallback for unmigrated views

**Files to modify:**
- `clef-base/app/components/ViewRenderer.tsx` — use hydrated spec values, delegate residual filtering to in-memory provider
- Eventually deprecate direct filter-evaluator.ts usage

**Acceptance:** Content list page renders using ViewShell hydration with split-execution. Toggle filters work locally. System filters push down to kernel.

### Phase F: E2EE Data Source Support

<!-- Card: MAG-524 -->

Add an `encrypted-local` DataSourceSpec kind that fetches ciphertext from kernel, decrypts client-side, then runs the full query pipeline locally via in-memory provider.

**Design:**
- DataSourceSpec kind = `"encrypted-local"` signals E2EE pipeline
- A decrypt transform runs between scan result and filter stage
- All filter/sort/group/project executes via in-memory provider
- The kernel provider for this kind has `capabilities: ["scan"]` only — everything else is residual

**Files to create:**
- `handlers/ts/view/providers/e2ee-provider.ts` — scan + decrypt, then delegate to in-memory
- Sync or ViewRenderer logic to detect `encrypted-local` kind and route accordingly

**Acceptance:** An E2EE data source fetches encrypted blobs, decrypts client-side, then applies all filters/sorts locally.

### Phase G: Migrate Seed Data

<!-- Card: MAG-525 -->

Migrate all 27 ViewShell seeds to be the primary data source. Verify each ViewShell entity correctly references its child specs. Deprecate corresponding View.seeds.yaml entries.

**Current state:** Both View.seeds.yaml (legacy) and ViewShell.seeds.yaml (new) exist with overlapping entries.

**Target state:** ViewShell seeds are authoritative. View seeds kept only for unmigrated edge cases.

**Files to modify:**
- `clef-base/seeds/ViewShell.seeds.yaml` — verify all 27 entries reference correct child specs
- `clef-base/seeds/View.seeds.yaml` — mark migrated entries as deprecated
- Verify seed loading order (ViewShell after child specs)

**Acceptance:** All 14 clef-base pages render from ViewShell seeds without falling back to View/get.

### Phase H: Eliminate filter-evaluator.ts Duplication

<!-- Card: MAG-526 -->

Replace the duplicated filter-evaluator.ts with imports from the in-memory provider or a shared module.

**Current state:** Three copies of FilterNode/SortKey types:
1. `handlers/ts/view/filter-spec.handler.ts`
2. `handlers/ts/view/providers/in-memory-provider.ts`
3. `clef-base/lib/filter-evaluator.ts`

**Target state:** Single source of truth for FilterNode types and evaluation logic. clef-base imports from the provider or a shared package.

**Files to modify:**
- Extract shared types to a common module (e.g., `handlers/ts/view/types.ts`)
- `clef-base/lib/filter-evaluator.ts` — replace with re-exports from shared module
- `handlers/ts/view/providers/in-memory-provider.ts` — import from shared module

**Acceptance:** FilterNode type changes propagate to all consumers without copy-paste.

### Phase I: Remove Legacy View Fallback

<!-- Card: MAG-527 -->

Once all views are migrated and verified, remove the View/get fallback path from ViewRenderer.

**Current state:** ViewRenderer dual-path with View/get as fallback.

**Target state:** ViewRenderer uses ViewShell exclusively. View concept remains registered (for backward compat) but ViewRenderer doesn't query it.

**Files to modify:**
- `clef-base/app/components/ViewRenderer.tsx` — remove legacy path
- `clef-base/seeds/View.seeds.yaml` — can be removed entirely

**Acceptance:** ViewRenderer has a single code path. No dual-path branching.

---

## 5. View Suite Concept Inventory

| Concept | Handler | Seeds | Status |
|---------|---------|-------|--------|
| FilterSpec | `handlers/ts/view/filter-spec.handler.ts` | 63 entries | Handler exists, not registered in kernel |
| SortSpec | `handlers/ts/view/sort-spec.handler.ts` | 1 entry | Handler exists, not registered in kernel |
| GroupSpec | `handlers/ts/view/group-spec.handler.ts` | 1 entry | Handler exists, not registered in kernel |
| ProjectionSpec | `handlers/ts/view/projection-spec.handler.ts` | 30 entries | Handler exists, not registered in kernel |
| DataSourceSpec | `handlers/ts/view/data-source-spec.handler.ts` | 18 entries | Handler exists, not registered in kernel |
| PresentationSpec | `handlers/ts/view/presentation-spec.handler.ts` | 13 entries | Handler exists, not registered in kernel |
| InteractionSpec | `handlers/ts/view/interaction-spec.handler.ts` | (check) | Handler exists, not registered in kernel |
| ViewShell | `handlers/ts/view/view-shell.handler.ts` | 27 entries | Handler exists, not registered in kernel |
| QueryProgram | `handlers/ts/view/query-program.handler.ts` | — | Handler exists, not registered in kernel |
| QueryExecution | `handlers/ts/view/query-execution.handler.ts` | — | Handler exists, not registered in kernel |
| FilterRepresentation | `handlers/ts/view/filter-representation.handler.ts` | — | Handler exists, not registered in kernel |
| RemoteQueryProvider | `handlers/ts/view/remote-query-provider.handler.ts` | — | Handler exists, not registered in kernel |

**Providers:**
- `handlers/ts/view/providers/in-memory-provider.ts` — full local evaluation
- `handlers/ts/view/providers/kernel-query-provider.ts` — kernel-delegated evaluation
- `handlers/ts/view/providers/toggle-group-provider.ts` — FilterRepresentation toggle-group kind
- `handlers/ts/view/providers/text-dsl-provider.ts` — FilterRepresentation text DSL kind
- `handlers/ts/view/providers/url-params-provider.ts` — FilterRepresentation URL params kind
- `handlers/ts/view/providers/contextual-provider.ts` — FilterRepresentation contextual kind

---

## 6. Sync Inventory

| Sync | File | Status |
|------|------|--------|
| view-resolve | `syncs/view/view-resolve.sync` | Exists, needs hydration wiring |
| compose-filters | `syncs/view/compose-filters.sync` | Exists |
| compile-query | `syncs/view/compile-query.sync` | Exists (3 variants), needs split-execution variant |
| execute-query | `syncs/view/execute-query.sync` | Exists, hardcodes `kind: "kernel"` |
| filter-from-dsl | `syncs/view/filter-from-dsl.sync` | Exists |
| filter-to-dsl | `syncs/view/filter-to-dsl.sync` | Exists |
| compile-remote-query | `syncs/view/compile-remote-query.sync` | Exists |
| execute-remote-query | `syncs/view/execute-remote-query.sync` | Exists |
| **compile-split-query** | `syncs/view/compile-split-query.sync` | **NEW — needs creation** |
| **execute-split-query** | `syncs/view/execute-split-query.sync` | **NEW — needs creation** |

---

## 7. Risk & Rollback

- **Dual-path preserved** — every phase keeps the View/get fallback until Phase I (final removal)
- **Incremental migration** — each ViewShell entity can be migrated independently
- **Seed-only changes in Phase G** — no code changes, just seed data verification
- **filter-evaluator.ts kept** until Phase H — no behavior change for interactive filters
- **E2EE (Phase F) is additive** — doesn't modify existing paths

---

## 8. Card Reference Index

| Card ID | PRD Section | Title |
|---------|-------------|-------|
| MAG-515 | 3.1 | Three-Tier Execution Model Design |
| MAG-516 | 3.2 | Split Execution Flow Design |
| MAG-517 | 3.3 | FilterSpec sourceType Routing Rules |
| MAG-518 | 3.4 | Provider Capabilities Declaration |
| MAG-519 | Phase A | Register Spec Concepts in Kernel |
| MAG-520 | Phase B | Wire ViewShell Hydration |
| MAG-521 | Phase C | Implement Split-Execution Compilation |
| MAG-522 | Phase D | Implement QueryExecution Dispatch |
| MAG-523 | Phase E | Update ViewRenderer to Use Hydrated Specs |
| MAG-524 | Phase F | E2EE Data Source Support |
| MAG-525 | Phase G | Migrate Seed Data |
| MAG-526 | Phase H | Eliminate filter-evaluator.ts Duplication |
| MAG-527 | Phase I | Remove Legacy View Fallback |
