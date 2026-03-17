# Plan: Typed Lenses for State Field Access

## Jackson Analysis

Applying Jackson's three design criteria (singularity, independence, sufficiency)
plus the familiarity and operational principle tests.

### What already exists that's relevant

| Concept | What it does | Lens relevance |
|---------|-------------|----------------|
| **StorageProgram** | Builds instruction trees for storage ops | Currently uses raw strings: `get(p, 'users', u1, 'user')`. Lens target. |
| **ProgramAnalysis** | Dispatches analysis to registered providers | Provider mechanism for lens extraction. |
| **ReadWriteSetProvider** | Extracts read/write sets from programs | Operates at relation granularity. Lenses refine to field granularity. |
| **StateField** (Score) | Tracks state declarations per concept | Already models what lenses point AT. Natural lens source. |
| **SchemaEvolution** | Versioned schemas + compatibility checks | Does upcast only, no downcast, no structural diffing. |
| **Diff** | Computes minimal differences between content states | Has pluggable providers. Operates on content bytes. |
| **Patch** | Invertible, composable change objects | Already has `invert()`, `compose()`, `commute()`. Algebraic properties match lens algebra. |
| **DataFlowPath** | Traces data flow source→sink | Currently string-based paths. Lenses make paths first-class. |
| **DependenceGraph** | Data and control dependency edges | Forward/backward impact analysis. |

### Key insight: Patch already IS the invertible composable change algebra

The Patch concept provides exactly the algebraic structure needed for
migrations: create, apply, invert, compose, commute. What's missing is a
**schema-aware diff provider** that understands concept state structure and
produces patches expressed as lens operations.

This means we DON'T need a separate "LensMigration" concept. Instead:
- Diff gets a new provider (lens-structural-diff) that diffs concept schemas
- Diff produces edit scripts expressed as lens operations (rename field, add field, change type)
- Patch handles the invertibility and composition — it already does this
- A **derived concept** (LensMigration) composes these into the emergent "auto-migration" behavior

### Singularity test for each candidate

| Candidate | Purpose (one sentence) | Independent? | Own state? | Verdict |
|-----------|----------------------|-------------|-----------|---------|
| **Lens** | First-class typed reference to a location in concept state. | Yes — useful without migration, without extraction, without anything else. | Yes — lenses, segments, types. | **NEW CONCEPT** |
| **LensMigration** | Bidirectional schema transforms via lens algebra. | Emergent from composing Lens+Diff+Patch+SchemaEvolution — no independent state. | No. | **DERIVED CONCEPT** |
| **LensImpactAnalysis** | Show everything affected by changing a lens target. | Emergent from composing Lens+DependenceGraph+DataFlowPath — no independent state. | No. | **DERIVED CONCEPT** |
| **LensExtractionProvider** | Extract implicit lenses from StorageProgram instructions. | Yes — analyzes programs, fits ProgramAnalysis pattern. | Minimal (results only, like other providers). | **NEW PROVIDER** |
| **LensStructuralDiffProvider** | Diff two concept schemas structurally, producing lens-operation edit scripts. | Yes — plugs into existing Diff provider mechanism. | Minimal (provider registration). | **NEW DIFF PROVIDER** |

### Still rejected (not even derived concepts)

| Rejected | Why not even a derived concept? |
|----------|-------------------------------|
| **LensComposition** | Composition is intrinsic to Lens (an action). No second concept to compose with. |
| **LensSchema** (validation) | `validate` is already a Lens action. Auto-wiring it is just a sync, not emergent behavior. |
| **Iso/Prism** | Lens variants/features, not multi-concept compositions. Patch covers invertibility. |

---

## Final Design

### 1. New Concept: Lens [L]

First-class typed reference to a location in concept state.

**Purpose:** Replace untyped string-based storage access with typed, composable
references that can be validated against concept state declarations.

**State:**
- `lenses: set L` — registered lenses
- `segments: L -> list Segment` — path segments (relation, key, field)
- `sourceType: L -> String` — the type of the structure being focused into
- `focusType: L -> String` — the type at the focus point
- `kind: L -> one of relation | record | field` — lens depth

**Actions:**
- `create(relation, key, field)` → ok(lensId) | invalid — construct from path segments
- `fromRelation(relation)` → ok(lensId) — shorthand for relation-only lens
- `compose(outer, inner)` → ok(composedId) | notFound | incompatible — chain two lenses
- `get(lensId)` → ok(lens metadata) | notFound
- `decompose(lensId)` → ok(segments) | notFound
- `validate(lensId, conceptName, version)` → valid | invalid(reason) | notFound
- `list()` → ok(all lenses)

**Operational principle:** *"After creating a lens for `users.{userId}.email` and
validating it against the User concept, a handler can use `getLens(program, lens)`
instead of `get(program, 'users', userId, 'email')` — gaining type safety,
composability, and traceability."*

### 2. New Derived Concept: LensMigration

Composes: **Lens**, **Diff**, **Patch**, **SchemaEvolution**

**Purpose:** When a schema version is registered, automatically compute a
bidirectional migration patch using lens-based structural diffing.

**Syncs (internal):**
- `SchemaEvolution/register → ok` triggers `Diff/diff` (using lens-structural-diff provider, passing old schema + new schema)
- `Diff/diff → diffed` triggers `Patch/create` (from the edit script)
- `Patch/create → ok` triggers `Patch/invert` (produce the backward migration)

**Surface actions (entry points):**
- `migrate(concept, fromVersion, toVersion)` — entry: applies the forward or backward patch chain

**Surface queries:**
- `migrationPath(concept, v1, v2) → list Patch` — finds the shortest patch chain between versions

**Operational principle:** *"When a developer registers User schema v2 (which
renames `email` to `emailAddress` and adds `phone`), LensMigration automatically
diffs v1↔v2 structurally using lens operations, produces a forward patch
(rename field + add field with default) and its inverse (rename back + drop field),
so data can migrate in both directions."*

### 3. New Derived Concept: LensImpactAnalysis

Composes: **Lens**, **DependenceGraph**, **DataFlowPath**

**Purpose:** Given a lens (state field reference), compute all concepts, actions,
syncs, and generated code affected by changing that field.

**Syncs (internal):**
- `Lens/validate → valid` triggers `DependenceGraph/query` (find dependents of the lens target's state field)
- `DependenceGraph/query → ok` triggers `DataFlowPath/trace` (trace data flow through each dependent)

**Surface actions (entry points):**
- `impact(lensId)` — entry: computes the full impact report for changing the lens target

**Surface queries:**
- `affectedEntities(lensId) → { concepts, actions, syncs, files }` — the impact report

**Operational principle:** *"When a developer points a lens at `User.email`
and asks for impact, LensImpactAnalysis traces through the dependency graph
and data flow paths to show every concept action, sync rule, and generated
file that would be affected by changing that field — before they make the change."*

### 4. New ProgramAnalysis Provider: LensExtractionProvider [E]

**Purpose:** Walk a StorageProgram's instruction tree and convert string-based
storage access (get/put/del with relation, key args) into explicit Lens
references, making implicit data flow paths first-class.

**Actions:**
- `analyze(program)` → ok(result: { lenses, accessPattern }) | error

Fits the exact same pattern as ReadWriteSetProvider, DeadBranchProvider, etc.

### 5. New Diff Provider: LensStructuralDiffProvider [D]

**Purpose:** Compare two versions of a concept's state declarations and produce
a structural diff expressed as lens operations (add field, remove field,
rename field, change type, change cardinality). The edit script plugs into
the existing Diff→Patch pipeline for invertible, composable migrations.

**Actions:**
- `analyze(oldSchema, newSchema)` → ok(result: { operations, editScript }) | error

Registers with the existing Diff concept's provider mechanism.

### 6. StorageProgram Updates

Add lens-based instruction variants (new actions alongside existing string-based ones):
- `getLens(program, lens, bindAs)` — read through a lens
- `putLens(program, lens, value)` — write through a lens
- `modifyLens(program, lens, fn)` — read-modify-write through a lens

### 7. Runtime DSL additions (runtime/storage-program.ts)

New types and builder functions:
```typescript
// Lens type — a path through concept state
interface StateLens {
  segments: LensSegment[];
  sourceType: string;
  focusType: string;
}
type LensSegment =
  | { kind: 'relation'; name: string }
  | { kind: 'key'; value: string }
  | { kind: 'field'; name: string };

// Builder API (fluent)
function relation(name: string): StateLens;
// .at(key) and .field(name) via composeLens

// DSL functions for StorageProgram
function getLens(program, lens, bindAs): StorageProgram;
function putLens(program, lens, value): StorageProgram;
function modifyLens(program, lens, fn): StorageProgram;
```

New Instruction variants:
```typescript
| { tag: 'getLens'; lens: StateLens; bindAs: string }
| { tag: 'putLens'; lens: StateLens; value: Record<string, unknown> }
| { tag: 'modifyLens'; lens: StateLens; fn: (bindings: Bindings) => Record<string, unknown> }
```

### 8. Sync Wiring (standalone syncs, not inside derived concepts)

1. **register-lens-extraction-provider** — Register LensExtractionProvider with ProgramAnalysis on first use
2. **dispatch-lens-extraction** — When ProgramAnalysis/run is called with provider "lens-extraction", dispatch to LensExtractionProvider
3. **extract-lenses-on-build** — When FunctionalHandler/build completes, auto-extract lenses
4. **register-lens-structural-diff-provider** — Register LensStructuralDiffProvider with Diff concept

---

## Implementation Order

### Step 1: Runtime DSL (foundation)
- Add `StateLens`, `LensSegment` types to `runtime/storage-program.ts`
- Add `relation()` builder, `composeLens()`, `at()`, `field()` helpers
- Add `getLens`, `putLens`, `modifyLens` DSL functions
- Add new Instruction variants

### Step 2: Lens concept spec + handler
- Create `specs/monadic/lens.concept` via `/create-concept`
- Create `handlers/ts/monadic/lens.handler.ts` via `/create-implementation`

### Step 3: StorageProgram concept update
- Add `getLens`, `putLens`, `modifyLens` actions to `specs/monadic/storage-program.concept`

### Step 4: LensExtractionProvider spec + handler
- Create `specs/monadic/providers/lens-extraction-provider.concept` via `/create-concept`
- Create `handlers/ts/monadic/providers/lens-extraction-provider.handler.ts` via `/create-implementation`

### Step 5: LensStructuralDiffProvider spec + handler
- Create `specs/monadic/providers/lens-structural-diff-provider.concept` via `/create-concept`
- Create `handlers/ts/monadic/providers/lens-structural-diff-provider.handler.ts` via `/create-implementation`

### Step 6: Standalone syncs
- Create the 4 standalone syncs via `/create-sync`

### Step 7: Derived concepts
- Create `LensMigration.derived` via `/create-derived-concept`
- Create `LensImpactAnalysis.derived` via `/create-derived-concept`

### Step 8: Tests
- Write comprehensive tests covering:
  - Lens creation, composition, decomposition, validation
  - StateLens DSL (relation/at/field builders)
  - getLens/putLens/modifyLens instruction building + interpretation
  - LensExtractionProvider analysis
  - LensStructuralDiffProvider schema diffing
  - LensMigration derived concept operational principle
  - LensImpactAnalysis derived concept operational principle

---

## Deliverables

| # | File | Type |
|---|------|------|
| 1 | `runtime/storage-program.ts` | StateLens types + DSL functions + Instruction variants |
| 2 | `specs/monadic/lens.concept` | Concept spec |
| 3 | `handlers/ts/monadic/lens.handler.ts` | Lens handler |
| 4 | `specs/monadic/storage-program.concept` | Updated with getLens/putLens/modifyLens |
| 5 | `specs/monadic/providers/lens-extraction-provider.concept` | Provider spec |
| 6 | `handlers/ts/monadic/providers/lens-extraction-provider.handler.ts` | Provider handler |
| 7 | `specs/monadic/providers/lens-structural-diff-provider.concept` | Diff provider spec |
| 8 | `handlers/ts/monadic/providers/lens-structural-diff-provider.handler.ts` | Diff provider handler |
| 9 | `syncs/monadic/register-lens-extraction-provider.sync` | Sync |
| 10 | `syncs/monadic/dispatch-lens-extraction.sync` | Sync |
| 11 | `syncs/monadic/extract-lenses-on-build.sync` | Sync |
| 12 | `syncs/monadic/register-lens-structural-diff-provider.sync` | Sync |
| 13 | `specs/monadic/derived/lens-migration.derived` | Derived concept |
| 14 | `specs/monadic/derived/lens-impact-analysis.derived` | Derived concept |
| 15 | `tests/lens.test.ts` | Tests |
