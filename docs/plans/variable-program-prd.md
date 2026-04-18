# VariableProgram — Universal Data Source Resolution

## Problem Statement

The framework has reinvented "resolve a value from somewhere" at least six times:

| Existing concept | What it solves | Why it's not enough |
|---|---|---|
| `token.concept` | `[node:author:mail]` chain traversal in text | Text-only, no typing, not composable |
| `param-binding.concept` | field / url-param / relation / control → target | ui-app scoped, no step/query/page sources |
| `process-variable.concept` | typed scoped vars within a process run | Write side only; reading is raw key lookup |
| `DataSourceSpec` `{{varName}}` | template interpolation in view config | String interpolation only, no traversal |
| `FilterSpec` param nodes | `$step.config.X` in filter expressions | Filter-specific, not reusable |
| `formula-field.concept` | computed fields with scope-aware bindings | Schema-scoped, requires expression eval |

Every author surface (process step config, view filter, page editor tokens, widget props,
form field defaults) needs to pull data from somewhere and traverse to a specific value.
Each reinvents its own mini-language. There is no common picker UX.

## Design

### Design Model: Typed Access-Path Expression

**VariableProgram** is a typed access-path expression — an instruction list (AST)
describing where data comes from, how to traverse to the target field, and how to
transform the result. Description is separate from execution: the interpreter
resolves it at runtime.

It is inspectable and serializable like the program monads (StorageProgram,
RenderProgram, QueryProgram), but is not itself a monad: there is no meaningful
bind/branching, no parallelism to exploit. Its analysis value is different in kind:
- **Source provenance** — does this expression read from session? → auth/cache decisions
- **Staleness detection** — does this bind `$step.X` before step X has run? → spec validation
- **Type inference** — what type does this resolve to? → schema compatibility checking
- **Dependency graph** — which steps/sources does this ViewShell filter depend on? → ordering

The instruction list IS the typed AST. ExpressionLanguage (compute-ON) and Lens
(storage-state navigation) already exist for adjacent concerns; VariableProgram
covers the resolve-WHERE-FROM layer that neither handles.

### Plugin Architecture

Both source providers and transform providers are registered via the existing
`PluginRegistry` concept — VariableProgram does **not** own a registry.

| Slot | PluginRegistry namespace | Key examples |
|---|---|---|
| Source | `variable-source` | `page`, `url`, `step`, `session`, `content`, `query`, `literal`, `context` |
| Transform | `variable-transform` | `format`, `fallback`, `coerce`, `join` |

At resolution time, `VariableProgram/resolve` calls `PluginRegistry/get` for each
instruction in the pipeline. New source or transform kinds are added by calling
`PluginRegistry/register` — the VariableProgram concept itself never changes.

#### SourceProvider interface

```
VariableSourceProvider {
  kind:          String          // "page" | "url" | custom — matches PluginRegistry key
  prefix:        String          // canonical text prefix: "$page" | "$url" | custom
  argSpec:       list ArgSpec    // argument schema for the picker (e.g. param name input)
  resolvedType:  String          // declared output type for static inference
  resolve(args, context) → value
  listProperties(args) → list PropertySpec  // for the picker middle panel
}
```

#### TransformProvider interface

```
VariableTransformProvider {
  kind:     String        // "format" | "fallback" | custom
  argSpec:  list ArgSpec  // argument schema
  apply(value, args) → value
}
```

Built-in sources (Page, Url, Content, ViewQuery, ProcessStep, Session, Literal, Context)
and built-in transforms (format, fallback, coerce, join) are registered at platform boot
via syncs — they are **not** hardcoded into the concept.

Existing concepts become the first providers via registration syncs:
- `formula-field.concept` → `FormulaTransformProvider` (registered under `variable-transform.formula`)
- `ProcessVariable.concept` → source provider for `fromProcessStep`
- `Session.concept` → source provider for `fromSession`
- `Token.concept` → source provider alias (backward compat)

### Grammar

A VariableProgram is a sequential instruction list:

```
VariableProgram = SourceInstruction [TraversalInstruction*] [TransformInstruction*]
```

#### Source instructions (where to start)

Dispatched to a registered `VariableSourceProvider` via `PluginRegistry/get("variable-source", kind)`.

| Kind | Resolves to | Text form |
|---|---|---|
| `page` | Current page ContentNode | `$page` |
| `url` | URL query / route param value | `$url.{param}` |
| `content` | ContentNode by ID | `$content[{id}]` |
| `query` | Named view query result (list or first row) | `$query.{name}` |
| `step` | ProcessVariable scoped to that step's output | `$step.{key}` |
| `session` | Current user session (userId, displayName, roles, etc.) | `$session` |
| `literal` | Constant value | `'{value}'` |
| `context` | Ambient context variable (injected by host, e.g. entity in scope) | `$ctx.{key}` |

Custom source kinds registered via `PluginRegistry` gain their own prefix and appear
automatically in the VariablePickerWidget source list.

#### Traversal instructions (navigate to a value)

Traversal steps are structural — they navigate an object graph using the type system
(Property, Relation, Schema metadata). They are handled by a shared **TraversalInterpreter**
and are not pluggable (the schema navigation model is universal).

| Instruction | Effect | Text form |
|---|---|---|
| `get(field)` | Read a property field | `.{field}` |
| `follow(relation)` | Traverse a named relation to another entity | `.{relation}` |
| `at(index)` | Index into a list | `[{n}]` |
| `first()` | First item of a list | `[0]` |
| `count()` | Length of a list | `.count` |
| `keys()` | Map/object key list | `.keys` |

#### Transform instructions (reshape the value)

Dispatched to a registered `VariableTransformProvider` via `PluginRegistry/get("variable-transform", kind)`.

| Kind | Effect | Text form |
|---|---|---|
| `format` | Format as date, number, currency, etc. | `\|format('{pat}')` |
| `fallback` | Default if null/undefined | `\|fallback('{v}')` |
| `coerce` | Type coercion (string→number, etc.) | `\|as({type})` |
| `join` | Join a list into a string | `\|join('{sep}')` |
| `formula` | Apply a formula-field expression | `\|formula('{expr}')` |

Custom transform kinds registered via `PluginRegistry` gain their own pipe syntax and
appear in the VariablePickerWidget transform panel.

#### Text representation (canonical expression syntax)

```
$page.title                           — page title
$page.assignee.email                  — relation traversal
$url.id                               — URL param
$content[abc123].tags[0].name         — content node → relation → first → field
$query.myQuery[0].assignee.displayName — view query first row → relation → field
$step.brainstorm.shortlisted[0]       — process step output → index
$session.displayName                  — session field
'hello world'                         — literal
$ctx.entity.status                    — ambient context entity
$page.dueDate|format('MMM d, yyyy')   — with transform
$step.create-form.nodeId|fallback('')  — with fallback
$page.amount|formula('value * 1.1')   — formula-field transform
```

This syntax is already partially used in the codebase (`$step.config.*` in view specs).
VariableProgram standardises and extends it.

### Concept Design

```
concept VariableProgram [V] {

  purpose {
    Composable instruction sequence that resolves a single typed value from
    any data source in the system. The fourth program monad, alongside
    StorageProgram, RenderProgram, and QueryProgram. Unifies token substitution,
    param binding, DataSourceSpec template vars, FilterSpec param nodes, and
    SlotSource field/relation providers into one grammar and one picker UX.

    Source and transform providers are registered via PluginRegistry
    (namespaces: "variable-source", "variable-transform") — this concept
    owns only the pipeline data structure and the resolution protocol.
  }

  state {
    programs:       set V
    instructions:   V -> list String    // JSON-serialized instruction list
    sourceKind:     V -> String         // registered PluginRegistry key
    resolvedType:   V -> option String  // inferred type from static analysis
    expression:     V -> String         // canonical $page.field text form
  }

  actions {
    // --- Construction ---
    from(sourceKind: String, args: String)              → ok(program: V) | provider_not_found | error

    // --- Traversal (chain onto existing program) ---
    get(program: V, field: String)        → ok(program: V) | type_error
    follow(program: V, relation: String)  → ok(program: V)
    at(program: V, index: Int)            → ok(program: V) | out_of_bounds
    first(program: V)                     → ok(program: V)
    count(program: V)                     → ok(program: V)

    // --- Transform (dispatches to PluginRegistry "variable-transform") ---
    transform(program: V, kind: String, args: String) → ok(program: V) | provider_not_found

    // --- Compilation / Parsing ---
    compile(program: V)              → ok(expression: String) | error
    parse(expression: String)        → ok(program: V) | parse_error
    typeCheck(program: V)            → ok(resolvedType: String) | type_error

    // --- Runtime resolution ---
    resolve(program: V, context: String) → ok(value: String) | not_found | type_error | provider_not_found
  }
}
```

### Relationship to existing concepts

**What VariableProgram REPLACES (source/read side):**

| Old | New |
|---|---|
| `token.concept` `[node:author:mail]` | `from('content', id).follow('author').get('mail')` |
| `param-binding` source: field/url-param/relation | `from('page').get(f)` / `from('url', p)` / `from('page').follow(r)` |
| `DataSourceSpec` `{{varName}}` template | `from('url', varName)` or `from('step', k).get(varName)` |
| `FilterSpec` param nodes | Resolved by VariableProgram at bind time |
| `formula-field` variable bindings | `from('page').get(f)` etc. as formula context vars |
| `SlotSource` entity_field / relation providers | `from('context', 'entity').get(f)` / `.follow(r)` |

**What VariableProgram does NOT replace:**
- `ProcessVariable/set` — the WRITE side (VariableProgram handles reads only)
- `expression-language.concept` — arithmetic, conditions, string ops on values.
  VariableProgram resolves WHERE data comes from; ExpressionLanguage computes ON data.
  They compose: `VariableProgram → value → transform('formula', expr) → computed result`
- `QueryProgram` — full dataset pipelines. `from('query', name)` reads a NAMED already-configured
  QueryProgram result; it does not replace QueryProgram itself.
- `PluginRegistry` — provider registration. VariableProgram queries PluginRegistry at
  resolution time; it never owns a registry of its own.

### Providers

Source and transform providers are NOT registered on VariableProgram. They are registered
via `PluginRegistry/register` at platform boot, typically triggered by syncs on concept init.

| Provider | Namespace + key | Registered by |
|---|---|---|
| `PageVariableProvider` | `variable-source.page` | platform boot sync |
| `UrlVariableProvider` | `variable-source.url` | platform boot sync |
| `ContentVariableProvider` | `variable-source.content` | platform boot sync |
| `ViewQueryVariableProvider` | `variable-source.query` | platform boot sync |
| `ProcessStepVariableProvider` | `variable-source.step` | ProcessVariable init sync |
| `SessionVariableProvider` | `variable-source.session` | Session init sync |
| `LiteralVariableProvider` | `variable-source.literal` | platform boot sync |
| `ContextVariableProvider` | `variable-source.context` | platform boot sync |
| `FormatTransformProvider` | `variable-transform.format` | platform boot sync |
| `FallbackTransformProvider` | `variable-transform.fallback` | platform boot sync |
| `CoerceTransformProvider` | `variable-transform.coerce` | platform boot sync |
| `JoinTransformProvider` | `variable-transform.join` | platform boot sync |
| `FormulaTransformProvider` | `variable-transform.formula` | formula-field init sync |

Traversal instructions (get, follow, at, first, count) are handled by a shared
**TraversalInterpreter** that works on any resolved entity using the type system
(Property, Relation, Schema metadata). Traversal is not pluggable — schema navigation
is universal across all sources.

### VariablePickerWidget

The UX for selecting a VariableProgram expression in any author surface.

```
┌─────────────────────────────────────────────────────────────────┐
│  Choose a variable                                              │
│                                                                 │
│  Source         │  Properties              │  Preview           │
│  ─────────────  │  ────────────────────── │  ──────────────    │
│  ▶ Page         │  title          string  │  $page.assignee    │
│    URL params   │  ▶ assignee     User    │  .email            │
│    Content      │    dueDate      Date    │                    │
│    View query   │    status       string  │  Type: string      │
│    Process step │    tags         Tag[]   │                    │
│    Session      │                         │  Preview:          │
│    Literal      │  [email ←selected]      │  "alice@co.com"    │
│    [custom…]    │                         │                    │
│                                                                 │
│  Expression:  $page.assignee.email                             │
│               [________________________]  ← editable           │
│                                                                 │
│  [Cancel]                              [Use this variable]     │
└─────────────────────────────────────────────────────────────────┘
```

The source list is populated from `PluginRegistry/list("variable-source")` — custom providers
appear automatically without changing the widget. Each provider's `argSpec` drives the
picker input for that source (e.g. URL params shows a text input for param name; Content
shows a node search).

**Three-panel layout:**
- **Left — Source selector**: populated from PluginRegistry. Contextually filters available
  sources (process steps only shown inside a process step config, etc.)
- **Middle — Property/relation browser**: tree of fields and relations for the selected
  source, via provider's `listProperties(args)`. Click to append to path. Expandable relations.
- **Right — Preview**: resolved expression string, inferred type, live preview value
  (if runtime context available), fallback indicator.

**Bottom bar:**
- Expression text input (editable directly for power users)
- Type indicator badge
- Cancel / Use this variable

**FSM states:**
- `browsing` — source selected, browsing properties
- `selected` — leaf property chosen; confirmButton enabled
- `editing` — user typing directly in expression input
- `resolving` — live preview fetch in flight
- `confirmed` — onSelect called, widget closes

### Syncs

| Sync | When | Effect |
|---|---|---|
| `variable-program-compile` | `VariableProgram/from` → ok | Compile instruction list to expression string |
| `variable-program-type-check` | `VariableProgram/get` → ok | Infer resolved type from schema metadata |
| `variable-source-providers-boot` | platform boot | Register 8 built-in source providers via PluginRegistry |
| `variable-transform-providers-boot` | platform boot | Register 4 built-in transform providers via PluginRegistry |
| `variable-formula-provider` | `FormulaField` init → ok | Register FormulaTransformProvider via PluginRegistry |
| `variable-token-migration` | `Token/register` → ok | Register token as VariableProgram source alias via PluginRegistry |
| `variable-param-binding` | `ParamBinding/resolve` → ok | Dispatch source resolution through VariableProgram providers |
| `variable-filter-bind` | `FilterSpec/bind` → ok | Substitute FilterSpec param nodes using VariableProgram resolution |

### Integration Points

#### Process step config
Step config fields that are VariableProgram expressions are evaluated before the step runs.
`ProcessVariable/set` is still called on step completion to write outputs.
Downstream steps read via `from('step', stepKey).get(field)`.

#### View filter binding
`FilterSpec` param nodes resolve to VariableProgram expressions:
```
$step.config.boardId  →  from('step', 'config').get('boardId')
```

#### Page editor / block content
Token syntax `[node:author:mail]` resolves to:
```
from('content', nodeId).follow('author').get('mail')
```
The block renderer calls `VariableProgram/resolve` at render time.

#### Widget props / SlotSource
`SlotSource` entity_field and relation providers delegate to:
```
from('context', 'entity').get(field)
from('context', 'entity').follow(relation).get(displayField)
```

#### Form field defaults
A form field default value can be any VariableProgram expression, evaluated
when the form mounts.

## Deliverables

| Card | Description | Agent |
|---|---|---|
| MAG-TBD | `VariableProgram` concept spec + handler | concept-scaffold-gen |
| MAG-TBD | Source providers (8): Page, Url, Content, ViewQuery, ProcessStep, Session, Literal, Context — registered via PluginRegistry | handler-scaffold-gen |
| MAG-TBD | Transform providers (4+): format, fallback, coerce, join — registered via PluginRegistry | handler-scaffold-gen |
| MAG-TBD | `TraversalInterpreter` — shared get/follow/at resolution using type system | general-purpose |
| MAG-TBD | `VariablePickerWidget.widget` spec | surface-component-scaffold-gen |
| MAG-TBD | `VariablePickerWidget` React implementation | surface-widget-handler-gen |
| MAG-TBD | Boot syncs: register built-in source + transform providers via PluginRegistry | sync-scaffold-gen |
| MAG-TBD | `FormulaTransformProvider` sync: formula-field init → PluginRegistry | sync-scaffold-gen |
| MAG-TBD | Migration: token.concept → VariableProgram source alias via PluginRegistry | sync-scaffold-gen |
| MAG-TBD | Migration: param-binding source side → VariableProgram | handler-scaffold-gen |
| MAG-TBD | Migration: DataSourceSpec `{{var}}` → VariableProgram parse | general-purpose |
| MAG-TBD | Migration: FilterSpec param nodes → VariableProgram resolve at bind | sync-scaffold-gen |
| MAG-TBD | Integration: SlotSource entity_field + relation → VariableProgram | handler-scaffold-gen |
| MAG-TBD | Integration: process step config fields accept VariableProgram expressions | clef-base |
| MAG-TBD | Integration: form field defaults accept VariableProgram expressions | clef-base |

## Open Questions

1. **ExpressionLanguage composition**: When a VariableProgram resolves to a value and
   an author wants to compute on it (arithmetic, conditions), should that be a second
   step through ExpressionLanguage, or should VariableProgram grow compute instructions?
   Recommendation: keep them separate — VariableProgram resolves WHERE, ExpressionLanguage
   computes ON. Wire them via the `formula` TransformProvider which composes both.

2. **Type inference depth**: TraversalInterpreter needs schema metadata to infer types
   at `get(field)` time. How deep should static inference go (through relations, through
   view query result schemas)? Start with one level; add depth iteratively.

3. **fromViewQuery caching**: View query results may be expensive. Should VariableProgram
   cache within a render cycle? Yes — memoize by expression string within a VariableContext.

4. **Backward compatibility**: `token.concept` is used in production. Migration sync
   should register every existing token as a VariableProgram source alias, not replace them
   immediately.

5. **Traversal pluggability**: Traversal (get/follow/at) is currently treated as universal
   structural navigation. If a custom source kind has non-standard traversal semantics,
   it could declare its own traversal strategy via the SourceProvider interface. Deferred
   until a concrete need arises.

## Kanban Table

| Card | Description | Blocks | Commit |
|---|---|---|---|
| MAG-TBD | VariableProgram concept + handler | all others | |
| MAG-TBD | Source providers (8) via PluginRegistry | TraversalInterpreter, VariablePickerWidget, migrations | |
| MAG-TBD | Transform providers (4+) via PluginRegistry | FormulaTransformProvider sync, migrations | |
| MAG-TBD | TraversalInterpreter | VariablePickerWidget integration | |
| MAG-TBD | Boot syncs (source + transform provider registration) | all runtime resolution | |
| MAG-TBD | FormulaTransformProvider sync | — | |
| MAG-TBD | VariablePickerWidget.widget spec | React impl | |
| MAG-TBD | VariablePickerWidget React impl | process step config, form defaults | |
| MAG-TBD | token.concept migration sync | — | |
| MAG-TBD | param-binding migration | — | |
| MAG-TBD | DataSourceSpec migration | — | |
| MAG-TBD | FilterSpec param node resolution | — | |
| MAG-TBD | SlotSource delegation | — | |
| MAG-TBD | Process step config integration | — | |
| MAG-TBD | Form field defaults integration | — | |
