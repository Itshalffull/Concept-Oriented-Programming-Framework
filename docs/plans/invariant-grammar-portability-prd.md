# Universal Invariant Grammar — Concepts, Widgets, Views, Syncs Share One Shape

## Kanban (MAG-904 parent, anthropics/concept-oriented-programming-framework)

| Card | Title | Blocks |
|---|---|---|
| [MAG-904](https://vibekanban.com) | **INV: Universal Invariant Grammar + Clefy Test Pipeline** (parent) | — |
| [MAG-905](https://vibekanban.com) ✅ `dd0e05cb` | INV-1 Concepts — InvariantParser [S], TestPlan [T], TestArtifact [A] | MAG-906, MAG-907, MAG-908, MAG-910 |
| [MAG-906](https://vibekanban.com) ✅ `129dea56` | INV-2 AssertionContext plugins (concept/widget/view/sync/derived) | MAG-910, MAG-911 |
| [MAG-907](https://vibekanban.com) ✅ `ab4e357e` | INV-3 TestPlanRenderer plugins (React + Playwright) | MAG-909, MAG-913 |
| [MAG-908](https://vibekanban.com) ✅ `c2d7d361` | INV-4 Syncs wire the pipeline (Extract / Build / Render / Write / Prune) | MAG-909 |
| [MAG-909](https://vibekanban.com) ✅ `5a07e1d8` | INV-5 Derived concept TestGeneration composing the pipeline | MAG-913 |
| [MAG-910](https://vibekanban.com) ✅ `d078787a` | INV-6 Migrate concept-parser + widget-spec-parser to delegate to InvariantParser | MAG-911, MAG-912 |
| [MAG-911](https://vibekanban.com) ✅ `585fd048` | INV-7 Extend view-parser + sync-parser + derived-parser with invariant support | MAG-914 |
| [MAG-912](https://vibekanban.com) ✅ `b21671e4` | INV-8 Add `scenario` kind — multi-block fixtures + given/when/then + settlement modalities | MAG-914, MAG-915, MAG-918 |
| [MAG-913](https://vibekanban.com) ✅ `ff34c8d9` | INV-9 Replace `scripts/generate-*.ts` with thin `TestGeneration/run` dispatchers | MAG-914 |
| [MAG-914](https://vibekanban.com) ✅ `29a79e09` | INV-10 Retrofit existing invariants + proof-of-life cross-kind invariants | MAG-915, MAG-916 |
| [MAG-915](https://vibekanban.com) | INV-11 Propagate grammar update through every reference surface | MAG-916 |
| [MAG-916](https://vibekanban.com) | INV-12 Additional platform renderers (Vue / Svelte / Vanilla / SwiftUI / Jetpack) — low priority | — |
| [MAG-917](https://vibekanban.com) ✅ `83e0a06a` | INV-13 Wire test execution through `Builder/test` so dormant quality-signal syncs fire | — |
| [MAG-918](https://vibekanban.com) ✅ `7a07bdc2` | INV-14 Integrate ExternalHandlerGen + IntegrationTestGen with universal grammar — `scenario` invariants feed IntegrationTestGen alongside fixtures; ExternalHandlerGen-generated handlers participate in TestGeneration pipeline | — |
| [MAG-919](https://vibekanban.com) | INV-15 Add `/create-external-handler` + `/generate-integration-test` skills — extend `examples/devtools/devtools.interface.yaml`, regen via `scripts/regen-interface.ts` | — |
| [MAG-920](https://vibekanban.com) | INV-16 Handlers-as-values test generation — TestPlan consumes StorageProgram descriptions + ExternalHandler manifests; emit mock/replay handler variants, effect-contract tests, FieldTransform-fuzzed inputs | — |

Execution order comes from the blocking graph:

```
MAG-905 ──┬─► MAG-906 ──┬─► MAG-910 ──┬─► MAG-911 ─► MAG-914 ─┬─► MAG-915 ─► MAG-916
          │             │             │                      │
          ├─► MAG-907 ──┼─► MAG-909 ──┤   MAG-912 ────────────┤
          │             │             │                      │
          └─► MAG-908 ──┘             └─► MAG-912 ────────────┤
                                                              │
                                          MAG-913 ────────────┘
```

Leaf parallelism: after MAG-905 lands, MAG-906 / MAG-907 / MAG-908 run
concurrently. After MAG-910 lands, MAG-911 / MAG-912 run concurrently.
MAG-913 and MAG-909 run the moment their prerequisites complete.

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

**Each AssertionContext is its own concept with a `register` action,
wired to `PluginRegistry` via a sync.** Pattern matches what
`syncs/execution/register-instance-providers.sync` and
`syncs/framework/register-framework-generators.sync` already do for
every other plugin kind in Clef: concept → `register` action → sync
watches the completion → `PluginRegistry/register`. Seed files are
for CONTENT (user data, entities); plugin registration is a
`register → PluginRegistry/register` sync path.

```
concept ConceptAssertionContext [C]
  purpose "Resolve concept-spec identifiers for the InvariantParser."
  actions
    register() : ok(name: "concept"; declaredSymbols: list of …)
    resolve(name: String) : ok(kind: String; info: Json) | notfound
```

Sync wires it:

```
sync RegisterConceptAssertionContext [eager]
when {
  ConceptAssertionContext/register: []
    => ok(name: ?name; declaredSymbols: ?syms)
}
then {
  PluginRegistry/register: [
    type: "assertion-context";
    name: ?name;
    metadata: { declaredSymbols: ?syms; kind: "concept" }
  ]
}
```

Five contexts total (concept, widget, view, sync, derived), each its
own concept + handler + one sync. Adding a sixth spec kind = one
new concept + one new sync.

The `InvariantParser` consults `PluginRegistry/discover(type:
"assertion-context")` at parse time and routes identifier
resolution by dispatching `ConceptAssertionContext/resolve` (or
whichever matches the spec kind).

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

**Each TestPlanRenderer is its own concept, same pattern:**

```
concept ReactRenderer
  actions
    register() : ok(name: "react"; capabilities: list of …)
    render(plan: Json) : ok(code: String) | unsupportedProbe
```

```
sync RegisterReactRenderer [eager]
when {
  ReactRenderer/register: []
    => ok(name: ?name; capabilities: ?caps)
}
then {
  PluginRegistry/register: [
    type: "test-plan-renderer";
    name: ?name;
    metadata: { capabilities: ?caps; kind: "renderer" }
  ]
}
```

Render-for-each-platform calls `PluginRegistry/discover(type:
"test-plan-renderer")` and dispatches the matching renderer's
`render` action per hit. Adding a platform = one new concept + one
new sync.

**CLI path is different.** The CLI bootstraps the kernel imperatively
(see `handlers/ts/framework/kernel-boot.handler.ts` —
`bootKernel({ concepts: [{uri, handler, …}, …], syncFiles: […] })`).
For CLI plugin loading, concepts + syncs are registered directly
through the boot config rather than discovered via runtime
`PluginRegistry/discover`. The runtime registry is still authoritative
for discovery at invoke time; the boot path just imports and wires.

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

### Does every spec kind need invariants?

Thinking through this honestly rather than narrowing reflexively.
Each spec kind has a DIFFERENT shape of thing worth asserting,
and all five carry some. The key question per kind is "what class
of failure does an invariant catch here that the spec itself
doesn't?"

**Concept — ✓ strong.** Canonical Jackson case. Concepts own state
+ actions + variants. Invariants codify contracts the spec can't
directly express:
- `requires_ensures` on actions (pre/post-conditions on each
  variant) — these ARE the contract, not a restatement of it
- State integrity across actions: `never two users with the same
  email`, `always every Outline child has a valid parent id`
- Variant completeness: `forall action a: exists handler variant`

**Widget — ✓ strong.** FSM + anatomy + ARIA + keyboard. Invariants
are the cross-platform contract between the spec and every
renderer (React, Playwright, SwiftUI, etc.). Without them there's
no way to verify a renderer matches the spec:
- Transition closure (`after FOCUS from idle -> focused`)
- ARIA consistency (`always body.aria-readonly = props.readOnly`)
- Focus trap guarantees (`never focus leaves modal when trap=true`)
- Keyboard dispatch (`keydown Enter in editing -> ENTER_BLOCK`)

**View — ✓ meaningful for cross-component consistency.** I was
too quick to dismiss this earlier. A view is an assembly, but the
assembly has properties no single component owns:
- `forall f in ProjectionSpec.fields: f.key in DataSourceSpec.fields`
  — projection can only surface fields the data source provides
- `FilterSpec.tree references only DataSourceSpec.fields` —
  filter can't reference a column the data source doesn't emit
- `SortSpec.keys ⊆ (DataSourceSpec.fields ∪ ProjectionSpec.fields)`
- `PresentationSpec.displayType compatible with InteractionSpec`
  (board needs a groupField, table needs column specs)

These are **cross-component** invariants. Neither FilterSpec
alone nor DataSourceSpec alone can state them; only the
assembly. Also specific: `example "filter+sort preserves row
count"` at the view level is a real integration contract. View
invariants earn their weight; they're NOT redundant with
component invariants.

**Sync — ✓ meaningful for runtime behavior.** Syncs have
`when / where / then`, which declare a DISPATCH contract but
not the runtime guarantees:
- `fires exactly once per trigger firing` (no re-entry, no
  double-dispatch) — NOT in when/where/then
- `data flow preservation` (`forall firing: then.input.ctx =
  when.match.ctx`) — the sync can SHADOW a variable; invariants
  catch that
- `completion variant coverage` (`every X/action ok completion
  eventually triggers Y`) — emergent from the where-clause but
  worth stating
- `negative conditions` (`never forwards to an unresolved
  target`) — the where might silently filter; invariants make
  filtered-out cases observable

Most syncs won't need invariants. **Complex dispatch fan-out syncs
(InvokeViaBinding, ExecuteReversal, automation-dispatch) definitely
do.** Not opt-in-only; they're first-class for syncs that do real
dispatch logic.

**Derived — ✓ meaningful for emergent contracts.** Derived
concepts are the compositional surface a user programs against.
Their invariants state what the composition GUARANTEES:
- `every ContentNode/save eventually produces a SearchIndex/index`
  — emergent from the sync chain, observable only at the derived
  composition level
- `the composition doesn't create action cycles` — structural
- `ClefBase.ContentFoundation.save(node) -> SearchIndex has
  node OR ContentHash has node` — contract the caller can rely
  on
- `required syncs fire; recommended syncs may be absent`

These are NOT "just integration tests dressed up". They are the
PROMISES a derived concept makes to its users. Skipping them
means the composition's behavior is whatever the sync wiring
happens to do, which isn't the Jackson methodology.

### Different shapes per spec kind

All five kinds benefit from invariants, but the DOMINANT shape
differs:

| Kind | Dominant invariant shape |
|---|---|
| Concept | `requires_ensures` + state integrity (`always`, `never`) |
| Widget | FSM transitions (`after EVENT -> state`) + ARIA coupling (`always`) |
| View | Cross-component consistency (`forall` over the assembly) |
| Sync | Dispatch behavior (`fires-exactly-once`, `eventually`, `never`) |
| Derived | Emergent guarantees (`eventually`, `implies`, `always across chain`) |

These don't require separate grammars — they require the **same**
grammar reading identifiers in **different namespaces**. Which is
what `AssertionContext` plugins give us.

Worked example of a sync invariant that earns its weight —
InvokeViaBinding:

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
    eventually "every invoke completes": {
      after ActionBinding/invoke(binding: ?b) -> ok
      eventually Binding/invoke(binding: ?b) -> ok | error
    }
  }
```

Worked derived example — ContentFoundation's save contract:

```
derived ContentFoundation composes
  ContentNode, ContentStorage, ContentHash, Outline, …
  syncs content-node-save-indexes: required, …

  invariant {
    always "save propagates through SearchIndex": {
      forall n in saved_content_nodes:
        eventually n.id in SearchIndex.indexed
    }
    never "save leaves dangling outline": {
      exists n: n in ContentNode
        and Outline.parentOf(n) = none
        and n != page_root
    }
  }
```

These are real guarantees a caller of ContentFoundation relies on.
Worth writing, worth generating tests for.

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

## Current state — the testing suite is mostly dormant

Audit finding: the `repertoire/concepts/testing/` suite has
`Conformance`, `TestGen`, `QualitySignal`, `FlakyTest`,
`RegressionSuite`, `TestSelection`, `Snapshot`, `ContractTest`,
and `widget-component-test-plan` concepts — but nothing today
actually wires up to them. The existing conformance tests are
plain Vitest files that import handlers directly; `scripts/generate-*.ts`
calls `buildTestPlan()` + renderer functions as local TS imports,
never `TestGen/generate`. Three syncs in the suite
(`unit-tests-publish-quality-signal.sync`, `record-test-result.sync`,
`generated-tests-run-by-builder.sync`) are declared but dormant —
they watch for `Builder/test` / `TestGen/generate` completions that
nothing ever fires.

Implication: the pipeline work in this PRD isn't just enriching an
existing concept flow — it's the **first actual wiring** for these
concepts. The scope grows:

- `TestGeneration/run` dispatches `TestGen/generate` (currently a
  standalone handler invocation).
- Test execution flows through `Builder/test` so the three dormant
  syncs light up — QualitySignal, FlakyTest, and generated-tests-
  run-by-builder start receiving real completions.
- `Conformance` rows populate with generated-test-file references so
  a concept's test coverage is queryable via Score / Pilot.
- `RegressionSuite` starts tracking which tests belong to each
  release / milestone.

The PRD's step 9 ("replace scripts/generate-*.ts with thin
dispatchers") now has a corresponding sibling: a step that runs
the generated tests through `Builder/test` so the quality signal
chain actually fires. Track as a separate follow-up card below if
not folded into INV-9 directly.

## External handler integration (MAG-918, INV-14)

Two existing devtools concepts already generate code from concept
specs against the **fixture** annotation:

- `specs/framework/external-handler-gen.concept` — given an ingest
  manifest, emits a handler that wraps an external REST API as a
  first-class Clef concept, with one `perform('http', ...)` per action.
- `specs/framework/integration-test-gen.concept` — walks fixture
  `after` chains in a concept spec, topologically sorts them, and
  emits a `ProcessSpec` whose steps are `external-call` invocations.
  `-> error` / `-> notfound` annotations become CheckVerification
  assertions on the expected variant.

These overlap heavily with the universal grammar work:

1. **`scenario` invariants are integration tests**. The MAG-912
   scenario kind (multi-fixture given/when/then + settlement
   modalities) is the same shape IntegrationTestGen produces by
   hand from fixture chains. After MAG-912 lands, IntegrationTestGen
   should consume `scenario` invariants directly — emitting a
   step per `when` action and a CheckVerification per `then` assert,
   with settlement modality controlling whether the step waits for a
   completion event vs. polling.

2. **ExternalHandlerGen-generated handlers should round-trip through
   TestGeneration**. A handler emitted by ExternalHandlerGen is a
   normal Clef handler; once registered, the TestGeneration pipeline
   (MAG-909) should be able to render its concept's invariants as
   Playwright tests that hit the real external API. Today nothing
   wires the two together — the generated handler exists in isolation.

3. **Shared assertion vocabulary**. IntegrationTestGen's variant-
   assertion pattern (`-> error` becomes a CheckVerification on
   `Variant === 'error'`) duplicates the assertion shape produced by
   the AssertionContext plugins (MAG-906). Both should emit through
   the same TestPlan IR (MAG-905) so a single set of renderers
   (React, Playwright, ProcessSpec) covers all three sources:
   in-spec invariants, fixture chains, and scenario blocks.

Card MAG-918 is the integration work: extend IntegrationTestGen to
read scenario invariants alongside fixture chains, register
ExternalHandlerGen-generated handlers with the TestGeneration
pipeline, and reroute IntegrationTestGen's emission through TestPlan
+ a new `process-spec` renderer plugin so the ProcessSpec output
becomes one renderer among many. Blocked on MAG-912 (scenario kind)
and MAG-907 (renderer plugin pattern) — both already landed except
scenario, so MAG-918 unblocks the moment MAG-912 does.

## File layout — repertoire testing suite, NOT clef-base

Everything framework-level lives in the existing repertoire testing
suite, where `test-gen.concept` and `widget-component-test-plan.concept`
already live. Not `clef-base/seeds/` — that's an app-level directory
for clef-base specifically.

```
repertoire/concepts/testing/
├── suite.yaml                                 (extend with new entries)
├── invariant-parser.concept                   (INV-1)
├── test-plan.concept                          (INV-1 — evolved form of
│                                               widget-component-test-plan
│                                               unified with test-gen IR)
├── test-artifact.concept                      (INV-1)
├── test-generation.derived                    (INV-5)
├── seeds/
│   ├── AssertionContext.plugins.seeds.yaml    (INV-2 — PluginRegistry/register
│   │                                           rows for each spec kind)
│   └── TestPlanRenderer.plugins.seeds.yaml    (INV-3 — one row per platform)
├── syncs/
│   ├── extract-invariants-on-parse.sync       (INV-4)
│   ├── build-test-plan-on-invariant.sync      (INV-4)
│   ├── render-for-each-platform.sync          (INV-4)
│   ├── write-artifact-on-render.sync          (INV-4)
│   └── prune-artifacts-on-spec-delete.sync    (INV-4)
└── tests/                                     (conformance tests)

repertoire/concepts/assertion-contexts/        (INV-2 — NEW suite, mirrors
│                                                test-gen-providers pattern)
├── suite.yaml
├── concept-assertion-context.concept
├── widget-assertion-context.concept
├── view-assertion-context.concept
├── sync-assertion-context.concept
└── derived-assertion-context.concept

repertoire/concepts/test-plan-renderers/       (INV-3 — NEW suite)
├── suite.yaml
├── react-renderer.concept
├── playwright-renderer.concept
├── vue-renderer.concept                       (INV-12)
├── svelte-renderer.concept                    (INV-12)
├── swiftui-renderer.concept                   (INV-12)
└── jetpack-renderer.concept                   (INV-12)

handlers/ts/repertoire/testing/                (handlers for the suite)
handlers/ts/repertoire/assertion-contexts/
handlers/ts/repertoire/test-plan-renderers/
```

Apps (clef-base, future Clef apps) get the pipeline by including
the testing suite in their suite manifest. No app-level seeding
required.

## Execution plan (follow-up, not in this session)

Every step is itself a Clef concept spec + handler + sync wiring.
No new TS orchestration; even the CLI is a dispatcher.

1. **Concept specs + handlers land first** (no grammar change yet):
   `InvariantParser`, `TestPlan`, `TestArtifact`. Plus four syncs:
   `ExtractInvariantsOnParse`, `BuildTestPlanOnInvariantParse`,
   `RenderForEachRegisteredPlatform`, `WriteArtifactOnRender`.
   Plus derived concept `TestGeneration` composing all of them.
   **`AssertionContext` and `TestPlanRenderer` are NOT new concepts
   — they ride on existing `PluginRegistry` (plugin types
   `"assertion-context"` and `"test-plan-renderer"`).** Use
   `/create-concept`, `/create-sync`, `/create-derived-concept`.

2. **Seed initial assertion-context plugins** via
   `PluginRegistry/register` — one row each for concept, widget,
   view, sync, derived. Declared symbols mined from the existing
   parsers' symbol tables.

3. **Seed initial test-plan-renderer plugins** for React +
   Playwright. Vue / Svelte / Vanilla / SwiftUI / Jetpack land as
   follow-up seeds.

4. **Migrate current parsers** (concept-parser, widget-spec-parser,
   view-spec-parser, sync-parser, derived-parser) to call
   `InvariantParser/parse` with the matching assertion-context
   plugin. All five spec kinds parse invariants through one path.

5. **`scenario` kind** added to `InvariantParser`. Lands in every
   spec kind simultaneously.

6. **Replace `scripts/generate-*.ts` with thin dispatchers** that
   call `TestGeneration/run`. Real work moves into the concept
   pipeline.

7. **Retrofit existing invariants** on concept + widget specs
   (the current backlog), then add meaningful invariants to
   dispatch syncs (InvokeViaBinding, ExecuteReversal,
   automation-dispatch), cross-component view specs, and
   high-value derived concepts (ContentFoundation,
   InfrastructureCore, ProcessPlatform). Each addition flows
   through the same concept pipeline, producing real tests on
   every registered platform.

8. **Score + Pilot integration**. Because every pipeline step is
   a concept action, `ScoreApi/getFlow --from TestGeneration/run`
   traces spec → invariants → plans → rendered code → written
   artifacts without extra instrumentation. Failures surface as
   completion variants (e.g., `TestPlanRenderer/render` ok vs
   unsupportedProbe), which is queryable through the same API.

9. **Per-platform translation tables** (Vue / Svelte / Vanilla /
   SwiftUI / Jetpack) land as each platform needs enforcement.
   `TestPlanRenderer/register` + seed + done — no spec changes.

10. **Propagate the grammar update through every reference
    surface.** Missing any of these turns generated tests and AI
    authoring helpers silently out of date.

    **Generated from `examples/devtools/devtools.interface.yaml`
    → regenerate via `scripts/regen-interface.ts`:**
    - `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` (project instructions;
      currently describe "six invariant constructs" — becomes seven
      with `scenario`, plus the note that the same grammar lands on
      widget/view/sync/derived)
    - `.claude/agents/*.md`, `.codex/agents/*.md`,
      `.gemini/agents/*.md` — concept-scaffold-gen,
      handler-scaffold-gen, sync-scaffold-gen,
      surface-component-scaffold-gen, etc. need the new kind and
      the cross-spec story
    - `.claude/mcp/*` and `.codex/mcp/*` (tool help text for
      TestGen, SpecParser, WidgetParser, SyncParser — all gain
      `scenario` support, all flow through `InvariantParser`)
    - `.claude/skills/*/SKILL.md` and the sibling
      `.codex/skills/*/SKILL.md` / `.gemini/skills/*/SKILL.md`
      (auto-generated with a `<!-- Auto-generated -->` header;
      don't hand-edit those)
    - `cli/src/*` (commands + help) — `clef generate-tests`,
      `clef parse`, etc.

    **Manifest text inside `examples/devtools/devtools.interface.yaml`:**
    - `project-instructions` section (lines ~2766 ff.) describing
      the six invariant constructs — update to seven + the
      AssertionContext-plugin pattern
    - `agents` section prompts (concept-scaffold-gen and
      sync-scaffold-gen get the new authoring story)
    - `skills` sections that reference invariant authoring rules
      (lines ~2820, ~2924)
    - Help text for MCP tools (TestGen/generate, TestGen/coverage,
      SpecParser/parse, SyncCompiler/compile — every one touching
      invariants)

    **Hand-authored files (no auto-gen header — must edit by hand):**
    - `.claude/skills/create-concept/references/concept-grammar.md`
    - `.claude/skills/create-widget/references/widget-grammar.md`
    - Sibling copies in `.codex/skills/…` and `.gemini/skills/…`
      if those exist under the same path
    - `docs/plans/clef-fv.md` Section 1 (referenced by the
      devtools manifest; currently lists the six invariant
      constructs — add `scenario`, note the shared-parser pattern)

    **Documentation gap to close** — the concept-with-`register`
    action + sync-to-`PluginRegistry` idiom is the canonical
    extensibility pattern (see `syncs/execution/register-instance-providers.sync`,
    `syncs/framework/register-framework-generators.sync` for
    existing examples). Today it appears in
    `.claude/skills/custom-transform-provider/`,
    `infrastructure-core/`, `interface-scaffold-gen/`,
    `storage-adapter-scaffold-gen/`, `derived-scaffold-gen/`,
    `surface-component-scaffold-gen/`, `handler-scaffold-gen/`,
    `sync-scaffold-gen/`, `suite-scaffold-gen/`,
    `deploy-scaffold-gen/` — but **NOT** in the foundational
    `create-concept` or `create-sync` skills where authors would
    first encounter it. Both should grow a "Plugin pattern:
    register-action + sync-to-PluginRegistry" reference, with the
    same text living in `.codex/` and `.gemini/` siblings and the
    project-instructions section of `examples/devtools/devtools.interface.yaml`.
    Without this, every new plugin author has to reverse-engineer
    the idiom from existing syncs.

    **New reference docs to author:**
    - `references/sync-grammar.md` (`sync-parser` skill) — gains an
      invariant section
    - `references/derived-grammar.md` — same (already exists per
      line 7991 of the manifest; extend)
    - `references/view-grammar.md` — extend the existing invariant
      section with the cross-component-consistency examples

    **Regen command** (already in CLAUDE.md):
    ```
    npx tsx --tsconfig tsconfig.json scripts/regen-interface.ts
    ```

    Ship the parser + concept-pipeline changes first; then the
    regen + hand edits can land in a single "update all grammar
    references" commit. Verify by searching for "six invariant
    constructs" — every hit is either updated or deleted.

## Handlers-as-values test generation (MAG-920, INV-16)

ExternalHandlerGen and StorageProgram share a deeper pattern:
**handlers can be values, not code**. An ExternalHandler manifest IS a
frozen handler — the code is synthesized by walking declared HTTP
effects + FieldTransforms. A StorageProgram IS also a frozen handler
— the code is executed by an interpreter walking declared storage
instructions. Both are inspectable descriptions; both could feed the
same test generator.

This card extends the TestPlan IR (MAG-905) to accept three input
shapes, not just scenario invariants:

1. **Scenario invariants** (already supported, MAG-912).
2. **StorageProgram descriptions** — extracted via the existing
   `read-write-set-provider` and `transport-effect-provider` in the
   monadic suite. For any functional handler, walk its program to
   generate assertions that the handler reads/writes exactly the
   declared relations and performs exactly the declared transport
   effects.
3. **ExternalHandler manifests** — each action's declared HTTP
   method/path/auth/FieldTransform is a manifest of expected effects.

Four new renderer/generator outputs emerge:

- **Mock handler variant**: given a manifest or program, emit a
  handler implementation that returns canned responses shaped by
  FieldTransform/lens mappings instead of `perform('http', ...)` or
  real storage writes. Upstream tests of concepts that call an
  external concept get contract-matching stubs for free.
- **Record/replay handler variant**: generate a handler that on
  first run records real HTTP responses keyed by the
  FieldTransform-shaped request, then replays them thereafter.
  VCR-style, typed against the manifest. Integration tests become
  fast and deterministic without losing fidelity.
- **Effect-contract tests**: walk the program/manifest to emit a
  test that asserts the handler actually performed the declared
  effects and ONLY those. Catches regressions where a handler
  silently adds a write or drops an HTTP call.
- **FieldTransform-fuzzed tests**: FieldTransform is a typed
  request shape. Feed it to a property generator, synthesize
  malformed inputs, verify each maps to the right error variant.
  Property-based testing without writing property predicates.

Dependency: benefits from but doesn't require MAG-918. The mock/
replay generators should live alongside the existing renderer
plugins in `repertoire/concepts/test-plan-renderers/` and
self-register via the MAG-907 sync pattern.
