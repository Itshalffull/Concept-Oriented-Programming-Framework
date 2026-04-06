# PRD: View-Level Declarative Invariants and Test Generation

**Status:** Draft
**Author:** Claude
**Date:** 2026-04-06
**Depends on:** [QueryProgram invoke PRD](./query-program-invoke.md) (Implemented)

---

## Problem Statement

Concepts and widgets both have declarative invariant systems that
generate tests automatically:

- **Concepts** declare `always`, `never`, `example`, and
  `requires`/`ensures` blocks in `.concept` files.
  `generate-all-tests.ts` parses these and produces conformance
  tests that verify the handler obeys them.

- **Widgets** declare `invariant { ... }` blocks in `.widget` files
  with the same vocabulary plus UI-specific assertions (anatomy
  selectors, FSM state queries, ARIA attribute checks). Tests verify
  the generated component implementations.

**Views have no equivalent.** A ViewShell composes FilterSpec,
SortSpec, ProjectionSpec, InteractionSpec, DataSourceSpec, and
PresentationSpec into a view — but there is no way to declare
testable invariants about the compiled result. The three analysis
providers (InvokeEffectProvider, QueryPurityProvider,
QueryCompletionCoverage) compute the right properties, but nothing
asserts expected values or generates tests from declarations.

This means:
- A view's purity can silently change from read-only to read-write
  when someone adds an invoke instruction, with no test failure
- A view's invoke targets can reference nonexistent concepts with
  no build-time error
- A view's completion coverage can degrade (unhandled variants)
  with no warning
- Field references in filters/projections can become stale after
  schema changes with no detection

## Proposed Solution

Add an `invariants` block to ViewShell declarations (or to a
companion `.view` manifest) that declares expected properties of
the compiled QueryProgram. A test generator reads these declarations,
compiles the view specs into a QueryProgram (same as CompileQuery),
runs the analysis providers against it, and asserts each invariant.
Generated tests go to `generated/tests/<view-name>.view.test.ts`.

## Design Principles

1. **Reuse the existing invariant grammar.** View invariants use the
   same `always`, `never`, `example` vocabulary as concepts and
   widgets. No new DSL — just new assertion targets.

2. **Reuse the existing analysis providers.** Invariants are checked
   by running InvokeEffectProvider, QueryPurityProvider, and
   QueryCompletionCoverage against the compiled QueryProgram. No
   new analysis infrastructure.

3. **Reuse the existing test generation pipeline.** Extend
   `generate-all-tests.ts` (or add a parallel
   `generate-view-tests.ts`) that follows the same parse → plan →
   render → merge pipeline with ContentHash baselines and 3-way
   merge for user patches.

4. **Invariants live next to the specs they constrain.** Declared
   inline in the ViewShell concept instance or in a co-located
   `.view` manifest — not in a separate test file.

## Specification

### View Invariant Declaration

View invariants are declared in a `.view` manifest file co-located
with the suite. This keeps invariants close to the view definition
without modifying the ViewShell concept spec itself (which is a
generic concept, not a per-view declaration).

File: `specs/view/views/<view-name>.view`

```
view "content-list" {
  shell: "content-list"

  invariants {

    always "purity is read-only": {
      purity = "read-only"
    }

    always "projected fields are subset of source schema": {
      forall f in readFields:
      f in ["id", "node", "kind", "name", "schemas"]
    }

    always "filter references valid fields": {
      forall f in filterFields:
      f in sourceFields
    }

    never "invoke instructions present": {
      invokedActions != {}
    }

    always "all projected fields are read": {
      forall f in projectedFields:
      f in readFields
    }

  }
}
```

For views with invoke instructions (read-write views):

```
view "task-board-actions" {
  shell: "task-board"

  invariants {

    always "purity is read-write": {
      purity = "read-write"
    }

    always "invokes only Task actions": {
      forall ia in invokedActions:
      ia startsWith "Task/"
    }

    always "all invoke variants are covered": {
      uncoveredVariants = []
    }

    always "invoke targets exist": {
      forall ia in invokedActions:
      ia in registeredActions
    }

    example "bulk escalate invokes Task/escalate": {
      after compile
      then "Task/escalate" in invokedActions
      and  purity = "read-write"
      and  uncoveredVariants = []
    }

  }
}
```

### Invariant Assertion Targets

View invariants operate on a **ViewAnalysis** record computed from
the compiled QueryProgram by running the three analysis providers:

```typescript
interface ViewAnalysis {
  // From QueryPurityProvider
  purity: 'pure' | 'read-only' | 'read-write';
  readFields: string[];
  invokedActions: string[];

  // From InvokeEffectProvider
  invocations: string[];     // concept/action pairs
  invokeCount: number;

  // From QueryCompletionCoverage
  coveredVariants: string[];   // "Concept/action:variant"
  uncoveredVariants: string[]; // "Concept/action:variant"
  totalVariants: number;
  coveredCount: number;

  // From QueryProgram state
  instructions: string[];
  bindings: string[];
  terminated: boolean;

  // Derived from ViewShell child specs
  sourceFields: string[];      // fields available from DataSourceSpec
  filterFields: string[];      // fields referenced by FilterSpec
  sortFields: string[];        // fields referenced by SortSpec
  groupFields: string[];       // fields referenced by GroupSpec
  projectedFields: string[];   // fields selected by ProjectionSpec

  // From kernel registry (optional, requires live kernel)
  registeredActions: string[]; // all concept/action pairs in registry
}
```

### Invariant Grammar Extensions

The base grammar (`always`, `never`, `example`, `requires`/`ensures`)
is unchanged. View invariants add these assertion targets:

| Target | Type | Source |
|---|---|---|
| `purity` | String | QueryPurityProvider |
| `readFields` | set String | QueryPurityProvider |
| `invokedActions` | set String | QueryPurityProvider |
| `invocations` | set String | InvokeEffectProvider |
| `invokeCount` | Int | InvokeEffectProvider |
| `coveredVariants` | set String | QueryCompletionCoverage |
| `uncoveredVariants` | set String | QueryCompletionCoverage |
| `totalVariants` | Int | QueryCompletionCoverage |
| `coveredCount` | Int | QueryCompletionCoverage |
| `sourceFields` | set String | DataSourceSpec schema |
| `filterFields` | set String | FilterSpec tree walk |
| `sortFields` | set String | SortSpec keys |
| `groupFields` | set String | GroupSpec keys |
| `projectedFields` | set String | ProjectionSpec fields |
| `registeredActions` | set String | Kernel registry (optional) |

### Predicate Operators

View invariants support the standard predicate operators from the
concept invariant grammar, plus set operations:

```
# Equality
purity = "read-only"
invokeCount = 0

# Set membership
"Task/escalate" in invokedActions
f in sourceFields

# Set operations
uncoveredVariants = []               # empty set
projectedFields subset readFields    # subset check
invokedActions != {}                 # non-empty

# String operations
ia startsWith "Task/"                # prefix check

# Quantifiers
forall f in readFields: f in sourceFields
exists ia in invokedActions: ia startsWith "Admin/"

# Logical connectives
purity = "read-write" implies invokedActions != {}
purity = "read-only" and invokeCount = 0
```

## Test Generation Pipeline

### Input: `.view` manifest files

The generator discovers `.view` files in `specs/view/views/` (or
paths declared in `suite.yaml`).

### Step 1: Parse the `.view` file

Extract `shell` reference and `invariants` block. The invariant
parser reuses `parseNamedInvariant()` from the concept parser with
the extended assertion target vocabulary.

### Step 2: Compile the ViewShell into a QueryProgram

Replicate the CompileQuery sync logic:
1. Load ViewShell by name
2. Load child specs (DataSourceSpec, FilterSpec, SortSpec, etc.)
3. Build a QueryProgram (create → scan → filter → sort → project →
   invoke → match → pure)
4. If the view has invoke instructions (from InteractionSpec's
   createProgram/actionProgram), include those in the compiled program

### Step 3: Run analysis providers

Execute against the compiled QueryProgram:
- `QueryPurityProvider.analyze(program)` → purity, readFields,
  invokedActions
- `InvokeEffectProvider.analyze(program)` → invocations, invokeCount
- `QueryCompletionCoverage.check(program, conceptSpecs)` →
  coveredVariants, uncoveredVariants

### Step 4: Extract field sets from child specs

Walk the child spec data to compute:
- `sourceFields` from DataSourceSpec's schema/config
- `filterFields` from FilterSpec's predicate tree
- `sortFields` from SortSpec's key list
- `groupFields` from GroupSpec's key list
- `projectedFields` from ProjectionSpec's field list

### Step 5: Build ViewAnalysis record

Combine all provider results and field sets into the ViewAnalysis
object.

### Step 6: Generate test assertions

For each invariant declaration, generate a vitest test that:
1. Constructs the ViewAnalysis (steps 2-5 as test setup)
2. Evaluates the invariant predicate against the ViewAnalysis
3. Asserts the predicate holds

### Step 7: Render and write test file

Output to `generated/tests/<view-name>.view.test.ts` using the
same TypeScript test renderer patterns as concept conformance tests.
Store baseline via ContentHash for 3-way merge on regeneration.

### Generated Test Structure

```typescript
// generated/tests/content-list.view.test.ts
import { describe, it, expect } from 'vitest';
// ... imports for handlers, interpreter, providers ...

describe('View: content-list', () => {

  let analysis: ViewAnalysis;

  beforeAll(async () => {
    // Compile ViewShell → QueryProgram
    // Run analysis providers
    // Extract field sets
    analysis = await compileAndAnalyze('content-list');
  });

  describe('invariants', () => {

    it('always: purity is read-only', () => {
      expect(analysis.purity).toBe('read-only');
    });

    it('always: projected fields are subset of source schema', () => {
      for (const f of analysis.readFields) {
        expect(["id", "node", "kind", "name", "schemas"]).toContain(f);
      }
    });

    it('never: invoke instructions present', () => {
      expect(analysis.invokedActions.length).toBe(0);
    });

  });
});
```

## `.view` File Parser

The `.view` parser is lightweight — it only needs to extract:
1. The `view` name string
2. The `shell` reference string
3. The `invariants` block (delegated to the existing invariant
   parser)

```
view "<name>" {
  shell: "<view-shell-name>"

  invariants {
    <standard invariant blocks>
  }
}
```

No actions, no state, no fixtures — `.view` files are pure
assertion manifests over compiled query programs.

### Parser Implementation

Extend `handlers/ts/framework/` with a `view-spec-parser.ts` that:
1. Tokenizes the `.view` file
2. Extracts `name` and `shell` from the header
3. Delegates `invariants { ... }` to `parseNamedInvariant()` from
   the concept parser (imported, not duplicated)
4. Returns a `ViewSpec` AST:

```typescript
interface ViewSpec {
  name: string;
  shell: string;
  invariants: InvariantDecl[];
}
```

## Suite Integration

Add an optional `views` section to `suite.yaml`:

```yaml
views:
  - path: ./views/content-list.view
    description: "Content listing view — read-only, schema-filtered"

  - path: ./views/task-board-actions.view
    description: "Task board with inline actions — read-write"
```

The test generator discovers views via this section (or by globbing
`specs/view/views/*.view`).

## Examples

### Read-only content list

```
view "content-list" {
  shell: "content-list"

  invariants {
    always "purity is read-only": {
      purity = "read-only"
    }

    always "no invoke instructions": {
      invokeCount = 0
    }

    always "projects only known fields": {
      forall f in projectedFields:
      f in ["id", "node", "kind", "name"]
    }

    always "filter fields exist in source": {
      forall f in filterFields:
      f in sourceFields
    }
  }
}
```

Generated test catches: adding an invoke instruction to this view
would fail the purity invariant. Renaming a source field would fail
the filter field invariant.

### Read-write task board

```
view "task-board-actions" {
  shell: "task-board"

  invariants {
    always "purity is read-write": {
      purity = "read-write"
    }

    always "invokes only Task concept": {
      forall ia in invokedActions:
      ia startsWith "Task/"
    }

    always "all invoke variants covered": {
      uncoveredVariants = []
    }

    example "escalate action is invoked": {
      after compile
      then "Task/escalate" in invokedActions
    }
  }
}
```

Generated test catches: adding an invoke to a different concept
would fail the "invokes only Task" invariant. Removing a match
case would fail completion coverage.

### Minimal view (just purity)

```
view "simple-list" {
  shell: "simple-list"

  invariants {
    always "read-only": {
      purity = "read-only"
    }
  }
}
```

Even a single invariant is valuable — it prevents accidental purity
changes.

## Migration & Backwards Compatibility

- **No breaking changes.** `.view` files are a new, optional artifact.
  Views without `.view` manifests continue to work exactly as before
  with no generated tests.
- **Existing test generation** is unaffected.
  `generate-all-tests.ts` continues to handle `.concept` files.
  View test generation is either a new script
  (`generate-view-tests.ts`) or an additive branch in the existing
  script.
- **Suite manifest** gains an optional `views` section. Existing
  suites without it are unaffected.
- **Analysis providers** are already implemented (from the invoke
  PRD). No new provider concepts needed.

## Implementation Plan

### Step 1: `.view` file parser

1. Create `handlers/ts/framework/view-spec-parser.ts`
2. Implement tokenizer for `view "name" { shell: "..." invariants { ... } }`
3. Delegate invariant parsing to existing `parseNamedInvariant()`
4. Return `ViewSpec` AST
5. Unit tests for parser

### Step 2: ViewAnalysis compiler

1. Create `handlers/ts/framework/view-analysis.ts`
2. Implement `compileAndAnalyze(shellName)`:
   - Load ViewShell + child specs from storage
   - Build QueryProgram (replicate CompileQuery logic)
   - Run QueryPurityProvider, InvokeEffectProvider,
     QueryCompletionCoverage
   - Extract field sets from child specs
   - Return ViewAnalysis record
3. Unit tests for compilation and analysis

### Step 3: View test generator

1. Create `scripts/generate-view-tests.ts` (or extend
   `generate-all-tests.ts`)
2. Discover `.view` files from suite.yaml or glob
3. Parse each `.view` file
4. Compile ViewAnalysis for each
5. Generate vitest assertions from invariant declarations
6. Render to `generated/tests/<name>.view.test.ts`
7. Store ContentHash baseline for 3-way merge

### Step 4: Suite integration

1. Add optional `views` section to suite.yaml schema
2. Update `specs/view/suite.yaml` with view manifest entries
3. Create example `.view` files for existing views
4. Verify generated tests pass

### Step 5: Documentation

1. Add `.view` file syntax to concept-grammar.md
2. Update CLAUDE.md generated files section
3. Add `/create-view-invariants` skill or extend `/create-view-query`

## Open Questions

1. **Should `.view` files support non-invariant declarations?**
   For example, `defaults { pageSize: 25 }` or `description "..."`
   metadata. Recommendation: start minimal (name + shell +
   invariants only), extend later if needed.

2. **Live kernel assertions.** The `registeredActions` target
   requires a running kernel to enumerate registered concepts.
   Should these be skipped in static test generation and only
   checked in integration tests? Recommendation: yes — mark
   invariants referencing `registeredActions` as `@runtime` and
   skip them in static generation.

3. **Incremental analysis.** When a FilterSpec changes, do we
   recompile all views that reference it, or only the affected
   ones? Recommendation: the test generator recompiles all views
   on each run (same as concept conformance). Incremental
   invalidation can be added later via Score's dependence-graph.

4. **Should widget invariants also be checkable against
   ViewAnalysis?** A widget's state machine transitions could be
   verified against the view's purity (e.g., "this widget never
   triggers a write action in a read-only view"). Recommendation:
   future work — would require cross-referencing widget specs with
   view specs via the composition chain.

## Success Criteria

- [ ] `.view` files parse correctly with name, shell, and invariants
- [ ] ViewAnalysis compiler produces correct records from ViewShell
      + child specs + analysis providers
- [ ] Test generator produces valid vitest files from `.view`
      invariant declarations
- [ ] Generated tests correctly assert purity, field sets, invoke
      targets, and completion coverage
- [ ] 3-way merge preserves user patches to generated test files
- [ ] Existing views can be annotated with `.view` manifests and
      all generated tests pass
- [ ] A purity-breaking change (adding invoke to a read-only view)
      causes the generated test to fail
- [ ] A field reference breakage (renaming a source field) causes
      the generated test to fail
- [ ] Suite.yaml views section is optional and backwards-compatible
