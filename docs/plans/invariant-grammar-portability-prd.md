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

## Unification story — concept, widget, view share one parser

The AST is already one thing. The parsers aren't. The cleanest
unification, before any platform renderer work, is:

### Shared `InvariantBodyParser` helper class

Extract the duplicated grammar logic into one helper that all three
spec parsers delegate to:

```ts
class InvariantBodyParser {
  constructor(
    private tokens: TokenStream,
    private ctx: AssertionContext,   // injected per spec kind
  ) {}
  parseInvariantBlock(): InvariantDecl[] { … }
  parseQuantifierBinding(): QuantifierBinding { … }
  parseWhenClause(): InvariantWhenClause { … }
  parseInvariantASTStep(): InvariantASTStep { … }
  parseAssertionExpr(): AssertionExpr { … }
}

interface AssertionContext {
  /** Resolve an identifier in the host spec's namespace. */
  resolveIdentifier(name: string):
    | { kind: 'action', concept: string, action: string }     // concept
    | { kind: 'part', part: string }                          // widget anatomy
    | { kind: 'state', field: string }                        // widget FSM / concept state
    | { kind: 'query-column', column: string }                // view
    | { kind: 'fixture', fixture: string }                    // scenario
    | undefined;
  /** Declared top-level names, for error messages and completion. */
  declaredSymbols(): string[];
}
```

Each spec parser (concept, widget, view) injects its own
`AssertionContext`. Concept resolves action + state names; widget
resolves anatomy parts + FSM fields; view resolves query-result
columns. ~500 lines of copy-paste evaporates.

### Extend invariants to sync and derived

Today neither `.sync` nor `.derived` has invariants. Both SHOULD.

- **Sync invariants** would assert post-conditions on sync firings:

  ```
  sync InvokeViaBinding [eager]
    when { ActionBinding/invoke: [ binding: ?b; context: ?ctx ] => ok(…) }
    where { ActionBinding: { ?b target: ?target } }
    then { Binding/invoke: [ binding: ?b; action: ?target; input: ?ctx ] }

    invariant {
      example "binding fires exactly once per invoke": {
        after ActionBinding/invoke(binding: "update-block") -> ok
        then fired(Binding/invoke) = 1
      }
      never "forwards to unresolved target": {
        event.targetResolved = false
        and event.bindingInvokeFired = true
      }
    }
  ```

- **Derived invariants** would assert emergent properties of the
  composition (e.g., that ClefBase's ContentFoundation really does
  route every ContentNode save through the SearchIndex):

  ```
  derived ContentPlatform composes ContentFoundation, ClassificationSystem, …
    invariant {
      always "every ContentNode save indexes in SearchIndex": {
        forall n in saved_content_nodes: n in SearchIndex.indexed
      }
    }
  ```

Both cases: same `InvariantDecl` AST, same parser helper, new
`AssertionContext` implementations (sync resolves when-clause
bindings and completion variants; derived resolves its composed
concepts' public actions + state fields).

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

All work is sequenced so nothing breaks grammar along the way.

1. **Extract `InvariantBodyParser` + `AssertionContext`.** Pure
   refactor of concept / widget / view parsers to delegate. Unit
   tests on each spec kind assert grammar behavior unchanged.

2. **`scenario` kind** added to the shared parser. Lands in all
   spec kinds simultaneously. Parse-only; no codegen yet.

3. **Enrich `InvariantDecl` consumers**: `WidgetTestAssertion` +
   concept-side `TestPlanExample` / `TestPlanForall` / etc. gain
   optional structured `fixtures` / `steps` / `observations` /
   `settlement` fields. Populated by the plan builders from the
   existing AST. Backward compatible.

4. **Unified codegen module** `test-plan-invariants.ts`. Takes
   enriched plan entries + target platform (react / playwright /
   vitest-node / etc.) + universal probe namespace table. Emits
   real assertions. Concepts, widgets, views all invoke it.

5. **Add invariants to sync + derived**. Parser extension, new
   `AssertionContext` implementations (sync: when-binding +
   completion variant names; derived: composed concepts' action +
   state names). No grammar change.

6. **Retrofit existing specs**: paragraph-block's 81, every
   concept spec, every view spec — start generating real tests.
   Add invariants to high-value syncs (the dispatch chain:
   InvokeViaBinding, PushUndoOnReversible, ExecuteReversal,
   TrackInvocationStart/Complete) and core derived concepts
   (ContentFoundation, LLMPlatform, ProcessPlatform).

7. **Per-platform translation tables** (Vue / Svelte / Vanilla /
   SwiftUI / Jetpack) land as each platform needs enforcement.
   Widget + concept + view + sync + derived specs never change
   when a new platform lands — that's the whole point.
