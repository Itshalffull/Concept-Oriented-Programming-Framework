# Widget Grammar — Invariants and Test Generation

This document covers the **invariant grammar** inside `.widget` files.
Widget invariants share the universal invariant grammar with `.concept`,
`.view`, `.sync`, and `.derived` specs; see `docs/concept-grammar.md` for
the complete grammar and EBNF. This page focuses on the widget-specific
resolution rules.

The grammar is parsed by `handlers/ts/framework/invariant-body-parser.ts`
and resolved by the widget `AssertionContext` plugin — identifiers are
looked up against **anatomy parts**, **FSM states**, and **prop names**
declared in the widget spec.

## Where invariants appear

A widget file has exactly one `invariant { … }` block (singular,
repeatable in practice — multiple blocks concatenate) containing any of
the seven kinds: `example`, `forall`, `always`, `never`, `eventually`,
`action … { requires/ensures }`, and `scenario`.

Prose string literals inside the block are accepted as documentation
only — they do **not** generate tests.

## Identifier resolution

| Identifier | Resolves to |
|---|---|
| bare event name, e.g. `render`, `click` | event dispatched on the widget root |
| `<part>.<method>` | method invoked on an anatomy part (canonical methods: `type`, `focus`, `blur`, `click`, `press`, `selectRange`) |
| `<part>` on an assertion LHS | the anatomy part's data attribute/ARIA map |
| `state.<field>` | an FSM state variable |
| positional literal in `part.method("x")` | positional arg synthesized to `_0`, `_1`, … |

## Seven kinds — widget flavour

```
invariant {
  # 1. example — concrete before/after scenario
  example "typing preserves key order" {
    after render(readOnly: false) -> ok
    and body.focus() -> ok
    and body.type("h") -> ok
    and body.type("i") -> ok
    then body.textContent = "hi"
  }

  # 2. forall — quantified scenario
  forall "all variants render" {
    given variant in {"primary", "secondary", "ghost"}
    after render(variant: variant) -> ok
    then root -> { data-variant: variant }
  }

  # 3. always — FSM invariant (with optional forall quantifier)
  always "focus trap never escapes" {
    forall p in states:
      p.focusWithin = true
  }

  # 4. never — safety property
  never "disabled button fires click" {
    exists s in states where s.disabled = true:
      s.events contains "click"
  }

  # 5. eventually — bounded liveness
  eventually "loading resolves" {
    forall s in states where s.status = "loading":
      s.status in ["ok", "error"]
  }

  # 6. action contract — pre/postconditions on a part/event
  action saveButton {
    requires: state.lifecycle = "dirty"
    ensures ok: state.lifecycle = "saving"
  }

  # 7. scenario — multi-block behavioural test
  scenario "typing a character appends it to body" {
    fixture f1 { readOnly: false, initialText: "" }
    when {
      render(readOnly: false) -> ok
      and body.focus() -> ok
      and body.type("a") -> ok
    }
    then {
      body.textContent = "a"
    }
    settlement: sync
  }
}
```

## Settlement modalities

Widget scenarios most often use `sync`. Async modalities are available for
widgets that debounce, animate, or await network I/O:

```
scenario "typing debounces before save fires" {
  when { root.type("hello") -> ok }
  then { saveSpy.callCount > 0 }
  settlement: "async-eventually" { timeoutMs: 600 }
}
```

For transition tests anchored to concrete widget lifecycle events (e.g.,
`animationend`), use `"async-with-anchor" { anchor: "animationend" }`.

## Per-platform rendering

Each renderer translates widget-scenario steps to platform-native test
calls:

| Platform | Event dispatch | Assertion |
|---|---|---|
| React + Testing Library | `userEvent.type/focus/click` | `expect(screen.getByTestId(...))` |
| Playwright | `locator.pressSequentially / focus / click` | `expect(locator).toHaveText` |
| Vue + Testing Library | `userEvent.type` / `trigger("keydown")` | `expect(wrapper.text())` |
| Svelte + Testing Library | `userEvent.type` | `expect(screen.getByTestId(...))` |
| SwiftUI (XCUITest) | `XCUIElement.typeText / tap` | `XCTAssertEqual` |
| WinUI (UIAutomation) | `SendKeys` | `Assert.AreEqual` |

## Silent-drop protection

The single most common widget bug is a brace imbalance elsewhere in the
file (anatomy / states / props / connect / compose) that causes the
parser to silently skip the entire `invariant { … }` block. After
writing invariants, verify with:

```
npx tsx --tsconfig tsconfig.json -e "
  import { parseWidgetFile } from './handlers/ts/framework/widget-spec-parser';
  import fs from 'fs';
  const m:any = parseWidgetFile(fs.readFileSync('<YOUR .widget PATH>','utf8'));
  const counts:any = {};
  (m.invariants||[]).forEach((i:any)=>{counts[i.kind]=(counts[i.kind]||0)+1;});
  console.log('total:', (m.invariants||[]).length, 'by kind:', counts);
"
```

If the count is lower than what you wrote, fix the upstream brace
imbalance before shipping.

## References

- Universal parser: `handlers/ts/framework/invariant-body-parser.ts`
- Widget integration: `handlers/ts/framework/widget-spec-parser.ts`
- AST types: `runtime/types.ts`
- Per-platform renderers: `repertoire/concepts/test-plan-renderers/`
- Full grammar reference: `docs/concept-grammar.md`
