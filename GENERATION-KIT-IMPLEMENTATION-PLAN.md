# Generation Suite — Full Implementation Plan

This plan implements the generation suite as described in `clef-generation-suite.md`. It is organized into six sequential work streams, each producing a testable, independently valuable deliverable. Within each work stream, tasks are ordered by dependency.

## Codebase Baseline (Current State)

Before implementing, note what already exists:

| Asset | Location | Status |
|---|---|---|
| **Emitter concept spec** | `kits/interface/concepts/emitter.concept` | Exists (Clef Bind version — simpler than generation suite spec) |
| **Emitter implementation** | `implementations/typescript/framework/emitter.impl.ts` | Exists (write, format, clean, manifest — missing writeBatch, trace, affected, audit, sourceMap) |
| **PluginRegistry concept spec** | `kits/infrastructure/plugin-registry.concept` | Exists (missing `register` action — only has discover, createInstance, getDefinitions, alterDefinitions, derivePlugins) |
| **PluginRegistry implementation** | `implementations/typescript/app/plugin-registry.impl.ts` | Exists (implements current spec — needs `register` action added) |
| **Cache infrastructure** | `kernel/src/cache.ts` | Exists (filesystem-level .clef-cache — hash computation, manifest read/write, compiled artifact caching) |
| **TypeScriptGen** | `implementations/typescript/framework/typescript-gen.impl.ts` | Exists (already returns `{ files }` array from generate action) |
| **RustGen, SwiftGen, SolidityGen** | `implementations/typescript/framework/*.impl.ts` | Exist |
| **SchemaGen** | `implementations/typescript/framework/schema-gen.impl.ts` | Exists (produces ConceptManifest) |
| **SpecParser** | `implementations/typescript/framework/spec-parser.impl.ts` | Exists |
| **Interface kit** | `kits/interface/` | Exists (26 concepts, 40+ syncs, full suite.yaml) |
| **Deploy kit** | `kits/deploy/` | Exists (30+ concepts, 30+ syncs, full suite.yaml) |
| **Generation kit** | `kits/generation/` | Does NOT exist yet |
| **ConceptHandler pattern** | `kernel/src/types.ts` | Established (async methods returning `{ variant, ...fields }`) |
| **ConceptStorage pattern** | `kernel/src/types.ts` | Established (put/get/find/del/delMany with relations) |
| **Test pattern** | `tests/*.test.ts` | Vitest, no phase references, section number references |

### Key architectural observations

1. **TypeScriptGen already returns `{ files }`** — it does NOT write to disk directly. This means the Emitter integration for framework generators is already partially compatible.
2. **PluginRegistry has a `register` action** — added during implementation. Stores generator metadata (name, type, metadata JSON).
3. **Emitter exists but needs promotion and expansion** — the current Clef Bind Emitter handles write/format/clean/manifest. The generation suite version adds writeBatch, sourceMap, trace, affected, and audit.
4. **Generation kit directory now exists** — scaffolded with 5 concepts, 14 syncs, 5 conformance tests + 1 integration test.

### Cross-Concept Contamination Lesson (Caught During Implementation)

Two violations of Clef Design Principle 2 (concept independence) were introduced and corrected:

1. **Generator `register` actions (REVERTED).** TypeScriptGen, RustGen, SwiftGen, and SolidityGen were given `register` actions returning metadata. This baked plugin-system awareness into generators. **Fix:** Removed all `register` actions from generators. Generator metadata (name, family, inputKind, outputKind, deterministic, pure) lives statically in `suite.yaml` and syncs propagate it to PluginRegistry. Generators never interact with PluginRegistry.

2. **GenerationPlan `plan` action (REMOVED).** Accepted `generators`, `staleSteps`, and `topology` as typed inputs — typed references to data owned by PluginRegistry, BuildCache, and KindSystem. **Fix:** Removed the `plan` action entirely. GenerationPlan is now purely passive (begin/recordStep/complete/status/summary/history). Planning queries are composed in the CLI layer, which queries each concept independently.

**Principle:** Even receiving other concepts' data as input parameters violates independence if the parameter types or semantics are concept-specific. The test is: "Could this concept exist without the other concepts?" If parameter shapes only make sense when other specific concepts exist, that's contamination. Cross-concept data flows belong in syncs and the CLI/presentation layer — never in concept action signatures.

---

## Work Stream 1: Emitter Promotion & Expansion

**Goal:** Promote Emitter from Clef Bind to generation suite as shared infrastructure. Expand it with writeBatch, sourceMap, trace, affected, and audit capabilities.

### 1.1 Create generation suite directory structure

Create the full directory skeleton:

```
kits/generation/
├── suite.yaml
├── resource.concept
├── kind-system.concept
├── build-cache.concept
├── generation-plan.concept
├── emitter.concept
├── syncs/
├── implementations/
│   └── typescript/
└── tests/
    ├── conformance/
    └── integration/
```

**Files to create:**
- `kits/generation/suite.yaml` — initial version with just Emitter concept
- Directory scaffolds for syncs/, implementations/typescript/, tests/conformance/, tests/integration/

### 1.2 Create expanded Emitter concept spec

Create `kits/generation/emitter.concept` with the full spec from `clef-generation-suite.md` Part 1.5:
- write (with sources parameter for traceability)
- writeBatch (atomic multi-file write)
- format (per-file formatting)
- clean (orphan removal)
- manifest (file listing)
- trace (source → output tracing)
- affected (output → source reverse lookup)
- audit (drift detection)

### 1.3 Expand Emitter implementation

Extend `implementations/typescript/framework/emitter.impl.ts` to implement the expanded spec:

**Additions to existing implementation:**
- Add `sourceMap` storage relation for traceability data
- Add `sources` parameter to `write` action
- Add `writeBatch` action (atomic multi-file write with single manifest update)
- Add `trace` action (query sourceMap by output path)
- Add `affected` action (query sourceMap by source path)
- Add `audit` action (compare manifest against filesystem for drift)
- Modify `write` to accept `formatHint` parameter (replaces the current separate `formatter` parameter pattern)
- Modify `format` to work with path + extension-based formatter selection

**Decisions:**
- The existing `write` action signature differs from the generation suite spec (current: `path, content, target, concept`; spec: `path, content, formatHint, sources`). The expanded version should support both — keep `target` and `concept` as optional fields for backward compat with existing Clef Bind syncs, add `formatHint` and `sources`.
- `writeBatch` should reuse the internal write logic in a loop, but commit all storage updates atomically (single manifest update at the end).

### 1.4 Update Clef Bind to import Emitter from generation suite

Modify `kits/interface/suite.yaml`:
- Remove Emitter from `concepts:` section
- Add to `uses:` section: `kit: generation, concepts: [Emitter]`
- Keep `kits/interface/concepts/emitter.concept` as a historical reference but mark deprecated, or remove it

**Risk:** Existing Clef Bind syncs reference `Emitter/write` and `Emitter/format`. These signatures must remain compatible. The expanded Emitter adds parameters but should not break existing callers (new params are `option` types).

### 1.5 Write Emitter conformance tests

Create `kits/generation/tests/conformance/emitter.test.ts`:
- Content-addressed skip-write: write same content twice, second returns `written: false`
- writeBatch: write 3 files atomically, verify manifest
- Trace: write with sources, query trace, verify provenance
- Affected: write with sources, query affected, verify reverse lookup
- Audit: write files, simulate drift (modify stored hash), verify audit detects it
- Clean: write files, call clean with subset, verify orphans removed
- Format: write file, call format, verify formatter applied

### 1.6 Write format-after-write sync

Create `kits/generation/syncs/format-after-write.sync` — required sync that applies formatting after each successful write.

**Acceptance criteria:**
- `clef generate` produces identical output to before (no regression)
- Second run with no source changes: all files return `written: false`
- `emitterHandler.trace()` returns source provenance for files written with `sources` parameter
- `emitterHandler.audit()` detects drifted, missing, and orphaned files
- All existing Clef Bind tests pass without modification

---

## Work Stream 2: BuildCache — Incremental Detection

**Goal:** Generators skip execution when inputs haven't changed since last successful run.

### 2.1 Create BuildCache concept spec

Create `kits/generation/build-cache.concept` from `clef-generation-suite.md` Part 1.3:
- check (compare input hash, return changed/unchanged)
- record (store successful generation result)
- invalidate (force single step to re-run)
- invalidateBySource (invalidate all entries for a source locator)
- invalidateByKind (invalidate by kind name for cascading)
- invalidateAll (clear everything)
- status (list all entries with staleness)
- staleSteps (list step keys needing re-run)

### 2.2 Implement BuildCache

Create `kits/generation/implementations/typescript/build-cache.impl.ts`:

**Storage relations:**
- `entries` — keyed by stepKey, stores inputHash, outputHash, outputRef, lastRun, sourceLocator, deterministic, stale flag

**Key implementation details:**
- `check`: lookup by stepKey. If entry exists AND inputHash matches AND deterministic is true AND not stale → `unchanged`. Otherwise → `changed`.
- `record`: upsert entry, clear stale flag
- `invalidate`: set stale flag on entry (don't delete — keep last hash for change reporting)
- `invalidateBySource`: scan entries by sourceLocator, set stale
- `invalidateByKind`: scan entries by stepKey prefix pattern (e.g., all entries containing the kind name), set stale
- `invalidateAll`: set stale on all entries
- Nondeterministic transforms (deterministic: false) always return `changed` — never cache-hit

**Relationship to existing cache.ts:**
- `kernel/src/cache.ts` handles filesystem-level `.clef-cache/` for compiled artifacts (ASTs, manifests, syncs)
- BuildCache is a concept-level cache for generation step results (input/output hashes)
- They are complementary, not overlapping. kernel/cache.ts handles boot-time optimization; BuildCache handles generation-time optimization.

### 2.3 Write cache-check wrapper syncs for TypeScriptGen

Create two syncs as the template pattern for all generators:

1. `kits/generation/syncs/cache-check-before-typescript-gen.sync` — intercept SchemaGen/generate → ok, compute input hash, call BuildCache/check
2. `kits/generation/syncs/typescript-gen-on-miss.sync` — match SchemaGen/generate → ok AND BuildCache/check → changed, then call TypeScriptGen/generate

These serve as the concrete template. Every other generator gets the same pair with names swapped.

### 2.4 Write cache-record sync for TypeScriptGen

Create `kits/generation/syncs/record-cache-typescript-gen.sync` — after TypeScriptGen/generate → ok AND Emitter/writeBatch → ok, call BuildCache/record with step key, input hash, output hash.

### 2.5 Write emit sync for TypeScriptGen

Create `kits/generation/syncs/emit-typescript-files.sync` — after TypeScriptGen/generate → ok(files), call Emitter/writeBatch.

### 2.6 Write BuildCache conformance tests

Create `kits/generation/tests/conformance/build-cache.test.ts`:
- check with no entry → changed
- record then check with same hash → unchanged
- record then check with different hash → changed
- invalidate then check → changed (even with same hash)
- invalidateBySource → invalidates all matching entries
- invalidateByKind → invalidates matching entries
- invalidateAll → all entries stale
- status → lists all entries with correct staleness
- staleSteps → returns only stale step keys
- Nondeterministic: record then check with deterministic: false → always changed

### 2.7 Write incremental rebuild integration test

Create `kits/generation/tests/integration/incremental-rebuild.test.ts`:
- Full pipeline: parse spec → SchemaGen → BuildCache check → TypeScriptGen → Emitter → BuildCache record
- Second run with same input: TypeScriptGen skipped (cache hit)
- Third run with changed input: TypeScriptGen re-runs (cache miss)

**Acceptance criteria:**
- `clef generate` with no changes: all generators skipped via cache (BuildCache/check → unchanged for each)
- `clef generate --force`: calls invalidateAll first, then all generators re-run
- Cache entries persist across runs (stored in ConceptStorage)

---

## Work Stream 3: Resource — Input Tracking

**Goal:** Source file changes trigger targeted invalidation instead of full rebuilds.

### 3.1 Create Resource concept spec

Create `kits/generation/resource.concept` from `clef-generation-suite.md` Part 1.1:
- upsert (created/changed/unchanged variants based on digest comparison)
- get (lookup by locator)
- list (optionally filtered by kind)
- remove (stop tracking)
- diff (classify change type: content/structural/breaking)

### 3.2 Implement Resource

Create `kits/generation/implementations/typescript/resource.impl.ts`:

**Storage relations:**
- `resources` — keyed by locator, stores kind, digest, lastModified, size

**Key implementation details:**
- `upsert`: get existing by locator. If not found → `created`. If found and digest differs → `changed(previousDigest)`. If found and digest matches → `unchanged`.
- `diff`: requires kind-specific differ registry. Initial implementation: return `unknown` for all kinds. Later: add diffing for concept-spec (structural analysis of AST changes), sync-spec, etc.

### 3.3 Write input tracking syncs

Create syncs from `clef-generation-suite.md` Part 2.1:
1. `kits/generation/syncs/file-changed.sync` — FileWatcher/detected(event: "create") → Resource/upsert
2. `kits/generation/syncs/file-modified.sync` — FileWatcher/detected(event: "modify") → Resource/upsert
3. `kits/generation/syncs/file-removed.sync` — FileWatcher/detected(event: "delete") → Resource/remove

**Note:** These syncs reference `FileWatcher/detected`. If FileWatcher doesn't exist as a concept yet, these syncs define the expected interface. The CLI's watch mode would be the FileWatcher concept.

### 3.4 Write change propagation syncs

Create syncs from `clef-generation-suite.md` Part 2.3:
1. `kits/generation/syncs/invalidate-on-resource-change.sync` — Resource/upsert → changed → BuildCache/invalidateBySource
2. `kits/generation/syncs/invalidate-on-resource-remove.sync` — Resource/remove → ok → BuildCache/invalidateBySource

### 3.5 Write Resource conformance tests

Create `kits/generation/tests/conformance/resource.test.ts`:
- upsert new locator → created
- upsert same locator, same digest → unchanged
- upsert same locator, different digest → changed(previousDigest)
- get existing → ok with correct data
- get nonexistent → notFound
- list all → returns all resources
- list by kind → returns filtered
- remove existing → ok
- remove nonexistent → notFound

**Acceptance criteria:**
- Changing one `.concept` file → only affected generators re-run (targeted invalidation via Resource → BuildCache chain)
- Adding a new file → Resource/upsert returns `created`, triggers full generation for that input
- Deleting a file → Resource/remove triggers cache invalidation for downstream generators

---

## Work Stream 4: KindSystem — Pipeline Topology

**Goal:** Pipeline ordering, validation, and cascading invalidation are data-driven from a graph of IR kinds.

### 4.1 Create KindSystem concept spec

Create `kits/generation/kind-system.concept` from `clef-generation-suite.md` Part 1.2:
- define (register a kind with name and category)
- connect (declare transform edge between kinds)
- route (shortest path between two kinds)
- validate (confirm direct edge exists)
- dependents (transitive downstream kinds)
- producers (what transforms produce this kind)
- consumers (what transforms consume this kind)
- graph (full topology for visualization)

### 4.2 Implement KindSystem

Create `kits/generation/implementations/typescript/kind-system.impl.ts`:

**Storage relations:**
- `kinds` — keyed by name, stores category
- `edges` — keyed by `from:to`, stores relation, transformName

**Key implementation details:**
- `connect`: validate both kinds exist, check for cycles (topological sort / DFS), reject if cycle detected
- `route`: BFS/Dijkstra on the kind graph to find shortest path
- `dependents`: DFS/BFS from the given kind, collect all reachable kinds
- `graph`: return full adjacency list
- Cycle detection is critical — the kind graph must be a DAG

### 4.3 Write PluginRegistry → KindSystem syncs

Create syncs from `clef-generation-suite.md` Part 2.2:
1. `kits/generation/syncs/register-generator-kinds.sync` — PluginRegistry/register(type: "generator") → ok → KindSystem/connect
2. `kits/generation/syncs/ensure-kinds-defined.sync` — PluginRegistry/register(type: "generator") → ok → KindSystem/define for output kind

### 4.4 Write cascading invalidation syncs

Create syncs from `clef-generation-suite.md` Part 2.3:
1. `kits/generation/syncs/cascade-invalidation.sync` — BuildCache/invalidateBySource → ok → KindSystem/dependents
2. `kits/generation/syncs/invalidate-dependent-kinds.sync` — KindSystem/dependents → ok(downstream) → BuildCache/invalidateByKind for each

### 4.5 Add `register` action to PluginRegistry

**Modify existing concept and implementation:**

1. Update `kits/infrastructure/plugin-registry.concept` — add `register` action:
   ```
   action register(type: String, name: String, metadata: String) {
     -> ok(plugin: P) { Plugin registered with given metadata. }
     -> exists(plugin: P) { Plugin with this name already registered. Idempotent. }
   }
   ```

2. Update `implementations/typescript/app/plugin-registry.impl.ts` — add `register` method:
   - Store plugin definition with id=name, type, metadata (parsed JSON)
   - Return existing if name already registered (idempotent)

### 4.6 Generator metadata in suite.yaml (NOT in concept actions)

~~Update each generator concept spec and implementation to add a `register` action.~~

**CORRECTED:** Generator metadata lives in `suite.yaml` statically, NOT as concept actions. Adding `register` to generators violates concept independence (see "Cross-Concept Contamination Lesson" above). Syncs read suite.yaml metadata at bootstrap and wire it to PluginRegistry.

Generator metadata declared in suite.yaml:
- TypeScriptGen: family=framework, inputKind=ConceptManifest, outputKind=TypeScriptFiles, deterministic=true, pure=true
- RustGen: family=framework, inputKind=ConceptManifest, outputKind=RustFiles, deterministic=true, pure=true
- SwiftGen: family=framework, inputKind=ConceptManifest, outputKind=SwiftFiles, deterministic=true, pure=true
- SolidityGen: family=framework, inputKind=ConceptManifest, outputKind=SolidityFiles, deterministic=true, pure=true

### 4.7 Bootstrap registration syncs

Kit bootstrap syncs read suite.yaml and call PluginRegistry/register for each generator declared in the manifest. No per-generator sync needed — a single bootstrap sync iterates all generator entries.

### 4.8 Register standard kind taxonomy at kit load time

Create a bootstrap sync or initialization routine that defines the standard kinds:

**Source kinds:** ConceptDSL, SyncDSL, InterfaceManifest, DeployManifest
**Model kinds:** ConceptAST, ConceptManifest, SyncAST, CompiledSync, Projection, DeployPlan
**Artifact kinds:** (auto-populated via PluginRegistry → KindSystem syncs)

This can be a bootstrap sync file `kits/generation/syncs/bootstrap-kinds.sync` or an initialization function called at kit load time.

### 4.9 Write KindSystem conformance tests

Create `kits/generation/tests/conformance/kind-system.test.ts`:
- define kind → ok
- define duplicate → exists (idempotent)
- connect valid edge → ok
- connect with cycle → invalid
- connect with nonexistent kind → invalid
- route between connected kinds → ok(path)
- route between disconnected kinds → unreachable
- validate existing edge → ok
- validate nonexistent edge → invalid
- dependents → returns transitive closure
- producers/consumers → correct reverse/forward lookups
- graph → complete topology

### 4.10 Write cascade invalidation integration test

Create `kits/generation/tests/integration/cascade-invalidation.test.ts`:
- Setup: register kinds ConceptManifest → TypeScriptFiles, ConceptManifest → RustFiles
- Invalidate ConceptManifest → both TypeScriptGen and RustGen step keys become stale
- Verify via BuildCache/staleSteps

**Acceptance criteria:**
- `clef kinds list` shows all registered kinds
- `clef kinds path ConceptDSL OpenApiDoc` returns valid path through the taxonomy
- Cascading invalidation: changing a source file invalidates all downstream generators transitively
- `clef check` validates that sync chains form valid pipelines (edges exist in KindSystem)

---

## Work Stream 5: GenerationPlan — Planning & Status Tracking

**Goal:** Unified read-only planning and passive status tracking across all generation families.

### 5.1 Create GenerationPlan concept spec

Create `kits/generation/generation-plan.concept` from `clef-generation-suite.md` Part 1.4:
- plan (read-only analysis: what would run, what's cached, why)
- begin (mark new run started)
- recordStep (record step outcome — called by observer syncs)
- complete (mark run finished)
- status (current execution status)
- summary (post-run statistics)
- diff (dry-run comparison)
- history (recent run list)

### 5.2 Implement GenerationPlan

Create `kits/generation/implementations/typescript/generation-plan.impl.ts`:

**Storage relations:**
- `runs` — keyed by run ID, stores startedAt, completedAt, steps array
- `activeRun` — singleton storing current run ID (or null)

**Key implementation details:**

~~**REMOVED:** `plan` action. Originally accepted `generators`, `staleSteps`, and `topology` as typed parameters — this leaked knowledge of PluginRegistry, BuildCache, and KindSystem into GenerationPlan (see "Cross-Concept Contamination Lesson").~~

**CORRECTED:** GenerationPlan is purely passive. Planning queries are composed in the CLI layer:
- CLI queries PluginRegistry/getDefinitions for registered generators
- CLI queries KindSystem/graph for topology
- CLI queries BuildCache/staleSteps for cache status
- CLI composes the plan view from these three independent queries
- No concept needs to know about the others

- `begin`: create new run, store as activeRun
- `recordStep`: append step to activeRun's steps array
- `complete`: set completedAt, clear activeRun
- `status`: return steps for a specific run
- `summary`: aggregate from steps array
- `history`: return recent runs with limit

### 5.3 Write observer syncs

Create syncs from `clef-generation-suite.md` Part 2.7:
1. `kits/generation/syncs/observe-run-begin.sync` — CLI generate trigger → GenerationPlan/begin
2. `kits/generation/syncs/observe-cache-hit.sync` — BuildCache/check → unchanged → GenerationPlan/recordStep(cached)
3. `kits/generation/syncs/observe-run-complete.sync` — SyncEngine/quiesced → GenerationPlan/complete

Per-generator observer syncs (one per generator for completion/failure tracking):
- These follow the pattern in Part 2.7 — TypeScriptGen/generate → ok → GenerationPlan/recordStep("done")
- These are per-family syncs (live alongside the per-generator cache-check and emit syncs)

### 5.4 Write orphan cleanup sync

Create `kits/generation/syncs/clean-orphans-after-run.sync` from Part 2.8:
- GenerationPlan/complete → ok → Emitter/clean

### 5.5 Write GenerationPlan conformance tests

Create `kits/generation/tests/conformance/generation-plan.test.ts`:
- plan with no generators → empty
- plan with generators, some stale → correct willRun/reason assignments
- begin → creates run, sets activeRun
- recordStep → appends to active run
- complete → marks run done, clears activeRun
- status → returns current steps
- summary → correct aggregates (total, executed, cached, failed)
- history → returns recent runs

### 5.6 Write multi-family generation integration test

Create `kits/generation/tests/integration/multi-family-generation.test.ts`:
- Register framework and interface generators
- Run full generation pipeline
- Verify GenerationPlan tracks all steps across families
- Verify summary reports correct totals

**Acceptance criteria:**
- `clef generate --plan` shows full dependency graph with cache status per step
- `clef generate --status` shows live progress during generation
- `clef generate --summary` shows post-run statistics (total, executed, cached, failed, duration, files)
- `clef generate --history` shows recent generation runs
- GenerationPlan is passive — disabling it does not affect generation execution

---

## Work Stream 6: CLI Integration, Traceability & Audit

**Goal:** Full CLI support for all generation suite features, plus source-to-output tracing and drift detection.

### 6.1 Add generator metadata to existing generators

Update each generator implementation to pass source provenance in the `sources` parameter when writing through Emitter:
- TypeScriptGen: include source concept spec path and concept name
- RustGen: same pattern
- Interface targets (RestTarget, etc.): same pattern

### 6.2 Implement CLI commands

Add to the CLI (`tools/clef-cli/`):

| Command | GenerationPlan action | Description |
|---|---|---|
| `clef generate` | triggers pipeline entry point | Run full generation |
| `clef generate --plan` | GenerationPlan/plan | Show what would run (read-only) |
| `clef generate --dry-run` | GenerationPlan/diff | Show file changes without writing |
| `clef generate --force` | BuildCache/invalidateAll + generate | Force full rebuild |
| `clef generate --status` | GenerationPlan/status | Show live progress |
| `clef generate --summary` | GenerationPlan/summary | Post-run statistics |
| `clef generate --history` | GenerationPlan/history | Recent generation runs |
| `clef generate --audit` | Emitter/audit | Drift detection |
| `clef generate --clean` | Emitter/clean | Remove orphaned files |
| `clef generate --family <name>` | GenerationPlan/plan(families: [name]) | Filter by family |
| `clef generate --target <name>` | GenerationPlan/plan(targets: [name]) | Filter by target |
| `clef generate --generator-syncs` | meta-generator | Auto-generate per-generator syncs |
| `clef trace <path>` | Emitter/trace | Source → output tracing |
| `clef impact <path>` | Emitter/affected | Output → source reverse lookup |
| `clef kinds list` | KindSystem/graph | List all registered kinds |
| `clef kinds path <from> <to>` | KindSystem/route | Find shortest transform path |
| `clef kinds consumers <kind>` | KindSystem/consumers | What consumes this kind |
| `clef kinds producers <kind>` | KindSystem/producers | What produces this kind |

### 6.3 Implement sync auto-generation

Implement `clef generate --generator-syncs`:
- Read PluginRegistry for all registered generators
- For each generator, emit 6 sync files:
  1. `register-{name}.sync`
  2. `cache-check-before-{name}.sync`
  3. `{name}-on-miss.sync`
  4. `emit-{name}-files.sync`
  5. `record-cache-{name}.sync`
  6. `observe-{name}.sync`
- Output to `generated/syncs/` directory
- Each sync follows the exact template patterns from `clef-generation-suite.md` Parts 2.4, 2.5, 2.6, 2.7

### 6.4 Write orphan cleanup integration test

Create `kits/generation/tests/integration/orphan-cleanup.test.ts`:
- Generate files for password concept
- Remove password concept
- Run generation → Emitter/clean removes password's generated files

### 6.5 Write traceability integration test

Create `kits/generation/tests/integration/traceability.test.ts`:
- Generate files with source provenance
- `clef trace src/password.ts` → shows source concept spec
- `clef impact ./specs/password.concept` → shows all generated outputs

### 6.6 Finalize suite.yaml

Complete `kits/generation/suite.yaml` with all 5 concepts, all syncs (required and recommended), uses declaration for infrastructure kit (PluginRegistry).

**Acceptance criteria:**
- All CLI commands listed above work
- `clef trace` and `clef impact` return correct provenance data
- `clef generate --audit` detects hand-edited generated files
- `clef generate --generator-syncs` produces valid sync files for every registered generator
- Adding a new generator requires only: concept spec + implementation + `clef generate --generator-syncs`

---

## Per-Family Integration Work (Parallel with Work Streams 2-6)

These changes apply the generation suite infrastructure to each family. They can proceed in parallel with the work streams above once the relevant concepts are implemented.

### Framework Family

**Changes to existing files:**
1. ~~Add `register` action to generators~~ **REVERTED** — generator metadata is in suite.yaml, not in concept actions (see "Cross-Concept Contamination Lesson")
2. TypeScriptGen already returns `{ files }` — no change needed for Emitter compatibility
3. Verify RustGen, SwiftGen, SolidityGen also return `{ files }` — update if they write directly

**New sync files (5 per generator × 4 generators = 20 syncs):**
- Cache-check pair, emit, cache-record, observer for each (no per-generator registration sync needed — bootstrap sync handles all)
- All mechanical, follow identical pattern — auto-generatable via `clef generate --generator-syncs`

### Interface Family

**Changes to existing files:**
1. Update `kits/interface/suite.yaml` — import Emitter from generation suite instead of defining locally
2. Add `register` action to each target provider (RestTarget, GraphqlTarget, GrpcTarget, CliTarget, McpTarget, ClaudeSkillsTarget, OpenApiTarget, AsyncApiTarget, TsSdkTarget, PySdkTarget, GoSdkTarget, RustSdkTarget, JavaSdkTarget, SwiftSdkTarget)
3. Internal sync chains stay exactly as designed — BuildCache wraps each via cache-check syncs

**New sync files (6 per provider × 14 providers = 84 syncs):**
- All mechanical, auto-generatable

### Deploy Family

**Changes to existing files:**
1. Update `kits/deploy/suite.yaml` — import Emitter, BuildCache, GenerationPlan from generation suite
2. Add `register` action to IaC and GitOps providers that produce file output

**New sync files:**
- Only for providers that produce file output (TerraformProvider, PulumiProvider, etc.)

---

## File Inventory Summary

### New files to create

| Category | Count | Location |
|---|---|---|
| Concept specs | 5 | `kits/generation/*.concept` |
| Implementations | 5 | `kits/generation/implementations/typescript/*.impl.ts` |
| Required syncs | 6 | `kits/generation/syncs/` |
| Recommended syncs | 8 | `kits/generation/syncs/` |
| Conformance tests | 5 | `kits/generation/tests/conformance/*.test.ts` |
| Integration tests | 4 | `kits/generation/tests/integration/*.test.ts` |
| Kit manifest | 1 | `kits/generation/suite.yaml` |
| **Total new files** | **34** | |

### Existing files to modify

| File | Changes | Status |
|---|---|---|
| `kits/infrastructure/plugin-registry.concept` | Add `register` action | Done |
| `implementations/typescript/app/plugin-registry.impl.ts` | Add `register` method | Done |
| `implementations/typescript/framework/emitter.impl.ts` | Add writeBatch, trace, affected, audit, sourceMap | Done |
| ~~`implementations/typescript/framework/typescript-gen.impl.ts`~~ | ~~Add `register` method~~ | **REVERTED** — violates concept independence |
| ~~`implementations/typescript/framework/rust-gen.impl.ts`~~ | ~~Add `register` method~~ | **REVERTED** — violates concept independence |
| ~~`implementations/typescript/framework/swift-gen.impl.ts`~~ | ~~Add `register` method~~ | **REVERTED** — violates concept independence |
| ~~`implementations/typescript/framework/solidity-gen.impl.ts`~~ | ~~Add `register` method~~ | **REVERTED** — violates concept independence |
| `kits/interface/suite.yaml` | Import Emitter from generation suite | Done |
| `kits/deploy/suite.yaml` | Import generation suite concepts | Done |
| `tools/clef-cli/src/commands/generate.ts` | Add --plan, --force, --audit, --history, --summary, --status flags; expand --generator-syncs for interface providers | Done |
| `tools/clef-cli/src/index.ts` | Add `impact`, `kinds` commands | Done |
| `implementations/typescript/framework/typescript-gen.impl.ts` | Remove redundant `storage.put('outputs')` — BuildCache handles caching | Done |
| `implementations/typescript/framework/rust-gen.impl.ts` | Remove redundant `storage.put('outputs')` | Done |
| `implementations/typescript/framework/swift-gen.impl.ts` | Remove redundant `storage.put('outputs')` | Done |
| `implementations/typescript/framework/solidity-gen.impl.ts` | Remove redundant `storage.put('outputs')` | Done |
| **Total modified files** | **All done** |

---

## Dependency Graph

```
Work Stream 1 (Emitter)
    │
    ├── Work Stream 2 (BuildCache)
    │       │
    │       ├── Work Stream 3 (Resource)
    │       │       │
    │       │       └── Work Stream 4 (KindSystem) ← also needs PluginRegistry changes
    │       │               │
    │       │               └── Work Stream 5 (GenerationPlan)
    │       │                       │
    │       │                       └── Work Stream 6 (CLI, Traceability, Audit)
    │       │
    │       └── (BuildCache cache-check syncs can be written as soon as BuildCache is done)
    │
    └── (Emitter can be tested independently first)
```

Each work stream produces a testable increment. Work streams 1-2 deliver the most immediate value (content-addressed writes + incremental detection). Work streams 3-4 enable targeted invalidation. Work stream 5 adds planning/reporting. Work stream 6 polishes CLI and traceability.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Emitter signature changes break Clef Bind syncs | High | Keep existing parameters, add new ones as optional |
| PluginRegistry `register` action conflicts with existing usage | Medium | New action name is distinct from existing discover/createInstance/etc. |
| BuildCache storage grows unbounded | Low | Add TTL or LRU eviction in future; staleSteps + invalidateAll provide manual control |
| KindSystem cycle detection performance | Low | Kind graph is small (dozens of nodes); simple DFS is sufficient |
| GenerationPlan cross-concept queries | Medium | Pass pre-fetched data as input parameters instead of direct queries |
| Per-generator sync proliferation (6 × N generators) | Medium | Auto-generation via `clef generate --generator-syncs` eliminates manual maintenance |
