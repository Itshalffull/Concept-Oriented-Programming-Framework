---
name: create-widget
description: Design and create a new Clef Surface widget specification (.widget file). Defines the anatomy, states, accessibility, affordances, and composition of a UI component in a framework-agnostic way.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<widget-name> [--category feedback|navigation|form-controls|data-display|complex-inputs|composites|domain]"
---

# Create a New Clef Widget Specification

Design and implement a new widget specification named **$ARGUMENTS** for the Clef Surface system.

Widget specs are framework-agnostic declarations of UI component behavior. They describe *what* a widget is (anatomy, states, accessibility, affordances) without prescribing *how* it renders. Code generators consume these specs to produce React, Svelte, Vue, or native components.

## Core Design Principles (Always Apply)

1. **Anatomy-First** -- Every widget is a tree of named parts with semantic roles. The anatomy defines the component's structural contract independent of any visual framework.
2. **State Machine Driven** -- All interactive behavior is expressed as explicit state machines with named states, events, and transitions. No implicit or hidden state.
3. **Accessibility by Default** -- Every widget declares its ARIA role, keyboard interactions, and focus management strategy. Accessibility is structural, not bolted on.
4. **Affordance Binding** -- Widgets declare what concept-level purpose they serve and how they bind to concept state, enabling automatic widget selection by the Surface system.

## Step-by-Step Design Process

### Step 1: Articulate the Purpose

The purpose block is a concise prose description of what this widget does and why it exists. Write 2-4 sentences covering:

- What the widget presents or enables
- Key interaction patterns it supports
- Any important behavioral constraints

**Purpose quality checklist:**
- [ ] Describes the widget's function from the user's perspective
- [ ] Mentions the primary interaction model (click, drag, keyboard, etc.)
- [ ] Calls out important behavioral properties (modal, collapsible, sortable, etc.)
- [ ] Does NOT describe visual appearance (colors, sizes, fonts)

**Good purpose examples:**

| Widget | Purpose |
|--------|---------|
| dialog | "Modal overlay that captures focus and blocks interaction with the underlying page until dismissed." |
| tooltip | "Lightweight floating label that provides supplementary descriptive text when the user hovers over or focuses a trigger element." |
| data-table | "Sortable, filterable data table with configurable columns, row selection, and pagination." |
| accordion | "Vertically stacked set of collapsible sections where each section has a trigger heading and expandable content panel." |

### Step 2: Define the Anatomy

The anatomy declares every named part of the widget as a tree of parts with semantic roles. Each part gets a role and a brace-delimited description.

Read [references/anatomy-patterns.md](references/anatomy-patterns.md) for common anatomy patterns across widget categories.

**Available roles:**

| Role | Meaning | Examples |
|------|---------|---------|
| `container` | Structural wrapper, groups other parts | root, content, positioner, list, group |
| `text` | Displays text content | title, description, label, groupLabel |
| `action` | Interactive element the user can activate | trigger, item, closeTrigger, headerCell |
| `overlay` | Covers the viewport behind the widget | backdrop |
| `interactive` | Accepts user input | input (search fields, text areas) |
| `presentation` | Decorative, not semantically meaningful | indicator, arrow, separator |
| `widget` | Slot for a composed child widget | pagination |

**Anatomy design rules:**

1. **Always have a `root` part** -- Every widget starts with `root: container`.
2. **Name parts by function, not appearance** -- Use `indicator` not `chevronIcon`, use `trigger` not `blueButton`.
3. **Include descriptions** -- Every part gets a `{ description }` block explaining its role in the widget.
4. **Flat when possible** -- Prefer flat part lists over deep nesting. The connect block handles parent-child relationships.
5. **Separate text from containers** -- If a container has a label, make the label a separate `text` part so it can be independently styled and referenced by ARIA.

```
anatomy {
  root:        container  { Top-level wrapper }
  trigger:     action     { Button that opens the dropdown }
  content:     container  { Panel holding the expanded content }
  title:       text       { Heading labelling the content }
  indicator:   container  { Visual caret showing open/closed state }
}
```

### Step 3: Define Slots (If Needed)

Slots declare named insertion points where consumers can inject custom content. Use slots when the widget needs to accept arbitrary children in specific locations.

```
slots {
  header { before title }
  body   { after description }
  footer { end of content }
}
```

Most simple widgets do not need slots. Use slots when:
- The widget is a layout container (dialog, drawer, card)
- Consumers need to inject domain-specific content at specific structural positions
- The widget composes around user-provided children

### Step 4: Design the State Machine

States define all interactive behavior as explicit finite state machines. Each state declares its transitions (event -> target), entry actions, and exit actions.

**State machine design rules:**

1. **Mark exactly one state as `[initial]`** per machine.
2. **Name states by condition, not by transition** -- Use `open`/`closed`, not `opening`/`afterClick`.
3. **Events are UPPER_CASE** -- `OPEN`, `CLOSE`, `SELECT`, `TOGGLE`, `ESCAPE`.
4. **Entry/exit actions are camelCase** -- `trapFocus`, `preventScroll`, `positionContent`.
5. **Keep machines small** -- 2-5 states per machine. If you need more, split into parallel machines.

**Parallel state machines:** When a widget has independent behavioral dimensions, use named state machine groups:

```
states {
  // Named group for open/close behavior
  visibility {
    closed [initial] {
      on OPEN -> open;
    }
    open {
      on CLOSE -> closed;
      entry [trapFocus];
      exit [releaseFocus];
    }
  }

  // Independent parallel group for focus tracking
  focus [parallel] {
    idle [initial] {
      on FOCUS -> focused;
    }
    focused {
      on BLUR -> idle;
    }
  }
}
```

**Simple (flat) state machines:** When the widget has a single behavioral dimension, states can be listed directly without a named group:

```
states {
  hidden [initial] {
    on POINTER_ENTER -> showing;
    on FOCUS -> showing;
  }
  showing {
    on DELAY_ELAPSED -> visible;
    on POINTER_LEAVE -> hidden;
    entry [startOpenDelay];
    exit [cancelOpenDelay];
  }
  visible {
    on POINTER_LEAVE -> hiding;
    on ESCAPE -> hidden;
  }
}
```

**Common state patterns:**

| Pattern | States | Use For |
|---------|--------|---------|
| Toggle | `closed` / `open` | Dialogs, dropdowns, accordions |
| Selection | `inactive` / `active` | Tabs, radio buttons, list items |
| Async | `idle` / `loading` / `loaded` / `error` | Data fetchers, file uploads |
| Multi-phase | `hidden` / `showing` / `visible` / `hiding` | Tooltips, toasts with delays |
| Item-level | Named group like `item { collapsed / expanded }` | Per-item state in repeating widgets |

### Step 5: Declare Accessibility

The accessibility block defines the widget's ARIA contract, keyboard interactions, and focus management. This is mandatory for all widgets.

```
accessibility {
  role: dialog;
  modal: true;
  keyboard {
    Escape -> CLOSE;
    Tab -> FOCUS_NEXT;
    ArrowDown -> NAVIGATE_NEXT;
  }
  focus {
    trap: true;
    initial: content;
    roving: true;
  }
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
}
```

**Accessibility design rules:**

1. **Always declare `role`** -- Use the most specific WAI-ARIA role: `dialog`, `tablist`, `listbox`, `grid`, `tooltip`, `menu`, `combobox`, `region`, etc.
2. **Keyboard bindings map keys to events** -- `Key -> EVENT` where EVENT matches a state machine event.
3. **Focus management** is required:
   - `trap: true` for modals (dialog, alert-dialog, drawer)
   - `trap: false` for inline components (tabs, accordion, select)
   - `initial` names the part that receives focus on open
   - `roving: true` for widgets with arrow-key navigation between items (tabs, menus, grids)
4. **ARIA attribute mappings** in the `aria` block bind ARIA attributes to parts, referencing state machine states and props.
5. **Always include `Escape -> CLOSE/ESCAPE`** for any widget that opens or overlays.

**Common ARIA role mappings:**

| Widget Type | Role | Key Patterns |
|------------|------|-------------|
| Modal overlay | `dialog` | Escape to close, focus trap, `aria-modal` |
| Dropdown | `listbox` | Arrow keys, Enter to select, typeahead |
| Tab set | `tablist` | Arrow keys, roving tabindex |
| Menu | `menu` | Arrow keys, Enter to activate, Escape to close |
| Grid | `grid` | Arrow keys in 2D, Home/End |
| Tooltip | `tooltip` | Escape to dismiss, no focus trap |
| Accordion | `region` | Enter/Space to toggle, Arrow keys between triggers |

### Step 6: Define Props

Props declare the widget's external API -- configurable values passed in by the consumer.

```
props {
  open: Bool = false
  label: String
  placement: String = "bottom"
  disabled: Bool = false
  value: option String
  options: list { label: String, value: String }
  variant: union "solid" | "outline" | "ghost" = "solid"
}
```

**Prop type syntax:**

| Syntax | Meaning |
|--------|---------|
| `Bool` | Boolean value |
| `String` | String value |
| `Int` | Integer number |
| `option String` | Optional string (may be absent) |
| `set String` | Set of strings |
| `list Type` | Ordered list of items |
| `list { field: Type, ... }` | List of structured objects |
| `union "a" \| "b" \| "c"` | Discriminated union of literal values |
| `"a" \| "b"` | Shorthand union (inline) |

**Default values** use `= value` syntax. Props without defaults are required.

**Prop naming conventions:**
- Boolean props: use adjectives (`disabled`, `required`, `multiple`) or present-tense verbs (`open`, `loading`)
- Handler props: not declared here (events are in the state machine)
- Avoid `on`-prefixed props (those are connect-block concerns)

### Step 7: Write the Connect Block

The connect block maps anatomy parts to their runtime attributes, event handlers, and dynamic expressions. This is where props, state, and parts are wired together.

```
connect {
  root -> {
    data-state: if state.visibility == "open" then "open" else "closed";
    data-disabled: if ?disabled then "true" else "false";
  }

  trigger -> {
    aria-expanded: if state.visibility == "open" then "true" else "false";
    aria-haspopup: "dialog";
    onClick: send(OPEN);
    disabled: ?disabled;
  }

  content -> {
    role: "dialog";
    aria-modal: "true";
    aria-labelledby: title;
    hidden: if state.visibility == "closed" then true else false;
  }
}
```

**Connect expression syntax:**

| Pattern | Meaning |
|---------|---------|
| `?propName` | Reference a prop value |
| `state.machineName` | Reference current state of a named machine |
| `send(EVENT)` | Dispatch a state machine event |
| `send(EVENT, { key: value })` | Dispatch with payload |
| `if cond then a else b` | Conditional expression |
| `?cond ? "a" : "b"` | Ternary (shorthand conditional) |
| `noop` | No-op handler |
| `self.property` | Reference the current part's own data |

**Connect design rules:**
1. Every anatomy part that appears in accessibility `aria` should have matching attributes in connect.
2. All `data-state` attributes should reflect state machine states.
3. Event handlers (`onClick`, `onKeyDown`, etc.) should dispatch state machine events via `send()`.
4. Use `data-*` attributes for styling hooks, ARIA attributes for assistive technology.
5. **Always bind `data-state` on root** -- This enables automated test selectors (`[data-part="root"][data-state="open"]`).
6. **Always include `data-part` on all parts** -- WidgetComponentTest and Playwright tests use `[data-part="<name>"]` selectors. These are auto-generated by the interpreter but must match anatomy part names exactly.

### Step 8: Declare Affordance (If Applicable)

The affordance block tells the Surface system what concept-level purpose this widget serves, enabling automatic widget selection.

```
affordance {
  serves: single-choice;
  specificity: 5;
  when { viewType: "dropdown" }
  bind {
    value: selectedOption;
    options: availableChoices;
  }
}
```

- `serves` -- The abstract UI purpose: `overlay`, `single-choice`, `group-repeating`, `navigation`, `group-section`, etc.
- `specificity` -- Priority when multiple widgets serve the same purpose (higher wins). Range 1-10.
- `when` -- Optional conditions that must be true for this widget to be selected.
- `bind` -- Maps widget props to concept state fields.

Not all widgets need affordances. Use them when the widget is a candidate for automatic selection by the Surface engine.

### Step 9: Define Composition

The compose block declares child widgets that this widget uses internally.

```
compose {
  _portal:     widget("portal",     { target: "body" })
  _focusTrap:  widget("focus-trap", { active: ?open })
  _presence:   widget("presence",   { present: ?open })
  label:       widget("label",      { text: ?label, for: trigger })
  pagination:  widget("pagination", { totalItems: ?data.length })
}
```

**Composition conventions:**
- Prefix internal/infrastructure widgets with `_` (portal, focus-trap, scroll-lock, presence)
- Named compositions map to anatomy parts when the part is implemented by another widget
- Pass props and state references as widget parameters

### Step 10: Declare the Requires Block (If Applicable)

The `requires` block declares what concept-level fields and actions this widget needs to function. It establishes the contract between the widget and the concept it renders.

```
requires @1 {
  fields {
    items: list;
    status: String;
    count: Int;
  }
  actions {
    approve();
    reject();
  }
}
```

The `@N` annotation is a priority level. Most widgets do not need a requires block -- use it only when the widget is tightly coupled to a specific concept's data shape.

### Step 11: Write Invariants

Invariants express behavioral contracts the widget must uphold regardless of implementation framework. **Prefer structured invariants** over prose strings — structured invariants are automatically extracted by `WidgetComponentTest` to generate framework-specific conformance tests (React Testing Library, Playwright, Vue Test Utils, Svelte, etc.).

**Two formats supported:**

#### Format 1: Structured Invariants (Preferred — generates tests)

```
invariant {
  example "open then close": {
    after trigger.click -> ok
    then root -> { data-state: "open" }
    and trigger -> { aria-expanded: "true" }
    then closeTrigger.click -> ok
    then root -> { data-state: "closed" }
  }

  forall s in states:
    s.reachable = true

  always "role present": {
    forall p in parts:
      p.role != none
  }

  never "focus escapes trap": {
    exists e in focusEvents:
      e.target.outside(content) and state.visibility = "open"
  }

  action trigger.click {
    requires: state.visibility = "closed"
    ensures ok: state.visibility = "open"
    ensures ok: focus.target = content
  }
}
```

**Structured invariant kinds:**

| Kind | What It Tests | Generated Test Type |
|------|---------------|---------------------|
| `example` | Action sequence with assertions | Step-by-step behavioral test |
| `forall` | Universal property over a set | Value-enumerated loop test |
| `always` | Temporal constraint (must hold in every state) | State-checked assertion |
| `never` | Negation (must never hold) | Violation-attempt test |
| `eventually` | Liveness (must eventually hold) | Bounded sequence test |
| `action` | Pre/post-conditions on actions | Contract test with requires/ensures |

#### Format 2: Prose Invariants (Legacy — no auto-generated tests)

```
invariant {
  "Focus must be trapped inside content while open";
  "Trigger must regain focus after dialog closes";
}
```

Prose invariants are still supported but do NOT generate automated component tests. Use them only for complex behavioral properties that can't be expressed structurally.

**Invariant quality rules:**
1. **Prefer structured over prose** -- Structured invariants generate automated tests via WidgetComponentTest.
2. **Test observable behavior**, not internal implementation.
3. **Reference anatomy parts and states** by name.
4. **Cover accessibility contracts** -- focus management, ARIA attribute consistency, keyboard behavior.
5. **Cover state machine properties** -- mutual exclusion, reachability, liveness.
6. **Cover connect bindings** -- data-state reflects FSM, ARIA attributes match state.
7. **One invariant per behavioral property**.

### Step 12: Assemble and Place the File

Place the `.widget` file at:
- `repertoire/widgets/<category>/<name>.widget` for general-purpose widgets
- `repertoire/concepts/<concept-name>/widgets/<name>.widget` for concept-specific widgets

Section order is always:
1. `@version(1)`
2. `widget <name> { ... }`
3. Inside the widget block, sections in this order:
   - `purpose { ... }`
   - `requires @N { ... }` (optional)
   - `anatomy { ... }`
   - `slots { ... }` (optional)
   - `states { ... }`
   - `accessibility { ... }`
   - `props { ... }`
   - `connect { ... }`
   - `affordance { ... }` (optional)
   - `compose { ... }` (optional)
   - `invariant { ... }`

### Step 13: Validate by Parsing

Run the parser to verify your widget is syntactically valid:

```bash
npx tsx -e "
import { readFileSync } from 'fs';
import { parseWidgetFile } from './handlers/ts/framework/widget-spec-parser.js';

const source = readFileSync('repertoire/widgets/<category>/<name>.widget', 'utf-8');
const manifest = parseWidgetFile(source);
console.log('Parsed:', manifest.name);
console.log('Anatomy parts:', manifest.anatomy.map(p => p.name));
console.log('States:', manifest.states.map(s => s.name));
console.log('Props:', manifest.props.map(p => p.name));
console.log('Accessibility role:', manifest.accessibility.role);
console.log('Keyboard bindings:', manifest.accessibility.keyboard.length);
console.log('Composed widgets:', manifest.composedWidgets);
"
```

### Step 14: Check Against Anti-Patterns

Run through this final checklist:

- [ ] **Not visual** -- Spec describes behavior and structure, not colors/sizes/fonts
- [ ] **Not framework-specific** -- No React hooks, Vue directives, or Svelte syntax
- [ ] **Anatomy is complete** -- Every part referenced in connect, accessibility, or compose is declared in anatomy
- [ ] **State machine is deterministic** -- No state has two transitions on the same event to different targets
- [ ] **Accessibility is complete** -- Role is declared, keyboard bindings cover all interactive events, focus strategy is specified
- [ ] **Props have types** -- Every prop has a declared type
- [ ] **Connect covers all parts** -- Every anatomy part has a connect block (or is purely structural)
- [ ] **Invariants are meaningful** -- Each invariant describes a testable behavioral property
- [ ] **Structured invariants preferred** -- Use example/forall/always/never over prose for auto-generated tests
- [ ] **data-state on root** -- Root part has `data-state` bound to FSM state for test selectors
- [ ] **No dead states** -- Every state is reachable from the initial state

## Quick Reference: Widget Structure

Read [references/widget-grammar.md](references/widget-grammar.md) for the complete grammar reference.

```
@version(1)
widget widget-name {

  purpose {
    2-4 sentences describing what this widget does and why.
  }

  requires @N {
    fields { fieldName: Type; ... }
    actions { actionName(params); ... }
  }

  anatomy {
    root:      container  { Top-level wrapper }
    trigger:   action     { Element that activates the widget }
    content:   container  { Main content area }
    title:     text       { Heading label }
  }

  slots {
    body { after title }
  }

  states {
    closed [initial] {
      on OPEN -> open;
    }
    open {
      on CLOSE -> closed;
      entry [trapFocus];
      exit [releaseFocus];
    }
  }

  accessibility {
    role: dialog;
    keyboard { Escape -> CLOSE; }
    focus { trap: true; initial: content; }
    aria {
      trigger -> { aria-expanded: "true"; };
    }
  }

  props {
    open: Bool = false
    label: String
  }

  connect {
    root -> { data-state: if open then "open" else "closed"; }
    trigger -> { onClick: send(OPEN); }
  }

  affordance {
    serves: overlay;
    specificity: 10;
  }

  compose {
    _portal: widget("portal", { target: "body" })
  }

  invariant {
    "Focus must be trapped while open";
  }
}
```

## Example Walkthrough

For a complete worked example with design rationale:
- [examples/dialog-widget.md](examples/dialog-widget.md) -- Dialog widget with full annotations

## Automated Component Test Generation

Widget specs with structured invariants automatically generate framework-specific conformance tests via `WidgetComponentTest`. The system extracts 8 categories of testable assertions:

| Category | Source in Widget Spec | Generated Tests |
|----------|----------------------|-----------------|
| FSM transitions | `states { ... }` | Initial state, transition sequences, dead state detection |
| Connect bindings | `connect { ... }` | Attribute values match state, data-state reflects FSM |
| Keyboard | `accessibility { keyboard { ... } }` | Key presses fire events and cause transitions |
| Focus | `accessibility { focus { ... } }` | Trap, roving, initial, returnOnClose |
| ARIA | `accessibility { aria { ... } }` | Role and ARIA attributes present on parts |
| Props | `props { ... }` | Defaults render correctly, changes propagate |
| Invariants | `invariant { ... }` | Structured invariants become behavioral tests |
| Compose | `compose { ... }` | Child widgets render in correct slots |

**Available renderers:** React Testing Library, Playwright, Vue Test Utils, Svelte Testing Library, Vanilla DOM

To generate tests for a widget, pass the parsed WidgetManifest to `WidgetComponentTest/buildPlan`, then route the plan to a framework-specific renderer.

## Related Skills

| Skill | When to Use |
|-------|------------|
| `/create-concept` | Design the concept whose state this widget will render |
| `/create-suite` | Bundle widgets and concepts into a reusable suite |
| `/create-sync` | Write sync rules connecting concepts that feed widget state |
| `/create-implementation` | Write the TypeScript/React implementation for this widget |
| `/surface-widget-handler-gen` | Generate the functional handler for this widget |
