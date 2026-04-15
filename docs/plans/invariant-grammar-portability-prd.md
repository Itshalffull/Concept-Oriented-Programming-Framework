# Widget Invariant Grammar — Portable Conformance Contracts

## Problem statement

Widget invariants parse cleanly but produce stub tests. Every platform
renderer (React, Vue, Svelte, Vanilla) emits the same placeholder body:

```js
render(<Component />);
// Invariant 'X' must always hold
expect(screen.getByTestId('root')).toBeDefined();
```

Playwright skips invariants entirely. So when an author writes:

```
example "typing preserves key order": {
  after render(readOnly: false) -> ok
  and body.focus() -> ok
  and body.type("h") -> ok
  then body.textContent = "hi"
}
```

— the generated React test neither types "h" nor asserts
`textContent === "hi"`. It renders and checks the root is defined.

Consequence: authors write invariants as contract documentation but
they don't catch regressions. Adding a never-clause with a symbolic
predicate (`body.renderedDepth = "pre-tab"`) adds zero enforcement.

## What's missing for portability

Three layers need to line up:

1. **Identifier binding layer.** Expressions like `body.textContent`,
   `state.edit`, `event.kanbanReparentCompleted` are symbolic in the
   parser. They need a spec for how each platform translates them to
   real probes. Today only a handful of dot-accesses are implicitly
   assumed — no shared registry.

2. **Action execution layer.** `body.type("h")` currently becomes a
   comment. It needs to dispatch `userEvent.type(getByTestId('body'), 'h')`
   on React, `await page.locator('[data-part="body"]').pressSequentially('h')`
   on Playwright, `element.typeText("h")` on SwiftUI XCUITest.

3. **Multi-block / cross-component layer.** Current invariants target
   ONE widget render. Contracts like Tab-flicker-override or arrow
   navigation need multiple block fixtures + cross-block observations.
   No grammar kind expresses "widget A in state X, widget B in state Y,
   fire an event on B, assert a property on A".

## Proposal: three minimal extensions

### 1. Identifier registry — `bind` blocks

A widget spec declares how its symbolic identifiers resolve on each
platform. Example:

```
widget paragraph-block {
  ...
  probes {
    body.textContent    -> root.querySelector('[data-part="body"]').textContent
    body.dataDepth      -> root.getAttribute('data-depth')
    state.edit          -> root.getAttribute('data-state')
    body.focus()        -> body.focus()              # native
    body.type(text)     -> userEvent.type(body, text) @react
                        -> await body.pressSequentially(text) @playwright
                        -> body.typeText(text) @xcuitest
  }
}
```

`probes` is platform-aware: entries without `@platform` are universal,
`@react`, `@playwright`, `@xcuitest`, `@jetpack` override. Renderers
read this registry and emit real code for every `body.X` reference in
an example / always / never body.

### 2. `scenario` invariant kind

Multi-block behavioral contracts with explicit fixtures:

```
scenario "Shift+Tab places block after former parent": {
  given {
    blockA: paragraph-block { blockId: "A", depth: 0 }
    blockB: paragraph-block { blockId: "B", depth: 1, parent: "A" }
    blockC: paragraph-block { blockId: "C", depth: 2, parent: "B" }
    blockD: paragraph-block { blockId: "D", depth: 2, parent: "B" }
  }
  when {
    on blockD: body.focus() -> ok
    and body.shiftTabKey() -> ok
  }
  then {
    blockD.depth = 1
    and blockD.orderAfter = "B"      # D's Outline.order > B.order
    and blockD.orderBefore = "C"     # ... and < C.order if C exists after B
  }
}
```

Parser: new `scenario` keyword with `given { ... }` (fixture map),
`when { ... }` (action chain, each step scoped to a fixture), `then { ... }`
(assertion list with fixture-qualified identifiers).

AST: `{ kind: 'scenario', name, fixtures: Fixture[], whenSteps: Step[],
thenAssertions: Assertion[] }`.

### 3. Settlement operators

Time-aware assertions for optimistic / async state:

```
then {
  blockB.depth = 1 immediately    # first render after event
  and blockB.depth = 1 eventually # within test timeout
  and never event.depthFlashedBack within 500ms
}
```

Renderer translations:
- `immediately` → assertion runs right after `fireEvent`
- `eventually` → wrapped in `waitFor(...)` on React, `await expect(...).toBe(...)` with `{ timeout }` on Playwright
- `never ... within Xms` → sampling loop that fails if the bad state
  ever appears in the window (catches transient flash-back bugs)

## Scope of first cut

1. Extend parser + AST for `scenario` kind with `given / when / then`.
2. Define a minimal `probes` table: `body.<attr>`, `body.textContent`,
   `body.dataX`, `state.<field>`, universal across all platforms.
3. Ship React renderer that emits real `render / fireEvent / expect`
   for both `example` and `scenario`.
4. Playwright renderer: just `scenario` (stage fixtures in URL query,
   `page.goto`, dispatch events, assertion).
5. `eventually` / `never-within` modifiers added as optional postfix
   tokens on `then` assertions.

Other platforms (Vue, Svelte, Vanilla, XCUITest, Jetpack) remain stubs
until someone opts them in via the `probes` block.

## What this enables

The invariants I could not enforce earlier in this pass become
first-class tests:

```
scenario "Tab: optimistic depth must not flash back": {
  given {
    blockA: paragraph-block { blockId: "A", depth: 0 }
    blockB: paragraph-block { blockId: "B", depth: 0 }
  }
  when {
    on blockB: body.focus() -> ok
    and body.tabKey() -> ok
    and simulate.intermediateLoadChildren(staleDepth: 0)
  }
  then {
    blockB.depth = 1 immediately
    and never blockB.depth = 0 within 300ms
    and blockB.depth = 1 eventually
  }
}
```

```
scenario "ArrowUp traverses across sibling-group boundaries": {
  given {
    blockA: paragraph-block { blockId: "A", depth: 0 }
    blockA1: paragraph-block { blockId: "A.1", depth: 1, parent: "A" }
    blockB: paragraph-block { blockId: "B", depth: 0 }
  }
  when {
    on blockB: body.focus() -> ok
    and body.arrowUpKey() -> ok
  }
  then {
    document.activeElement = blockA1.body
  }
}
```

## Execution plan (follow-up, not in this session)

1. Parser + AST: 1 cornerstone PR — just the grammar, unit tests of
   `parseInvariant` over a handful of scenario fixtures.
2. `probes` table + shared translator: second PR, wires the identifier
   registry. React renderer upgrade to real assertions from example.
3. React `scenario` renderer: third PR, one worked test for paragraph-
   block's Tab-flicker scenario to prove the pipeline.
4. Playwright `scenario` renderer: fourth PR.
5. Opt-in per-platform probes in widget specs as needed.
