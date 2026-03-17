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
| **SchemaEvolution** | Versioned schemas + compatibility checks | Does upcast only, no downcast, no structural diffing. No provider mechanism. |
| **Diff** | Computes minimal differences between content states | Has pluggable providers. Operates on content bytes. |
| **Patch** | Invertible, composable change objects | Already has `invert()`, `compose()`, `commute()`. Algebraic properties match lens algebra. |
| **DataFlowPath** | Traces data flow source→sink | Currently string-based paths. Lenses make paths first-class. |

### Key insight: Patch already IS the invertible composable change algebra

The Patch concept already provides exactly the algebraic structure needed for
migrations: create, apply, invert, compose, commute. What's missing is a
**schema-aware diff provider** that understands concept state structure and
produces patches expressed as lens operations.

This means we DON'T need a separate "LensMigration" concept. Instead:
- Diff gets a new provider (lens-structural-diff) that diffs concept schemas
- Diff produces edit scripts expressed as lens operations (rename field, add field, change type)
- Patch handles the invertibility and composition — it already does this

### Singularity test for each candidate

| Candidate | Purpose (one sentence) | Independent? | Own state? | Verdict |
|-----------|----------------------|-------------|-----------|---------|
| **Lens** | First-class typed reference to a location in concept state. | Yes — useful without migration, without extraction, without anything else. | Yes — lenses, segments, types. | **NEW CONCEPT** |
| **LensMigration** | Bidirectional schema transforms via lens algebra. | Overlaps with Diff+Patch — Diff computes differences, Patch makes them invertible/composable. | Would duplicate Patch state. | **NOT a concept — use Diff provider + Patch** |
| **LensExtractionProvider** | Extract implicit lenses from StorageProgram instructions. | Yes — analyzes programs, fits ProgramAnalysis pattern. | Minimal (results only, like other providers). | **NEW PROVIDER** |
| **LensImpactProvider** | Trace impact through lens-composed paths. | Not really — it's sync wiring of Lens + DependenceGraph + DataFlowPath. No own state. | No. | **SYNC WIRING, not a concept** |
| **LensStructuralDiffProvider** | Diff two concept schemas structurally, producing lens-operation edit scripts. | Yes — plugs into existing Diff provider mechanism. | Minimal (provider registration). | **NEW DIFF PROVIDER** |

## Final Design

### New Concepts: 1

**Lens [L]** — First-class typed reference to a location in concept state.

Purpose: Replace untyped string-based storage access with typed, composable
references that can be validated against concept state declarations.

State:
- `lenses: set L` — registered lenses
- `segments: L -> list String` — path segments (relation, key, field)
- `sourceType: L -> String` — the type of the structure being focused into
- `focusType: L -> String` — the type at the focus point
- `kind: L -> String` — relation | record | field

Actions:
- `create(lens, relation, key, field)` — construct from path segments
- `fromRelation(lens, relation)` — shorthand for relation-only lens
- `compose(outer, inner)` → ok | notfound | incompatible — chain two lenses
- `get(lens)` → ok with metadata | notfound
- `decompose(lens)` → ok with segments array | notfound
- `validate(lens, conceptSpec)` → valid | invalid | notfound
- `list()` → ok with all lenses

### New ProgramAnalysis Provider: 1

**LensExtractionProvider [E]** — Extract implicit lens references from
StorageProgram instructions.

Purpose: Walk a StorageProgram's instruction tree and convert string-based
storage access (get/put/del with relation, key args) into explicit Lens
references, making implicit data flow paths first-class.

Actions:
- `analyze(program)` → ok(result, lenses, accessPattern) | error

This fits the exact same pattern as ReadWriteSetProvider, DeadBranchProvider, etc.

### New Diff Provider: 1

**LensStructuralDiffProvider [D]** — Diff two concept state schemas
structurally, producing edit scripts expressed as lens operations.

Purpose: Compare two versions of a concept's state declarations and produce
a structural diff expressed as lens operations (add field, remove field,
rename field, change type, change cardinality). The edit script plugs into
the existing Diff→Patch pipeline for invertible, composable migrations.

Actions:
- `analyze(oldSchema, newSchema)` → ok(result, operations, editScript) | error

This registers with the existing Diff concept's provider mechanism.

### Updates to Existing Concepts: 1

**StorageProgram** — Add lens-based instruction variants:
- `getLens(program, lens, bindAs)` — read through a lens
- `putLens(program, lens, value)` — write through a lens
- `modifyLens(program, lens, fn)` — read-modify-write through a lens

These are new actions alongside the existing string-based `get`, `put`, etc.
The old actions remain for backward compatibility.

### Runtime DSL additions (runtime/storage-program.ts):

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

### Sync Wiring: 4 syncs

1. **register-lens-extraction-provider** — Register LensExtractionProvider with ProgramAnalysis on first use
2. **dispatch-lens-extraction** — When ProgramAnalysis/run is called with provider "lens-extraction", dispatch to LensExtractionProvider
3. **extract-lenses-on-build** — When FunctionalHandler/build completes, auto-extract lenses
4. **register-lens-structural-diff-provider** — Register LensStructuralDiffProvider with Diff concept

### What we're NOT building (and why)

| Rejected | Why |
|----------|-----|
| LensMigration concept | Patch already provides invertible, composable change algebra. We just need a Diff provider that produces lens-operation edit scripts. |
| LensImpactProvider concept | Impact analysis is sync wiring of existing Lens + DependenceGraph + DataFlowPath. No independent state or purpose. |
| LensComposition concept | Composition is an action on Lens, not independently motivated. |
| LensSchema concept | Validation is an action on Lens (`validate`), not independently motivated. |
| Iso/Prism concepts | Full optics hierarchy is over-engineering for Clef's needs. Lens covers the access pattern; Patch covers invertibility. |

### Deliverables

| # | File | Type |
|---|------|------|
| 1 | `specs/monadic/lens.concept` | Concept spec (already created) |
| 2 | `specs/monadic/providers/lens-extraction-provider.concept` | Provider spec |
| 3 | `specs/monadic/providers/lens-structural-diff-provider.concept` | Diff provider spec |
| 4 | `runtime/storage-program.ts` | Add StateLens type + DSL functions + new Instruction variants |
| 5 | `specs/monadic/storage-program.concept` | Add getLens/putLens/modifyLens actions |
| 6 | `handlers/ts/monadic/lens.handler.ts` | Lens handler |
| 7 | `handlers/ts/monadic/providers/lens-extraction-provider.handler.ts` | Provider handler |
| 8 | `handlers/ts/monadic/providers/lens-structural-diff-provider.handler.ts` | Diff provider handler |
| 9 | `syncs/monadic/register-lens-extraction-provider.sync` | Sync |
| 10 | `syncs/monadic/dispatch-lens-extraction.sync` | Sync |
| 11 | `syncs/monadic/extract-lenses-on-build.sync` | Sync |
| 12 | `syncs/monadic/register-lens-structural-diff-provider.sync` | Sync |
| 13 | `tests/lens.test.ts` | Tests for Lens + providers + DSL |
