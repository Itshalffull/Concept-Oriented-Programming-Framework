# Widget Invariant Grammar — Universal Contracts, Universal Test Plan

## Problem statement

Widget invariants parse cleanly but produce stub tests. Every platform
renderer (React, Vue, Svelte, Vanilla) emits the same placeholder body:

```js
render(<Component />);
// Invariant 'X' must always hold
expect(screen.getByTestId('root')).toBeDefined();
```

Playwright skips invariants entirely. So when an author writes

```
example "typing preserves key order": {
  after body.focus() -> ok
  and body.type("h") -> ok
  then body.textContent = "hi"
}
```

— the generated test neither types "h" nor asserts `textContent ===
"hi"`. ~70 of paragraph-block's 81 invariants are symbolic
documentation, not enforced contracts.

## The right layering

```
┌──────────────────────────────┐
│ Widget Invariants (universal)│   body.type("h"), state.edit = "x",
│ *.widget files               │   block("A").depth, etc.
└────────────┬─────────────────┘
             │ parser
             ▼
┌──────────────────────────────┐
│ Test Plan IR  (universal)    │   { mount, actions, observations }
│ JSON-ish, platform-agnostic  │   — no React, Playwright, … leakage
└──────────────┬───────────────┘
               │ one renderer per platform
               ▼
  ┌────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐
  │ React  │ │Playwright│ │ SwiftUI   │ │ Jetpack  │ …
  │vitest  │ │ tests    │ │ XCUITest  │ │ Compose  │
  └────────┘ └──────────┘ └───────────┘ └──────────┘
```

Per-widget `probes` blocks (the earlier proposal) were wrong: they
pushed platform concerns into every widget spec. The right split is:

- **Invariants stay universal.** Authors write `body.type("h")`,
  `state.edit = "focused"`, `block("A").depth = 1`. One namespace.
- **The test plan is universal.** An intermediate JSON representation
  says "mount these fixtures, run these actions, assert these
  observations". Nothing platform-specific.
- **Renderers translate the universal namespace once, not per widget.**
  React's renderer knows `body.type("h")` → `userEvent.type(body, 'h')`
  for EVERY widget. Playwright's renderer knows it →
  `await page.locator('[data-part="body"]').pressSequentially('h')`.

That's the whole shape.

## The universal namespace

Identifiers an invariant can use:

### Targets
- `root` — the widget's outer element (carries `data-part="root"`).
- `body`, `trigger`, `icon`, ... — any anatomy part declared in the widget.
- `block("id")` — fixture-mounted block with given `data-block-id`.
- `document` — top-level (`document.activeElement`, `document.body`).

### Observations (readable)
- `<target>.textContent`
- `<target>.innerHTML`
- `<target>.contentEditable` / `.readOnly` / `.disabled`
- `<target>.dataX` — any `data-x` attribute (camelCase → dash)
- `<target>.ariaX` — any `aria-x` attribute
- `<target>.hasClass("name")`, `.visible`, `.focused`, `.selected`
- `<target>.childCount`, `.depth` (derived from `data-depth`)
- `state.<field>` — FSM state slot, persisted as `data-state-<field>` on root
- `document.activeElement = <target>` — which element has focus

### Actions (writable / dispatchable)
- `<target>.focus()`, `<target>.blur()`, `<target>.click()`
- `<target>.type("text")` — sequential keystrokes that fire native events
- `<target>.press("Tab" | "Enter" | "ArrowUp" | …)`
- `<target>.dragTo(<target>)`
- `<target>.paste("text")` / `<target>.paste(clipboard: "image")`
- `simulate.intermediateReload()` / `simulate.wait(Xms)` — timing knobs
- Custom renderer-extensible ones via `ext.<name>(args)`

Everything is grounded in stable `data-part`, `data-block-id`, and
ARIA roles that widgets already emit — no per-widget mapping.

## Test Plan IR

Each invariant compiles to one test plan:

```json
{
  "name": "Shift+Tab places block after former parent",
  "kind": "scenario",
  "fixtures": [
    { "id": "blockA", "component": "paragraph-block",
      "props": { "blockId": "A", "depth": 0 } },
    { "id": "blockB", "component": "paragraph-block",
      "props": { "blockId": "B", "depth": 1, "parent": "A" } },
    { "id": "blockD", "component": "paragraph-block",
      "props": { "blockId": "D", "depth": 2, "parent": "B" } }
  ],
  "steps": [
    { "on": "blockD", "action": "focus" },
    { "on": "blockD", "action": "press", "key": "Shift+Tab" }
  ],
  "observations": [
    { "modality": "immediately",
      "probe": "block.depth", "on": "blockD", "expected": 1 },
    { "modality": "eventually",
      "probe": "block.orderAfter", "on": "blockD", "other": "blockB",
      "expected": true },
    { "modality": "never-within",
      "ms": 300,
      "probe": "block.depth", "on": "blockD", "disallowed": 2 }
  ]
}
```

This IR is what every platform renderer consumes. Adding a new
platform is "write one renderer that walks this structure", not "touch
every widget spec".

## The scenario kind

```
scenario "Tab: optimistic depth must not flash back": {
  given {
    blockA: paragraph-block { blockId: "A", depth: 0 }
    blockB: paragraph-block { blockId: "B", depth: 0 }
  }
  when {
    on blockB: body.focus() -> ok
    and body.press("Tab") -> ok
    and simulate.intermediateReload()       # stale server walk
  }
  then {
    block("B").depth = 1 immediately
    and never block("B").depth = 0 within 300ms
    and block("B").depth = 1 eventually
  }
}
```

## Renderer contract

Each platform renderer implements:

```ts
interface PlatformRenderer {
  name: 'react' | 'playwright' | 'vue' | 'swiftui' | …;
  renderTestPlan(plan: TestPlanIR): string; // emitted test file
  probes: {
    read(on: Target, probe: string): string;   // code that reads a value
    act(on: Target, action: string, args): string;  // code that fires an action
    wait(modality: 'immediately' | 'eventually' | { neverWithin: number }, assertion: string): string;
  };
}
```

Renderer code is a TABLE. `body.type("h")` goes into one function per
platform, once. Widgets reference universal identifiers and stay
unchanged across platforms.

## First cut

1. Parser + AST: add `scenario` kind with `given / when / then`.
2. Compiler: `AST → TestPlanIR` (pure data).
3. React renderer: consume TestPlanIR → vitest + React Testing Library.
4. Playwright renderer: consume TestPlanIR → Playwright test file.
5. Fix the existing `example` rendering gap by routing it through the
   same compile-to-IR path — every `example` becomes a 1-fixture,
   N-step, M-observation plan, so the same renderer handles both kinds.

Other platforms (Vue, Svelte, SwiftUI, Jetpack) remain stubs until
someone authors a renderer. No widget spec changes when a new platform
renderer lands — that's the whole point.

## What this enables

The invariants I couldn't enforce in this pass become first-class
generated tests:

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

Compiles to a test plan. React renderer emits a real vitest + RTL
test that stages three BlockSlot components, focuses B, fires
`ArrowUp`, asserts `document.activeElement` is the A.1 body.
Playwright renderer emits an equivalent page-level test. Zero
platform-specific knowledge in the widget spec.

## Execution plan (follow-up, not in this session)

1. Parser + AST for `scenario` + settlement modifiers. Pure
   grammar-level PR, lots of small cases, no renderer work.
2. `AST → TestPlanIR` compiler. Lives in
   `handlers/ts/framework/test/compile-plan.ts`. Unit tests over the
   grammar fixtures.
3. React renderer: `renderReactTestPlan(plan): string`. Ship one
   worked paragraph-block scenario test proving the whole pipeline.
4. Playwright renderer: same interface, different emission target.
5. Retrofit `example` and `always` / `never` to compile-through the
   IR so the existing 81 paragraph-block invariants start generating
   real code.
6. Add renderers for Vue / Svelte / SwiftUI / Jetpack as the
   platforms need them. The widget grammar is done.
