# .view File Grammar Reference

The `.view` file format is parsed by a recursive descent parser at `handlers/ts/framework/view-spec-parser.ts`. This document describes the complete grammar.

## Top-Level Structure

```
view "<name>" {
  shell: "<view-shell-name>"

  features {
    <feature-name>
    ...
  }

  purpose {
    <free-text description>
  }

  invariants {
    <invariant blocks>
  }
}
```

A `.view` file is an assertion manifest over a compiled QueryProgram. It references a ViewShell by name, optionally restricts which features are active, and declares invariants that the compiled query must satisfy. No actions, no state, no fixtures.

## View Header

```
view "<name>" {
```

- `name` is a string literal identifying this view manifest (must be unique across the project)

## Shell Reference

```
shell: "<view-shell-name>"
```

- Required. References a ViewShell by name. The ViewShell is compiled into a QueryProgram at test time.

## Features Section

```
features {
  filter
  sort
  pagination
  projection
}
```

- Optional. Declares which ViewShell features are active for this view.
- When omitted, all features are enabled (backward-compatible default).
- When present, only the listed features are enabled; the ViewShell's child spec slots for disabled features are ignored during query compilation.
- Feature names may appear one per line or space/comma separated.
- **Valid feature names:** `filter`, `sort`, `group`, `projection`, `interaction`, `pagination`
- Two features are always-on and cannot appear in this block: `dataSource` and `presentation`.
- Invalid feature names produce a parse error with the line and column.

### Features and ViewAnalysis

The `features` block affects the `ViewAnalysis` record available to invariants:

| Target | Type | Description |
|---|---|---|
| `enabledFeatures` | set String | Features listed in the block (or all features if block omitted) |
| `disabledFeatures` | set String | Features absent from the block |

Invariants can assert presence or absence of features:

```
always "has pagination": {
  "pagination" in enabledFeatures
}

always "no grouping": {
  "group" in disabledFeatures
}
```

When a feature is disabled, its corresponding field set in `ViewAnalysis` is always empty:
- `filter` disabled → `filterFields = []`
- `sort` disabled → `sortFields = []`
- `group` disabled → `groupFields = []`
- `projection` disabled → `projectedFields = []`
- `interaction` disabled → `invokedActions = []`, `invokeCount = 0`

## Purpose Section

```
purpose {
  <free-text description of the view's intent and usage>
}
```

- Optional. Free-text block describing what the view does. Consistent with every other Clef spec type (concepts, widgets, derived concepts).
- Parsed as all tokens between `{` and matching `}`, joined with spaces and whitespace-normalized.

## Invariants Section

```
invariants {
  <invariant blocks>
}
```

Contains one or more named invariant blocks. Supports the same invariant vocabulary as `.concept` and `.widget` files.

### `always` — Universal property

```
always "<name>": {
  <assertion>
}
```

Asserts that a property holds for every compiled QueryProgram from this view.

### `never` — Negated property

```
never "<name>": {
  <assertion>
}
```

Asserts that a condition must never hold.

### `example` — Concrete test case

```
example "<name>": {
  after compile
  then <assertion>
  and  <assertion>
}
```

A concrete test scenario. The `after compile` step triggers QueryProgram compilation. `then` and `and` steps assert properties of the compiled result.

### `forall` — Quantified property

```
forall <var> in <collection>:
<assertion using var>
```

Can appear as a top-level invariant or inline within `always`/`never` bodies.

## Assertion Targets

View invariants operate on a `ViewAnalysis` record computed by running analysis providers against the compiled QueryProgram:

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
| `sourceFields` | set String | DataSourceSpec |
| `filterFields` | set String | FilterSpec (empty when filter disabled) |
| `sortFields` | set String | SortSpec (empty when sort disabled) |
| `groupFields` | set String | GroupSpec (empty when group disabled) |
| `projectedFields` | set String | ProjectionSpec (empty when projection disabled) |
| `enabledFeatures` | set String | Features active for this view (from `features {}` block) |
| `disabledFeatures` | set String | Features absent from the `features {}` block |

## Predicate Operators

```
# Equality
purity = "read-only"
invokeCount = 0

# Inequality
invokedActions != {}
purity != "read-write"

# Set membership
"Task/escalate" in invokedActions
f in sourceFields

# Set emptiness
uncoveredVariants = []
invokedActions != {}

# Subset
projectedFields subset readFields

# String prefix
ia startsWith "Task/"

# Quantifiers
forall f in readFields: f in sourceFields
exists ia in invokedActions: ia startsWith "Admin/"

# Logical connectives
purity = "read-write" implies invokedActions != {}
purity = "read-only" and invokeCount = 0
```

## Comments

```
# This is a line comment
// This is also a line comment
```

Both `#` and `//` styles are supported, matching the concept parser.

## Complete Example

```
view "task-board-actions" {
  shell: "task-board"

  features {
    filter
    sort
    interaction
  }

  purpose {
    Task board with bulk escalate and archive actions. Read-write
    view dispatching through Task concept via the sync engine.
  }

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

    never "read-only purity with invokes": {
      purity = "read-only" and invokedActions != {}
    }

    example "escalate action is invoked": {
      after compile
      then "Task/escalate" in invokedActions
      and  purity = "read-write"
    }
  }
}
```

## Test Generation

`.view` files generate tests via `scripts/generate-view-tests.ts`:

```bash
npx tsx scripts/generate-view-tests.ts              # all views
npx tsx scripts/generate-view-tests.ts --filter task # filter by name
```

Generated tests go to `generated/tests/<view-name>.view.test.ts`.

## Suite Registration

Views are registered in `suite.yaml`:

```yaml
views:
  - path: ./views/content-list.view
    description: "Content listing view — read-only"
```

The test generator discovers views from this section or by globbing `specs/view/views/*.view`.

## Parser Error Messages

The parser reports errors with line and column numbers:

```
View parse error at line 3:5: expected string literal for shell, got IDENT(foo)
View parse error: missing required 'shell' declaration in view "my-view"
```
