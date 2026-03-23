# Widget Specification Grammar Reference

Complete grammar for `.widget` files parsed by the Clef widget spec parser (`handlers/ts/framework/widget-spec-parser.ts`).

## Top-Level Structure

```
[@version(N)]
widget <name> {
  <section>*
}
```

- `@version(N)` -- Optional version annotation. Currently `@version(1)`.
- `<name>` -- Kebab-case widget identifier (e.g., `dialog`, `data-table`, `command-palette`).
- Sections may appear in any order but the conventional order is: purpose, requires, anatomy, slots, states, accessibility, props, connect, affordance, compose, invariant.

## Comments

```
# Line comment (hash style)
// Line comment (C style)
```

Both styles are supported. Comments run to end of line.

## Sections

### purpose

```
purpose {
  <prose text>
}
```

Free-form prose describing the widget's function. The brace-delimited content is captured as a single trimmed string with normalized whitespace.

### requires

```
requires @<priority> {
  fields {
    <fieldName>: <Type>;
    ...
  }
  actions {
    <actionName>(<params>);
    ...
  }
}
```

Declares concept-level fields and actions the widget depends on. The `@N` annotation is a priority level (integer). This section is optional.

**Field types:** `String`, `Int`, `Bool`, `list`, or any identifier.

### anatomy

```
anatomy {
  <partName>: <role> { <description> }
  ...
}
```

Declares the widget's structural parts.

- `<partName>` -- camelCase identifier (e.g., `root`, `trigger`, `closeTrigger`, `headerCell`).
- `<role>` -- One of: `container`, `text`, `action`, `overlay`, `interactive`, `presentation`, `widget`, or any custom identifier.
- `{ <description> }` -- Brace-delimited prose description of the part's purpose.

### slots

```
slots {
  <slotName> { <placement description> }
  ...
}
```

Named insertion points for consumer-provided content. Placement descriptions use phrases like `before <part>`, `after <part>`, `end of <part>`.

### states

States support two forms: flat (single machine) and grouped (multiple parallel machines).

**Flat form:**

```
states {
  <stateName> [initial] {
    on <EVENT> -> <targetState>;
    entry [<action1>; <action2>];
    exit [<action3>];
  }
  ...
}
```

**Grouped form:**

```
states {
  <machineName> {
    <stateName> [initial] {
      on <EVENT> -> <targetState>;
      entry [<action1>];
      exit [<action2>];
    }
    ...
  }

  <machineName> [parallel] {
    <stateName> [initial] { ... }
    ...
  }
}
```

**State elements:**

| Element | Syntax | Notes |
|---------|--------|-------|
| Initial marker | `[initial]` | Exactly one per machine |
| Transition | `on EVENT -> target;` | EVENT is UPPER_CASE |
| Entry actions | `entry [action1; action2];` | camelCase action names |
| Exit actions | `exit [action1];` | camelCase action names |
| Parallel marker | `[parallel]` | On the machine group name |

**Event naming conventions:**
- `OPEN`, `CLOSE`, `TOGGLE` -- Visibility changes
- `SELECT`, `DESELECT` -- Selection changes
- `FOCUS`, `BLUR` -- Focus changes
- `ESCAPE` -- Escape key
- `NAVIGATE_NEXT`, `NAVIGATE_PREV` -- Arrow key navigation
- `POINTER_ENTER`, `POINTER_LEAVE` -- Hover
- Custom domain events in UPPER_SNAKE_CASE

### accessibility

```
accessibility {
  role: <ariaRole>;
  modal: <bool>;

  keyboard {
    <Key> -> <EVENT>;
    ...
  }

  focus {
    trap: <bool>;
    initial: <partName>;
    roving: <bool>;
    returnOnClose: <partOrBool>;
  }

  aria {
    <partName> -> {
      <aria-attr>: <value>;
      ...
    };
    ...
  }
}
```

**Sub-sections:**

| Sub-section | Purpose |
|-------------|---------|
| `role` | Primary WAI-ARIA role for the widget |
| `modal` | Whether the widget is modal (blocks background interaction) |
| `keyboard` | Key-to-event mappings. Keys: `Escape`, `Tab`, `Enter`, `Space`, `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Home`, `End`, `PageUp`, `PageDown`. Modifiers: `Meta+k`, `Control+k`, `Shift+Tab` |
| `focus` | Focus management strategy. `trap` enables focus trapping, `initial` names the part to focus on open, `roving` enables roving tabindex, `returnOnClose` names where focus returns |
| `aria` | Per-part ARIA attribute mappings. Values can reference state (`state.machineName`), props (`?prop`), parts, or use conditional expressions |

**Simple aria form (shorthand):**

```
aria {
  labelledby: title;
  describedby: description;
}
```

**Structured aria form (per-part):**

```
aria {
  trigger -> {
    role: "button";
    aria-expanded: if state.openClose == "open" then "true" else "false";
    aria-controls: content;
  };
  content -> {
    role: "region";
    aria-labelledby: trigger;
  };
}
```

### props

```
props {
  <propName>: <Type> [= <default>]
  <propName>: <Type> (<modifiers>)
  ...
}
```

**Type syntax:**

| Type | Example |
|------|---------|
| `Bool` | `disabled: Bool = false` |
| `String` | `label: String` |
| `Int` | `openDelay: Int = 700` |
| `option <Type>` | `value: option String` |
| `set <Type>` | `value: set String` |
| `list <Type>` | `columns: list ColumnDef` |
| `list { ... }` | `options: list { label: String, value: String }` |
| `union "a" \| "b"` | `variant: union "solid" \| "outline" = "solid"` |
| `"a" \| "b"` | `role: "dialog" \| "alertdialog" = "dialog"` |

**Default values:** Use `= <value>` after the type. Alternatively, use `(default: <value>)` in parentheses.

Props without defaults are required. Props with `option` type are inherently optional.

### connect

```
connect {
  <partName> -> {
    <attribute>: <expression>;
    ...
  }
  ...
}
```

Maps anatomy parts to runtime attributes. Each part gets a block of attribute-expression pairs.

**Expression syntax:**

| Expression | Meaning |
|-----------|---------|
| `"string literal"` | Static string value |
| `true` / `false` | Boolean literal |
| `?propName` | Reference a prop |
| `state.machineName` | Current state value |
| `send(EVENT)` | Dispatch state event |
| `send(EVENT, { key: value })` | Dispatch with payload |
| `noop` | No-op handler |
| `self.property` | Current part's own data |
| `if cond then a else b` | Conditional |
| `?cond ? "a" : "b"` | Ternary shorthand |
| `labelOf(value, list)` | Lookup helper |
| `partName` | Reference another part (for `aria-controls`, `aria-labelledby`, etc.) |

**Common attributes:**

| Attribute | Purpose |
|-----------|---------|
| `role` | ARIA role override |
| `aria-*` | ARIA attributes |
| `data-state` | State machine reflection for CSS |
| `data-*` | Custom data attributes for styling |
| `onClick` | Click handler |
| `onKeyDown` | Keyboard handler |
| `onKeyDown-<Key>` | Key-specific handler |
| `onFocus` / `onBlur` | Focus handlers |
| `onPointerEnter` / `onPointerLeave` | Hover handlers |
| `onInput` | Input change handler |
| `hidden` | Visibility toggle |
| `disabled` | Disabled state |
| `tabindex` | Tab order |
| `text` / `textContent` | Text content |
| `visible` | Visibility (boolean) |
| `autofocus` | Auto-focus on mount |
| `placeholder` | Placeholder text |
| `id` | Element ID (for ARIA references) |
| `for` | Label association |

### affordance

```
affordance {
  serves: <purpose>;
  specificity: <int>;
  when { <condition>: <value>; ... }
  fallback: <bool>;
  bind {
    <field>: <source>;
    ...
  }
}
```

All sub-properties are optional except `serves`.

| Property | Type | Purpose |
|----------|------|---------|
| `serves` | identifier | Abstract UI purpose this widget fulfills |
| `specificity` | integer 1-10 | Selection priority (higher wins) |
| `when` | block | Conditions for automatic selection |
| `fallback` | boolean | Whether this is the fallback widget for its purpose |
| `bind` | block | Maps widget fields to concept state sources |

**Common `serves` values:** `overlay`, `single-choice`, `multi-choice`, `group-repeating`, `navigation`, `group-section`, `text-input`, `toggle`, `action`.

### compose

```
compose {
  <partOrAlias>: widget("<widgetName>", { <prop>: <value>, ... })
  ...
}
```

Declares child widgets composed into this widget. Part names prefixed with `_` are internal infrastructure widgets. Named parts map to anatomy parts implemented by the child widget.

### invariant

```
invariant {
  "<assertion string>";
  ...
}
```

Or free-form prose assertions:

```
invariant {
  when ?multiple == false then at most one item has state "expanded";
  exactly one trigger has aria-selected "true" at all times;
}
```

Invariant strings describe behavioral contracts that must hold regardless of rendering framework. They reference anatomy parts, state machine states, and prop values.

## Identifier Conventions

| Context | Convention | Examples |
|---------|-----------|---------|
| Widget name | kebab-case | `dialog`, `data-table`, `command-palette` |
| Part name | camelCase | `root`, `closeTrigger`, `headerCell` |
| State name | camelCase | `closed`, `open`, `cellFocused` |
| Event name | UPPER_SNAKE_CASE | `OPEN`, `CLOSE`, `NAVIGATE_NEXT` |
| Entry/exit action | camelCase | `trapFocus`, `positionContent` |
| Prop name | camelCase | `closeOnEscape`, `sortDirection` |
| Machine group name | camelCase | `visibility`, `openClose`, `focus` |

## Token Types

The tokenizer recognizes:
- Keywords: `widget`, `purpose`, `requires`, `anatomy`, `states`, `accessibility`, `affordance`, `props`, `connect`, `compose`, `invariant`, `on`, `entry`, `exit`, `role`, `keyboard`, `focus`, `aria`, `serves`, `specificity`, `when`, `bind`, `true`, `false`, `initial`, `container`, `text`, `presentation`, `interactive`, `fields`, `actions`
- Identifiers: Any `[a-zA-Z_][\w-]*` sequence not in the keyword list
- String literals: `"..."` or `'...'` with backslash escaping
- Integer literals: `[0-9]+`
- Boolean literals: `true`, `false`
- Symbols: `{`, `}`, `[`, `]`, `(`, `)`, `:`, `,`, `;`, `@`, `->`
