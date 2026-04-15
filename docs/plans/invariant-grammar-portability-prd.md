# Universal Invariant Grammar — Concepts, Widgets, Views, Syncs Share One Shape

## Cross-spec audit — where we actually are

Invariant syntax already runs across four spec kinds. Most of the
unification work is already done; what's missing is code reuse and
test codegen for everything but concepts.

| Aspect | Concept (.concept) | Widget (.widget) | View (.view) | Sync (.sync) | Derived (.derived) |
|---|---|---|---|---|---|
| Has `invariant { }` block | ✓ (also top-level) | ✓ | ✓ | ✗ | ✗ |
| `example` | ✓ | ✓ | ✓ | — | — |
| `forall` | ✓ | ✓ | ✓ | — | — |
| `always` | ✓ | ✓ | ✓ | — | — |
| `never` | ✓ | ✓ | ✓ | — | — |
| `eventually` | ✓ | ✓ | ✓ | — | — |
| `requires_ensures` (action contract) | ✓ | ✓ | ✗ | — | — |
| Parser file | `handlers/ts/framework/parser.ts` | `widget-spec-parser.ts` | `view-spec-parser.ts` | `sync-parser.ts` | `derived-parser.ts` |
| Shared parser helpers | none | none | none | — | — |
| Shared AST type | `InvariantDecl` (`runtime/types.ts`) ✓ | same | same | — | — |
| Test codegen produces real assertions | ✓ via `test-gen.handler.ts` | ✗ stubs only | ✗ not rendered | — | — |

**Big findings**:

- **AST is already unified.** All three invariant-bearing parsers
  emit the same `InvariantDecl` type from `runtime/types.ts`:
  ```ts
  { kind: 'example' | 'forall' | 'always' | 'never' | 'eventually' | 'requires_ensures',
    name?, afterPatterns[], thenPatterns[], whenClause?, quantifiers?, contracts?, targetAction? }
  ```
- **Grammar keywords are identical** across concept, widget, view.
- **Parser logic is 95% copy-pasted** across three files — `parseQuantifierBinding`, `parseWhenClause`, `parseInvariantASTStep` exist three times with near-identical bodies.
- **Namespace differences are the only real divergence**: concept assertions reference action names + state fields; widget assertions reference anatomy parts + FSM states; view assertions reference query result columns.
- **Sync has no invariants**; its "guards" live implicitly in `when` + `where` clauses.
- **Derived has no invariants**; it's a pure composition declaration.

## Problem statement

Widget invariants parse cleanly but produce stub tests. Every platform
renderer (React, Vue, Svelte, Vanilla) emits the same placeholder body
for invariant blocks:

```js
render(<Component />);
// Invariant 'X' must always hold
expect(screen.getByTestId('root')).toBeDefined();
```

Playwright skips invariants entirely. ~70 of paragraph-block's 81
invariants are symbolic documentation, not enforced contracts.

## What's already in place (corrected)

The earlier draft of this PRD proposed a new Test Plan IR. I was wrong
to invent one — **the IR already exists and is active**:

- **`WidgetTestPlan`** (`handlers/ts/framework/test/widget-component-test-plan.handler.ts:55–68`)
  is the universal plan consumed by every platform renderer:
  ```ts
  interface WidgetTestPlan {
    widgetName: string; widgetRef: string; generatedAt: string;
    fsm_transitions:   WidgetTestAssertion[];
    connect_bindings:  WidgetTestAssertion[];
    keyboard_bindings: WidgetTestAssertion[];
    focus_management:  WidgetTestAssertion[];
    aria_assertions:   WidgetTestAssertion[];
    props:             WidgetTestAssertion[];
    invariants:        WidgetTestAssertion[];
    compose:           WidgetTestAssertion[];
    categories:        Category[];
  }
  ```
- **`WidgetTestAssertion`** (line 48) is flexible: `{category, type?,
  description, [k: string]: unknown}`. It's an open bag — anything a
  renderer needs can ride on it.
- **`buildWidgetTestPlan(widgetRef, manifest)`** (line 86) walks the
  parsed widget AST and fills every category.
- Platform renderers (`react-widget-test-renderer.ts`,
  `vue-widget-test-renderer.ts`, `svelte-`, `vanilla-`,
  `playwright-widget-test-renderer.ts`) all accept this plan.
- **`TestPlan`** (`test-gen.handler.ts:152–171`) is the sibling IR for
  concept conformance tests. Same shape philosophy, different
  categories (actions, examples, properties, stateInvariants,
  liveness, contracts).

So the layering already matches what the reframe called for:

```
Widget AST (parser)
    ↓ buildWidgetTestPlan
WidgetTestPlan (IR, universal)
    ↓ renderReact / renderVue / renderPlaywright / …
Per-platform test file
```

The gap isn't architectural — it's that the renderers' **treatment
of the invariants[] category** is a stub body, and the
`WidgetTestAssertion` shape for invariants doesn't carry enough
structured data for renderers to emit real code.

## The actual fix: enrich the invariant assertion shape, upgrade renderers

### 1. Extend `WidgetTestAssertion` with structured step + observation fields

Add OPTIONAL fields that renderers can consume when present. Keeps
backward compat — existing assertions still render as today.

```ts
interface WidgetTestAssertion {
  category: Category;
  type?: string;
  description: string;

  // ─── new optional fields for invariant assertions ───
  fixtures?: Array<{                 // multi-block scenarios
    id: string;                       // "blockA", "blockB"
    component: string;                // "paragraph-block"
    props: Record<string, unknown>;
  }>;
  steps?: Array<{                    // actions to fire, in order
    on?: string;                      // fixture id; omit for root
    action: 'focus' | 'blur' | 'click' | 'type' | 'press' | 'paste' | 'drag' | 'wait' | 'reload';
    args?: Record<string, unknown>;   // text / key / ms / etc.
  }>;
  observations?: Array<{             // assertions
    on?: string;                      // fixture id
    probe: string;                    // "body.textContent", "state.edit", "block.depth", …
    op?: '=' | '!=' | '>' | '<' | 'matches';
    value?: unknown;
    modality?: 'immediately' | 'eventually' | { neverWithin: number };
  }>;

  [key: string]: unknown;
}
```

`buildWidgetTestPlan` populates these from the invariant AST (the
parser already produces `afterPatterns` / `thenPatterns` /
`quantifiers` that map cleanly into `steps[]` / `observations[]`).

### 2. Give the parser a `scenario` kind

Today's grammar: `example`, `forall`, `always`, `never`, `eventually`,
`requires_ensures`. All single-widget.

Add `scenario` with `given / when / then`:

```
scenario "Shift+Tab places block after former parent": {
  given {
    blockA: paragraph-block { blockId: "A", depth: 0 }
    blockB: paragraph-block { blockId: "B", depth: 1, parent: "A" }
    blockD: paragraph-block { blockId: "D", depth: 2, parent: "B" }
  }
  when {
    on blockD: body.focus() -> ok
    and body.press("Shift+Tab") -> ok
  }
  then {
    block("D").depth = 1 immediately
    and block("D").orderAfter = "B" eventually
  }
}
```

At the AST level this is just another `InvariantDecl` with
`kind: 'scenario'`, `fixtures: Fixture[]`, `whenSteps: Step[]`,
`thenAssertions: Assertion[]`. `buildWidgetTestPlan` compiles it into
a `WidgetTestAssertion` with populated `fixtures`, `steps`,
`observations`. No new IR.

### 3. Universal probe namespace

The invariant author uses one platform-agnostic namespace. Renderers
translate it once per platform.

**Targets:**
- `root` — outer element (`[data-part="root"]`)
- `<anatomyPart>` — any part declared in the widget (`body`, `trigger`, …)
- `block("id")` — fixture-mounted block by `data-block-id`
- `document` — top-level (`document.activeElement`)

**Read probes:**
- `<target>.textContent`, `.innerHTML`
- `<target>.contentEditable`, `.readOnly`, `.disabled`
- `<target>.dataX` / `.ariaX` — auto camelCase→dash
- `<target>.depth`, `.childCount`, `.focused`, `.visible`
- `state.<field>` — FSM slot, persisted on root as `data-state-<field>`
- `document.activeElement = <target>`

**Write probes (steps):**
- `.focus()`, `.blur()`, `.click()`
- `.type("text")` — native input events
- `.press("Tab" | "Enter" | "ArrowUp" | …)`
- `.dragTo(<target>)`, `.paste("text")`
- `simulate.reload()`, `simulate.wait(ms)` — timing knobs

Everything is grounded in `data-part`, `data-block-id`, aria-role —
attributes the widgets already emit. Nothing new per widget.

### 4. Per-platform renderer translation

Each renderer learns ONE translation table. Here's the React table
sketch (`react-widget-test-renderer.ts`):

```ts
function readProbe(on: string, probe: string): string {
  // body.textContent → screen.getByTestId('body').textContent
  // block("A").depth → screen.getByTestId('block-A').getAttribute('data-depth')
  // state.edit       → screen.getByTestId('root').getAttribute('data-state-edit')
  // …
}
function emitStep(step): string {
  // focus   → el.focus()
  // type    → await userEvent.type(el, args.text)
  // press   → await userEvent.keyboard('{' + args.key + '}')
  // reload  → rerender(<Widget {...props} />) or similar
  // wait    → await new Promise(r => setTimeout(r, args.ms))
}
function emitObservation(obs): string {
  // immediately     → expect(read).toBe(value)
  // eventually      → await waitFor(() => expect(read).toBe(value))
  // never-within    → polling loop that fails if disallowed ever observed
}
```

Playwright's table maps the same namespace to `page.locator(...)`,
`await locator.click()`, `await locator.press('Tab')`,
`await expect(locator).toHaveText(...)`, etc.

Adding Vue / Svelte / SwiftUI / Jetpack is "write one of these tables".
The WidgetTestPlan doesn't change; widgets don't change.

## Unification story — modeled as concepts + syncs

The AST is already one thing. The parsers aren't. And the cleffiest
unification isn't "extract a TS helper class" — it's "express the
whole pipeline as concepts wired by syncs". Which is what the rest
of the framework already does for parsing + codegen.

### Concepts

New concepts (small, independent, Jackson's methodology):

```
concept InvariantParser [S]
  purpose
    parse invariant blocks from any spec-kind source using a resolver
  state
    rows: set of InvariantRow with
      invariantId: Id; specKind: String; sourceRef: Id;
      kind: String;  -- example | forall | always | never |
                        eventually | requires_ensures | scenario
      name: String; astJson: String;
  actions
    parse(specKind: String, sourceRef: Id, source: String,
          contextId: Id) : (invariants: Json) or (error: String)
    list(specKind: String) : (invariants: Json)
    get(invariant: Id) : (ast: Json) or (notfound)
```

```
concept AssertionContext [C]
  purpose
    resolve an identifier in a specific host spec's namespace
    so the shared InvariantParser can validate references without
    knowing whether it's parsing a concept, widget, view, sync,
    or derived spec.
  state
    contexts: set of Context with
      contextId: Id; specKind: String;
      declaredSymbols: list of { name: String; kind: String };
  actions
    register(contextId: Id, specKind: String, symbols: Json) : (ok)
    resolve(contextId: Id, name: String)
      : (kind: String; info: Json) or (notfound)
    clear(contextId: Id) : (ok)
```

```
concept TestPlan [T]
  purpose
    enriched plan row per invariant, platform-agnostic
  state
    plans: set of Plan with
      planId: Id; invariantId: Id; specKind: String;
      fixtures: Json; steps: Json; observations: Json;
      settlement: Json;
  actions
    build(invariantId: Id) : (plan: Id) or (error: String)
    get(plan: Id) : (plan: Json) or (notfound)
    listFor(invariantId: Id) : (plans: Json)
```

```
concept TestPlanRenderer [R]
  purpose
    translate a TestPlan to runtime test code for a target platform
  state
    renderers: set of Renderer with
      platform: String;  -- react | playwright | vue | swiftui | …
      universalProbeTable: Json;  -- probe-name → emit-snippet fn id
  actions
    register(platform: String, probeTable: Json) : (ok) or (duplicate)
    render(planId: Id, platform: String)
      : (code: String) or (notfound) or (unsupportedProbe: String)
```

### Syncs wire the pipeline

```
sync ExtractInvariantsOnParse [eager]
  purpose: when any spec parser completes, extract invariant blocks
           through the shared InvariantParser using the host spec's
           AssertionContext.
  when {
    ConceptParser/parse:    [ ?src ] => ok(contextId: ?ctx, source: ?s)
    | WidgetParser/parse:   [ ?src ] => ok(contextId: ?ctx, source: ?s)
    | ViewSpecParser/parse: [ ?src ] => ok(contextId: ?ctx, source: ?s)
    | SyncParser/parse:     [ ?src ] => ok(contextId: ?ctx, source: ?s)
    | DerivedParser/parse:  [ ?src ] => ok(contextId: ?ctx, source: ?s)
  }
  then {
    InvariantParser/parse: [
      specKind: ?kind; sourceRef: ?src; source: ?s; contextId: ?ctx
    ]
  }

sync BuildTestPlanOnInvariantParse [eager]
  when { InvariantParser/parse: [ ?src ] => ok(invariants: ?invs) }
  then { TestPlan/build: [ invariantId: ?eachId ] } -- per invariant

sync RenderForEachRegisteredPlatform [eager]
  when { TestPlan/build: [ ?inv ] => ok(plan: ?planId) }
  where { TestPlanRenderer: { ?r platform: ?p } }
  then { TestPlanRenderer/render: [ planId: ?planId; platform: ?p ] }
```

### Why this is the cleffy shape

- **Each step is an independent concept.** Swap, replace, or extend
  any one without touching the others (Jackson's methodology).

- **Pipeline is a sync chain.** No hardcoded orchestration.
  Registering a new platform renderer (say, `jetpack-compose`) is
  one `TestPlanRenderer/register` call; `RenderForEachRegisteredPlatform`
  picks it up automatically on the next parse.

- **Each spec kind gets its own AssertionContext row.** Seeded at
  boot: `AssertionContext/register` for concept, widget, view, sync,
  derived. The `InvariantParser` never knows which it's parsing.

- **The universal probe namespace is a concept data row**
  (`TestPlanRenderer.universalProbeTable`), not a compile-time
  TypeScript object. Change the React probe for `body.type("h")`
  at runtime by updating one row.

- **Score + Pilot can trace the whole pipeline.** Because every
  step is a concept action, parse-to-render is a standard completion
  chain: visible in FlowTrace, queryable via `ScoreApi/getFlow`.

- **Seeds, not code, wire the scope.** `AssertionContext.register`
  lives in a seed file per spec kind. `TestPlanRenderer.register`
  lives in per-platform seed files. Adding a platform = seed the
  renderer + ship the probe table; done.

`InvariantBodyParser` as a pure TS class would have worked but been
invisible to Score / Pilot / SeedData / RuntimeRegistry. Modeling as
concepts + syncs puts the invariant pipeline in the same layer the
rest of Clef's own tooling occupies.

### Does every spec kind need invariants? Honest scope

| Kind | Invariants make sense? | Why |
|---|---|---|
| **Concept** | ✓ strong | Canonical Jackson case. Concepts own state + action contracts; invariants codify both. `requires_ensures`, state integrity (`never two users with same email`), variant safety. |
| **Widget** | ✓ strong | FSM + ARIA + anatomy. Invariants are the contract between the abstract spec and platform renderers. Focus behavior, keyboard dispatch, state transitions. |
| **View** | ✗ weak at this level | A view is an ASSEMBLY of FilterSpec + SortSpec + ProjectionSpec + DataSourceSpec + PresentationSpec + InteractionSpec. Invariants really belong on those component specs where the actual state lives — `FilterSpec { always "tree has root node" }`, `ProjectionSpec { forall f in fields: f.key in source.fields }`. View-level invariants mostly re-phrase component invariants. **Keep the parse support already in place but stop driving adoption at this layer.** |
| **Sync** | ~ optional, not default | Sync guards already live in `when` + `where` + `guard`. A sync already declares its pre- and post-conditions via its clauses. Adding a second invariant layer is mostly redundant for normal syncs. There's a narrow useful slice — *dispatch syncs that fan out across multiple actions* (InvokeViaBinding, ExecuteReversal) where "fires exactly once", "never forwards to unresolved target", etc. are worth stating explicitly. Keep support OPT-IN, not encouraged for every sync. |
| **Derived** | ✗ weak | Derived concepts are packaging. Their "emergent" properties are really integration tests exercising the composed sync chain — better placed as concept-level test fixtures, not as structural invariants of the composition. Skip. |

So the real target set is **concept + widget** as first-class
carriers, plus **sync** as opt-in for dispatch-fan-out syncs. The
earlier "all five" framing was overreach.

What this changes for the unification work:

- The shared `InvariantParser` + `AssertionContext` still delivers
  the win (~500 lines of parser duplication collapsed, real
  runtime tests for concept + widget invariants).
- Adding grammar to `.sync` is a small optional extension for
  dispatch fan-out syncs only, behind a conscious authoring choice.
- **Skip** adding invariants to `.derived` and `.view` until a
  concrete use case appears that genuinely can't be expressed at
  the component-spec layer.

Worked example of the sync slice where invariants DO earn their
weight — InvokeViaBinding's dispatch fan-out:

```
sync InvokeViaBinding [eager]
  when { ActionBinding/invoke: [ binding: ?b; context: ?ctx ] => ok(…) }
  where { ActionBinding: { ?b target: ?target } }
  then { Binding/invoke: [ binding: ?b; action: ?target; input: ?ctx ] }

  invariant {
    never "forwards to unresolved target": {
      event.targetResolved = false
      and event.bindingInvokeFired = true
    }
    always "context passes through unchanged": {
      forall (b, ctx) in firings:
        firings[b].input = ctx
    }
  }
```

Don't seed a sync with invariants just because the grammar allows
it. The bar is: *the sync has dispatch logic whose failure modes
aren't already caught by its clauses*.

### Even "generate all tests" is cleffy

Today's entry points are imperative scripts — `scripts/generate-all-tests.ts`
and `scripts/generate-widget-tests.ts` — that walk the filesystem,
parse specs in-process, and write test files. In the cleffy shape,
the script becomes a thin CLI that dispatches a top-level derived
concept; every step is a traceable concept action.

One more concept:

```
concept TestArtifact [A]
  purpose
    track generated test files for a given spec+platform pair so
    regeneration is a diff, not a blind overwrite.
  state
    artifacts: set of Artifact with
      artifactId: Id; specKind: String; sourceRef: Id;
      platform: String; outputPath: String;
      contentHash: String; writtenAt: DateTime;
  actions
    write(specKind, sourceRef, platform, outputPath, content: String)
      : (artifact: Id; changed: Bool)
    list(specKind?: String, platform?: String) : (artifacts: Json)
    prune(spec: Id) : (removed: Int)
```

And a derived concept composing the whole pipeline:

```
derived TestGeneration composes
  SpecDiscovery, InvariantParser, AssertionContext,
  TestPlan, TestPlanRenderer, TestArtifact
  syncs
    extract-invariants-on-parse:    required
    build-test-plan-on-invariant:   required
    render-for-each-platform:       required
    write-artifact-on-render:       required
    prune-artifacts-on-spec-delete: recommended
```

Syncs for the last two:

```
sync WriteArtifactOnRender [eager]
  when { TestPlanRenderer/render: [ ?plan ] => ok(code: ?code) }
  where { TestPlan: { ?plan invariantId: ?inv; specKind: ?k; platform: ?p } }
        { InvariantParser: { ?inv sourceRef: ?src } }
  then { TestArtifact/write: [
           specKind: ?k; sourceRef: ?src; platform: ?p;
           outputPath: derivedPath(?k, ?src, ?p);
           content: ?code
         ] }

sync PruneArtifactsOnSpecDelete [eager]
  when { SpecRegistry/delete: [ spec: ?s ] => ok }
  then { TestArtifact/prune: [ spec: ?s ] }
```

The CLI just invokes `TestGeneration/run`:

```ts
// scripts/generate-all-tests.ts — thin dispatch
import { getKernel } from '../clef-base/lib/kernel';
const kernel = getKernel();
await kernel.invokeConcept('urn:clef/TestGeneration', 'run', { target: 'all' });
```

Every step is visible to Score (`getFlow --from TestGeneration/run`),
Pilot (`pilot/where` shows the pipeline), and FlowTrace (the parse →
extract → plan → render → write causal chain). Failing tests are
flagged as completions of `TestPlanRenderer/render` with variant
`unsupportedProbe`. Seeding a new platform renderer makes it
auto-regenerate on every subsequent `TestGeneration/run`.

## Scope of first cut (after unification)

1. **Extract `InvariantBodyParser` + `AssertionContext`.** Refactor
   concept-parser, widget-spec-parser, view-spec-parser to delegate.
   No grammar change; no AST change; behavior-equivalent. ~500 line
   net deletion.

2. **Add `scenario` kind** to the shared parser. Extends the
   existing `given / when / then` slot in `InvariantDecl` with
   `fixtures: Fixture[]`. Lands in all four spec kinds simultaneously
   because they share one parser now.

3. **Extend `WidgetTestAssertion`** with optional structured
   `fixtures` / `steps` / `observations` / `settlement` fields
   (already described earlier in this PRD). Same enrichment on the
   concept-side `TestPlan` so both IRs carry the same data.

4. **Unify codegen**: have `test-gen.handler.ts` and
   `widget-component-test-plan.handler.ts` delegate invariant
   rendering to ONE new module `test-plan-invariants.ts` that
   knows how to emit real React / Playwright / Vue / Vitest /
   XCUITest code from the enriched assertion shape. View specs get
   a third client of the same module.

5. **Add invariant blocks to sync and derived parsers**, injecting
   their own `AssertionContext` implementations. No new grammar —
   same keywords, same AST, same codegen.

6. **Retrofit existing invariants**: paragraph-block's 81, every
   concept spec's invariants, every view's — start generating real
   tests with no spec changes required.

## What gets enforced

Today's unenforceable invariants become first-class generated tests:

```
scenario "ArrowUp traverses across sibling-group boundaries": {
  given {
    blockA: paragraph-block { blockId: "A" }
    blockA1: paragraph-block { blockId: "A.1", parent: "A" }
    blockB: paragraph-block { blockId: "B" }
  }
  when {
    on blockB: body.focus() -> ok
    and body.press("ArrowUp") -> ok
  }
  then {
    document.activeElement = block("A.1").body
  }
}
```

`buildWidgetTestPlan` emits a `WidgetTestAssertion` in the `invariants`
category with fixtures/steps/observations populated. React renderer
emits a real vitest test. Playwright renderer emits an equivalent
`.spec.ts`. Same invariant, same IR, different platform targets.

## Execution plan (follow-up, not in this session)

Every step is itself a Clef concept spec + handler + sync wiring.
No new TS orchestration; even the CLI is a dispatcher.

1. **Concept specs + handlers land first** (no grammar change yet):
   `InvariantParser`, `AssertionContext`, `TestPlan`,
   `TestPlanRenderer`, `TestArtifact`. Plus four syncs:
   `ExtractInvariantsOnParse`, `BuildTestPlanOnInvariantParse`,
   `RenderForEachRegisteredPlatform`, `WriteArtifactOnRender`.
   Plus derived concept `TestGeneration` composing all of them.
   Use the existing concept + sync scaffolds (`/create-concept`,
   `/create-sync`, `/create-derived-concept`).

2. **Seed initial AssertionContexts** — one row each for concept,
   widget, and (opt-in) sync. Declared symbols are mined from
   the existing parsers' symbol tables.

3. **Seed initial TestPlanRenderer rows** with universal probe
   tables for React + Playwright. Vue / Svelte / Vanilla /
   SwiftUI / Jetpack land as follow-up seeds.

4. **Migrate the current parsers** (concept-parser, widget-
   spec-parser) to call `InvariantParser/parse` instead of their
   inlined `parseInvariant` methods. View keeps its parse path
   for now but stops driving adoption (see scope table above).

5. **`scenario` kind** added to `InvariantParser`. Lands in
   concept + widget + opt-in sync simultaneously because the
   parser is shared.

6. **Replace `scripts/generate-*.ts` with thin dispatchers** that
   call `TestGeneration/run`. Real work moves into the concept
   pipeline; the script is a 10-line CLI wrapper.

7. **Retrofit existing invariants**: paragraph-block's 81, every
   concept spec — start generating real tests. Adopt invariants
   in a handful of high-leverage dispatch syncs (InvokeViaBinding,
   ExecuteReversal). Leave view + derived alone unless a concrete
   case appears.

8. **Score + Pilot integration**. Because every pipeline step is
   a concept action, `ScoreApi/getFlow --from TestGeneration/run`
   traces spec → invariants → plans → rendered code → written
   artifacts without extra instrumentation. Failures surface as
   completion variants (e.g., `TestPlanRenderer/render` ok vs
   unsupportedProbe), which is queryable through the same API.

9. **Per-platform translation tables** (Vue / Svelte / Vanilla /
   SwiftUI / Jetpack) land as each platform needs enforcement.
   `TestPlanRenderer/register` + seed + done — no spec changes.
