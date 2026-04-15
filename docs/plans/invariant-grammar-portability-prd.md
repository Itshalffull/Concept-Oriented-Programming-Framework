# Widget Invariant Grammar — Universal Contracts, Using The Existing IR

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

## Scope of first cut

1. **Parser**: add `scenario` kind, reuse existing parse helpers for
   `afterPatterns` / `thenPatterns`; introduce `fixtures` parsing.
2. **`buildWidgetTestPlan`**: map every invariant kind
   (example / forall / always / never / eventually / requires_ensures /
   scenario) to enriched `WidgetTestAssertion` with populated
   `fixtures` / `steps` / `observations`.
3. **React renderer**: consume the enriched fields. `example` → real
   vitest; `scenario` → multi-fixture mount + step dispatch + settlement-
   aware assertions. Falls back to the current stub when fields absent.
4. **Playwright renderer**: same enrichment consumption; emits
   `.spec.ts` files targeting the dev server.
5. **Retrofit existing invariants**: the 81 paragraph-block entries
   start generating real tests once `buildWidgetTestPlan` fills
   `steps` / `observations` from the already-parsed `afterPatterns` /
   `thenPatterns`.

Vue / Svelte / Vanilla / SwiftUI / Jetpack: remain stubs until
someone writes their translation table. Adding a platform is
additive.

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

1. Parser + AST: `scenario` kind, `fixtures / when / then` parsing.
   Unit tests over a handful of scenario fixtures. No renderer work.
2. `buildWidgetTestPlan` enrichment: populate new
   `fixtures / steps / observations` fields on `WidgetTestAssertion`
   for every kind, driven off the existing invariant AST. No renderer
   work yet; validate by inspecting emitted JSON plans.
3. React renderer: consume enriched fields, emit real vitest for one
   worked paragraph-block scenario. Ship the proof.
4. Playwright renderer: same for a `.spec.ts`.
5. Retrofit existing invariants: with the pipeline live, the 81
   paragraph-block entries start generating real assertions with no
   spec changes required.
6. Vue / Svelte / Vanilla / SwiftUI / Jetpack translation tables as
   platforms need them.
