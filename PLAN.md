# Generation Suite Implementation Plan

## Summary

Implement the Generation Suite per `concept-generate/clef-generation-suite.md`. Creates 5 new concepts (Resource, KindSystem, BuildCache, GenerationPlan, Emitter) in `kits/generation/`, with 14 shared syncs, TypeScript implementations, and conformance + integration tests. Follows the doc's 6-phase ordering: Emitter → BuildCache → Resource → KindSystem → GenerationPlan → Traceability.

## Existing State (what we're building on)

- **Emitter already exists** at `kits/interface/concepts/emitter.concept` with impl at `implementations/typescript/framework/emitter.impl.ts`. It has `write`, `format`, `clean`, `manifest` actions. The generation suite version extends this with `writeBatch`, `trace`, `affected`, `audit`, and `sourceMap` state. This is a **promote + extend**, not a greenfield build.
- **PluginRegistry exists** at `kits/infrastructure/plugin-registry.concept` with `discover`, `getDefinitions`, `createInstance` etc. GenerationPlan can query this directly.
- **Cache concept exists** at `kits/infrastructure/cache.concept` (tag-based `set`/`get`/`invalidate`). BuildCache is a different concept — specialized for generation step hashes, not general caching.
- **CacheCompiler does NOT exist** — the doc's mention of migrating its caching concern is future-looking. BuildCache is greenfield.
- **SchemaGen exists** with `generate(spec, ast) → ok(manifest)`. This is the upstream trigger for framework generators.
- **Interface suite syncs** (plan → generate → dispatch → write → format → clean) stay unchanged. BuildCache wraps target providers via new syncs added to the Clef Bind.

---

## Phase 1: Suite Scaffolding + Emitter (promote + extend)

### Step 1.1 — Create directory structure
```
kits/generation/
├── suite.yaml
├── syncs/
├── implementations/typescript/
└── tests/
    ├── conformance/
    └── integration/
```

### Step 1.2 — Write `emitter.concept`
Create `kits/generation/emitter.concept` — the full spec from architecture doc Section 1.5. This extends the existing Clef Bind Emitter with:
- `writeBatch` action (atomic multi-file writes)
- `sourceMap` state (source traceability)
- `trace` action (output → source query)
- `affected` action (source → outputs query)
- `audit` action (drift detection)

### Step 1.3 — Write Emitter implementation
Create `kits/generation/implementations/typescript/emitter.impl.ts`.
Port the existing `implementations/typescript/framework/emitter.impl.ts` as the starting point, then extend with:
- `writeBatch`: iterate files, compute hashes, atomic manifest update
- `trace`: lookup sourceMap by output path
- `affected`: reverse lookup sourceMap by source path
- `audit`: compare manifest hashes against filesystem

### Step 1.4 — Write Emitter conformance tests
Create `kits/generation/tests/conformance/emitter.test.ts`.
Tests from the concept's invariants:
- Write same content twice → second returns `written: false`
- Write with sources → trace returns those sources
- Write with sources → affected returns the output path
- writeBatch atomic: if one file would fail, none are written
- clean removes only manifest-tracked orphans
- audit detects drifted, missing, orphaned states

### Step 1.5 — Write `format-after-write.sync` and `format-batch-after-write.sync`
Create `kits/generation/syncs/format-after-write.sync` and `kits/generation/syncs/format-batch-after-write.sync` — from doc Section 2.6.

### Step 1.6 — Write stub `suite.yaml`
Create `kits/generation/suite.yaml` with just the Emitter concept and format syncs. We'll add concepts incrementally as each phase completes.

---

## Phase 2: BuildCache

### Step 2.1 — Write `build-cache.concept`
Create `kits/generation/build-cache.concept` — full spec from doc Section 1.3. Actions: `check`, `record`, `invalidate`, `invalidateBySource`, `invalidateByKind`, `invalidateAll`, `status`, `staleSteps`.

### Step 2.2 — Write BuildCache implementation
Create `kits/generation/implementations/typescript/build-cache.impl.ts`.
- In-memory Map<stepKey, CacheEntry> storage
- `check`: compare inputHash against stored, respect deterministic flag
- `record`: upsert entry with timestamp
- `invalidate*`: clear matching entries, return invalidated keys
- `staleSteps`: return keys of invalidated entries

### Step 2.3 — Write BuildCache conformance tests
Create `kits/generation/tests/conformance/build-cache.test.ts`.
Tests from invariants:
- record then check same hash → unchanged
- record then check different hash → changed with previousHash
- invalidate then check → changed (even with same hash)
- invalidateBySource clears all entries with matching sourceLocator
- invalidateAll clears everything
- staleSteps returns invalidated step keys

### Step 2.4 — Update suite.yaml
Add BuildCache concept to `kits/generation/suite.yaml`.

---

## Phase 3: Resource

### Step 3.1 — Write `resource.concept`
Create `kits/generation/resource.concept` — full spec from doc Section 1.1. Actions: `upsert`, `get`, `list`, `remove`, `diff`.

### Step 3.2 — Write Resource implementation
Create `kits/generation/implementations/typescript/resource.impl.ts`.
- In-memory Map<locator, ResourceEntry> storage
- `upsert`: compare digest → created/changed/unchanged variants
- `diff`: classify change type (content/structural/breaking) — initially returns "unknown" for all kinds, with kind-specific logic added later

### Step 3.3 — Write Resource conformance tests
Create `kits/generation/tests/conformance/resource.test.ts`.
Tests from invariants:
- upsert new → created, then get → ok
- upsert same digest → unchanged
- upsert different digest → changed with previousDigest
- remove → ok, then get → notFound
- list filters by kind

### Step 3.4 — Write input tracking syncs
Create in `kits/generation/syncs/`:
- `file-changed.sync` (FileWatcher create → Resource/upsert)
- `file-modified.sync` (FileWatcher modify → Resource/upsert)
- `file-removed.sync` (FileWatcher delete → Resource/remove)

### Step 3.5 — Write change propagation syncs
Create in `kits/generation/syncs/`:
- `invalidate-on-resource-change.sync` (Resource/changed → BuildCache/invalidateBySource)
- `invalidate-on-resource-remove.sync` (Resource/remove → BuildCache/invalidateBySource)

### Step 3.6 — Write incremental rebuild integration test
Create `kits/generation/tests/integration/incremental-rebuild.test.ts`:
- Resource upsert with changed digest → BuildCache entries invalidated
- Resource upsert with same digest → BuildCache entries untouched

### Step 3.7 — Update suite.yaml
Add Resource concept and all syncs from this phase.

---

## Phase 4: KindSystem

### Step 4.1 — Write `kind-system.concept`
Create `kits/generation/kind-system.concept` — full spec from doc Section 1.2. Actions: `define`, `connect`, `route`, `validate`, `dependents`, `producers`, `consumers`, `graph`.

### Step 4.2 — Write KindSystem implementation
Create `kits/generation/implementations/typescript/kind-system.impl.ts`.
- Adjacency list graph structure (kinds as nodes, edges with relation/transformName)
- `route`: BFS shortest path
- `dependents`: transitive closure via DFS
- `connect`: cycle detection before adding edge
- `graph`: return full adjacency list

### Step 4.3 — Write KindSystem conformance tests
Create `kits/generation/tests/conformance/kind-system.test.ts`.
Tests from invariants:
- define + connect → validate ok
- define + connect → route returns path
- define + connect → dependents returns downstream
- connect with cycle → invalid
- producers/consumers return correct transforms

### Step 4.4 — Write kind registration syncs
Create in `kits/generation/syncs/`:
- `register-generator-kinds.sync` (PluginRegistry/register → KindSystem/connect)
- `ensure-kinds-defined.sync` (PluginRegistry/register → KindSystem/define)

### Step 4.5 — Write cascade invalidation syncs
Create in `kits/generation/syncs/`:
- `cascade-invalidation.sync` (BuildCache/invalidateBySource → KindSystem/dependents)
- `invalidate-dependent-kinds.sync` (KindSystem/dependents → BuildCache/invalidateByKind)

### Step 4.6 — Write cascade invalidation integration test
Create `kits/generation/tests/integration/cascade-invalidation.test.ts`:
- Register kinds + edges → change source → verify all downstream cache entries invalidated

### Step 4.7 — Update suite.yaml
Add KindSystem concept and all syncs from this phase.

---

## Phase 5: GenerationPlan

### Step 5.1 — Write `generation-plan.concept`
Create `kits/generation/generation-plan.concept` — full spec from doc Section 1.4. Actions: `plan`, `begin`, `recordStep`, `complete`, `status`, `summary`, `diff`, `history`.

### Step 5.2 — Write GenerationPlan implementation
Create `kits/generation/implementations/typescript/generation-plan.impl.ts`.
- `plan`: queries (simulated) PluginRegistry + KindSystem + BuildCache to build plan
- `begin`/`complete`: manage activeRun lifecycle
- `recordStep`: append step result to active run
- `summary`: aggregate stats from run steps
- `history`: return recent runs

### Step 5.3 — Write GenerationPlan conformance tests
Create `kits/generation/tests/conformance/generation-plan.test.ts`.
- begin → recordStep → complete → status shows all steps
- summary returns correct aggregates
- plan returns steps with willRun/reason

### Step 5.4 — Write observer syncs
Create in `kits/generation/syncs/`:
- `observe-cache-hit.sync` (BuildCache/unchanged → GenerationPlan/recordStep cached)
- `observe-run-begin.sync` (CliCommand/generate → GenerationPlan/begin)
- `observe-run-complete.sync` (SyncEngine/quiesced → GenerationPlan/complete)

### Step 5.5 — Write orphan cleanup sync
Create `kits/generation/syncs/clean-orphans-after-run.sync` (GenerationPlan/complete → Emitter/clean).

### Step 5.6 — Write multi-family integration test
Create `kits/generation/tests/integration/multi-family-generation.test.ts`:
- Begin run → record steps from multiple families → complete → verify summary

### Step 5.7 — Finalize suite.yaml
Add GenerationPlan concept, all remaining syncs, and the `uses: infrastructure/PluginRegistry` dependency. This is the complete suite.yaml matching the architecture doc Part 4.

---

## Phase 6: Traceability and Audit (polish)

### Step 6.1 — Write orphan cleanup integration test
Create `kits/generation/tests/integration/orphan-cleanup.test.ts`:
- Write files via Emitter → remove source → clean → verify orphans removed

### Step 6.2 — Trace/affected/audit tests
Add to `kits/generation/tests/conformance/emitter.test.ts` (already created in Phase 1):
- `trace` returns sources for a written file
- `affected` returns output paths for a source
- `audit` detects drifted/missing/orphaned states

These tests are already written in Phase 1. This step ensures they pass after all integrations.

---

## File Inventory (total deliverables)

### Concept specs (5 files)
- `kits/generation/resource.concept`
- `kits/generation/kind-system.concept`
- `kits/generation/build-cache.concept`
- `kits/generation/generation-plan.concept`
- `kits/generation/emitter.concept`

### Sync specs (14 files in `kits/generation/syncs/`)
**Required (6):**
- `file-changed.sync`
- `file-modified.sync`
- `file-removed.sync`
- `register-generator-kinds.sync`
- `ensure-kinds-defined.sync`
- `format-after-write.sync`

**Recommended (8):**
- `format-batch-after-write.sync`
- `invalidate-on-resource-change.sync`
- `invalidate-on-resource-remove.sync`
- `cascade-invalidation.sync`
- `invalidate-dependent-kinds.sync`
- `observe-cache-hit.sync`
- `observe-run-begin.sync`
- `observe-run-complete.sync`
- `clean-orphans-after-run.sync`

### Kit manifest (1 file)
- `kits/generation/suite.yaml`

### TypeScript implementations (5 files in `kits/generation/implementations/typescript/`)
- `resource.impl.ts`
- `kind-system.impl.ts`
- `build-cache.impl.ts`
- `generation-plan.impl.ts`
- `emitter.impl.ts`

### Tests (9 files)
**Conformance (5 in `kits/generation/tests/conformance/`):**
- `resource.test.ts`
- `kind-system.test.ts`
- `build-cache.test.ts`
- `generation-plan.test.ts`
- `emitter.test.ts`

**Integration (4 in `kits/generation/tests/integration/`):**
- `incremental-rebuild.test.ts`
- `cascade-invalidation.test.ts`
- `multi-family-generation.test.ts`
- `orphan-cleanup.test.ts`

### Total: 34 new files

---

## What is NOT in scope

- **Per-generator syncs** (cache-check wrappers, output routing, cache-record, observer) — these live in each family's kit (framework, interface, deploy), not in the generation suite. The architecture doc says these are mechanical and auto-generatable.
- **CLI commands** (`clef generate --plan`, `clef kinds`, `clef trace`, `clef impact`) — these depend on the CLI tool at `tools/clef-cli/` and are a separate integration task.
- **Modifications to existing generators** (adding `register` action, returning `{ files }` instead of writing directly) — these are per-family changes, not generation suite work.
- **Emitter removal from Clef Bind** — the Clef Bind will be updated to `uses: generation/Emitter` separately.

## Execution approach

Each phase is implemented fully (spec + sync + impl + test) before moving to the next. Tests run after each phase with `npx vitest run`. All concept and sync files are extracted verbatim from the architecture doc — no improvisation on the specs.
