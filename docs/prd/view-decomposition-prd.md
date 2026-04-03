# PRD: View Decomposition into Composable Concepts with IR

## Status: Draft
## Date: 2026-04-02
## Epic: `e0d9ff8e` — Epic: View Decomposition into Composable Concepts with IR

---

## Card Index

| PRD Section | Card ID | Title |
|------------|---------|-------|
| 3.1 FilterSpec | `d4d325d0` | Concept: FilterSpec [F] |
| 3.1 SortSpec | `0ebda862` | Concept: SortSpec [S] |
| 3.1 GroupSpec | `fdc0fe93` | Concept: GroupSpec [G] |
| 3.1 ProjectionSpec | `01fdd621` | Concept: ProjectionSpec [J] |
| 3.1 DataSourceSpec | `dd67c605` | Concept: DataSourceSpec [D] |
| 3.1 PresentationSpec | `9f4ff765` | Concept: PresentationSpec [P] |
| 3.1 InteractionSpec | `718de6da` | Concept: InteractionSpec [I] |
| 3.1 ViewShell | `f41f689e` | Concept: ViewShell [V] |
| 3.2 QueryProgram | `9837312f` | Concept: QueryProgram [Q] (optional) |
| 3.3 QueryExecution | `c50a49b6` | Concept: QueryExecution [E] |
| 3.4 FilterRepresentation | `33779f17` | Concept: FilterRepresentation [R] |
| 4.1 ViewResolve | `62ea1bb5` | Sync: ViewResolve |
| 4.2 CompileQuery | `6963ef4c` | Sync: CompileQuery |
| 4.3 ExecuteQuery | `cf24bcab` | Sync: ExecuteQuery |
| 4.4 ComposeFilters | `2b4bedb2` | Sync: ComposeFilters |
| 4.5 FilterFromDSL/ToDSL | `c109cf7b` | Sync: FilterFromDSL / FilterToDSL |
| 5.1 Phase A | `ae04e780` | Migration Phase A |
|   Phase A sub: Filter seeds (main) | `18d43a2d` | Extract FilterSpec seeds from View.seeds.yaml |
|   Phase A sub: Filter seeds (process) | `7154942d` | Extract FilterSpec seeds from View.process.seeds.yaml |
|   Phase A sub: Sort seeds (main) | `87a35f7f` | Extract SortSpec seeds from View.seeds.yaml |
|   Phase A sub: Sort seeds (process) | `978a624e` | Extract SortSpec seeds from View.process.seeds.yaml |
|   Phase A sub: Group seeds | `68e318c3` | Extract GroupSpec seeds from all views |
|   Phase A sub: Projection seeds | `e1317243` | Extract ProjectionSpec seeds from all views |
|   Phase A sub: ViewRenderer rewire | `e0cf5723` | Rewire ViewRenderer to use evaluate actions |
| 5.1 Phase B | `d03cd150` | Migration Phase B |
|   Phase B sub: DataSource seeds | `1f5e59e4` | Extract DataSourceSpec seeds |
|   Phase B sub: Presentation seeds | `6dda5f13` | Extract PresentationSpec seeds |
|   Phase B sub: Interaction seeds | `d0ced50f` | Extract InteractionSpec seeds |
|   Phase B sub: ViewShell seeds | `6ccbf839` | Generate ViewShell seeds |
|   Phase B sub: ViewRenderer resolve | `97acc192` | Add ViewShell resolve path to ViewRenderer |
| 5.1 Phase C | `a3d69420` | Migration Phase C |
|   Phase C sub: ToggleGroup provider | `281b0d4d` | Provider: ToggleGroupProvider |
|   Phase C sub: UrlParams provider | `1f352e8a` | Provider: UrlParamsProvider |
|   Phase C sub: Contextual provider | `bb434735` | Provider: ContextualProvider |
|   Phase C sub: TextDsl provider | `59cc2df2` | Provider: TextDslProvider (future) |
| 5.1 Phase D | `189fb92c` | Migration Phase D (optional) |
|   Phase D sub: KernelQueryProvider | `5916cc02` | Implement KernelQueryProvider |
|   Phase D sub: InMemoryProvider | `27b2c604` | Implement InMemoryProvider |
|   Phase D sub: Pipeline integration | `527c55cf` | Replace ViewRenderer with QueryProgram |
| 8 Suite | `c6eb4099` | Suite: Create view suite.yaml |
| 9 Open Questions | `7706da84` | Open Questions |
|   Q1: QueryProgram location | `b9985e49` | Decision: specs/monadic/ vs specs/view/ |
|   Q2: Pushdown depth | `7d497bb0` | Decision: Pushdown depth |
|   Q3: Provider style | `2c6474df` | Decision: Concepts vs TS classes |
|   Q4: Derived views | `8ea719a9` | Decision: .derived vs ViewShell |

---

## 1. Problem Statement

The current clef-base view system stores filters, sorts, groups, field configs, and display settings as **JSON strings embedded inside a monolithic View entity**. This works for rendering, but makes it impossible to:

- Share a filter across views without duplicating JSON
- Test a sort or filter in isolation
- Swap execution backends (kernel in-memory vs. pushed-down query)
- Offer multiple authoring surfaces (visual builder, text DSL, URL params) for the same filter
- Compose view fragments from independent sources (tenant filter AND user filter AND permission filter)

The research is unanimous: every major data-driven system (Notion, Airtable, AG Grid, TanStack, SharePoint, Tableau) independently converges on the same decomposition. Clef's concept independence principle demands the same — filters, sorts, groups, and projections should be first-class concepts with their own state, actions, and operational principles, wired together by syncs.

---

## 2. Design Principles

1. **IRs are standalone, not pipeline-coupled.** FilterNode, SortKey[], GroupingConfig are each self-contained IRs with their own algebraic properties. You can use a FilterNode to filter rows without touching sorts, groups, data sources, or any pipeline concept. The IRs are useful *before* you ever build a query pipeline.

2. **QueryProgram is an optional orchestration layer, not a prerequisite.** It assembles standalone IRs into a pipeline *when you need one* — for pushdown negotiation, multi-backend execution, or full pipeline composition. Most views won't need it initially. A view can reference a FilterSpec and a SortSpec directly and apply them in-memory with zero pipeline overhead.

3. **Concepts own configuration. Providers own execution.** FilterSpec, SortSpec, GroupSpec are stateful, shareable, versionable configuration concepts. Execution against backends is a coordination concept + provider pattern (matching RenderTransform's kind-based dispatch).

4. **Algebraic composition.** Filters compose via AND (Boolean algebra monoid). Sorts compose via concatenation (ordered monoid). These aren't implementation details — they're invariants on the concepts. Composition works at the IR level — you don't need a pipeline to compose two filters.

5. **Two-way mapping is a lens, not a parse/print pair.** Each authoring representation (visual builder, text DSL, URL params) is a bidirectional provider satisfying GetPut/PutGet laws, with explicit lossy boundaries.

6. **Incremental migration.** The current ViewRenderer pipeline continues working. New concepts layer underneath, with ViewShell as a compatibility bridge that can reference either embedded JSON (legacy) or first-class concept IDs (new).

---

## 3. Concept Inventory

### 3.1 Configuration Concepts (new `.concept` specs)

These are independent, shareable, versionable artifacts with their own lifecycle.

#### FilterSpec [F] <!-- card:d4d325d0 -->

**Purpose:** A reusable, composable predicate tree that determines which records pass.

**State:**
```
filters: set F
name: F -> String
tree: F -> String           // Serialized FilterNode AST
fieldRefs: F -> set String  // Fields referenced (for pushdown analysis)
parameters: F -> list String // Bound context variables ({{entityId}}, etc.)
sourceType: F -> String     // "interactive" | "contextual" | "system" | "search"
```

**IR — FilterNode (the AST):**
```typescript
type FilterNode =
  | { type: "comparison"; field: string; op: ComparisonOp; value: Literal }
  | { type: "in"; field: string; values: Literal[] }
  | { type: "function"; name: "contains"|"startsWith"|"endsWith"|"matches";
      field: string; args: Literal[]; options?: { caseInsensitive?: boolean } }
  | { type: "exists"; field: string }
  | { type: "and"; conditions: FilterNode[] }
  | { type: "or"; conditions: FilterNode[] }
  | { type: "not"; condition: FilterNode }
  | { type: "param"; name: string }     // Context variable reference
  | { type: "true" }                     // Identity for AND monoid
  | { type: "false" }                    // Identity for OR monoid

type ComparisonOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
type Literal = string | number | boolean | null | { date: string }
```

**Key actions:** `create`, `get`, `compose` (AND two filters), `evaluate` (apply a FilterNode to rows, returning matching rows — no pipeline needed), `normalize` (to CNF/DNF), `validate` (check field refs against a schema), `bind` (resolve parameter values), `list`

**Standalone usage (no pipeline):**
```typescript
// Just filter some rows — no QueryProgram, no DataSource, no ViewShell
const filter = await invoke('FilterSpec', 'get', { name: 'high-priority' });
const result = await invoke('FilterSpec', 'evaluate', {
  name: 'high-priority',
  rows: JSON.stringify(myData)
});
// result.rows = filtered subset
```
This is the 90% case. Most views just need "apply this predicate to these rows."

**Algebraic invariant:** `compose(f, identity) = f` where identity is `{ type: "true" }`. `compose(f, g) = compose(g, f)` (commutativity under AND). `compose(f, f) = f` (idempotency).

**FilterNode IR operations (pure functions on the tree, no concept state needed):**

| Operation | Input → Output | Description |
|-----------|---------------|-------------|
| `evaluate` | `(node, rows) → rows` | Apply predicate to rows, return matches |
| `compose` | `(a, b) → node` | AND two trees together |
| `negate` | `(node) → node` | Wrap in NOT |
| `normalize` | `(node, form) → node` | Convert to CNF or DNF |
| `extractFields` | `(node) → string[]` | List all field references (for schema validation, pushdown analysis) |
| `simplify` | `(node) → node` | Algebraic simplification (double negation, identity elimination, idempotency) |
| `substitute` | `(node, bindings) → node` | Replace `{ type: "param" }` nodes with concrete values |
| `isSubsetOf` | `(a, b) → boolean` | Does filter A imply filter B? (for cache reuse, incremental eval) |
| `visit` | `(node, visitor) → T` | Generic tree traversal — the backbone for parse/print providers |

These are the building blocks for any representation provider. A DSL author only needs `visit` to write a printer and a parser that targets FilterNode. Everything else (composition, evaluation, simplification) comes for free from the IR.

**Migration from current system:** Today's `FilterConfig[]` with `type: "toggle-group"` maps to a FilterSpec with `sourceType: "interactive"` and a tree of `{ type: "in", field, values }`. Today's contextual filters map to a FilterSpec with `sourceType: "contextual"` and `{ type: "param" }` nodes.

---

#### SortSpec [S] <!-- card:0ebda862 -->

**Purpose:** An ordered sequence of sort keys that determines record ordering.

**State:**
```
sorts: set S
name: S -> String
keys: S -> list String    // Serialized SortKey[]
```

**IR — SortKey[]:**
```typescript
interface SortKey {
  field: string;
  direction: "asc" | "desc";
  nulls?: "first" | "last" | "auto";
  collation?: {
    locale?: string;
    sensitivity?: "base" | "accent" | "case" | "variant";
    numeric?: boolean;
  };
}
```

**Key actions:** `create`, `get`, `compose` (concatenate keys — lexicographic), `evaluate` (sort rows by these keys — no pipeline needed), `list`

**Standalone usage:** `invoke('SortSpec', 'evaluate', { name: 'by-date', rows })` — just sort rows, no pipeline.

**Algebraic invariant:** `compose(s, identity) = s` where identity is `{ keys: [] }`. NOT commutative — `compose(a, b) != compose(b, a)`.

**SortKey[] IR operations (pure functions, no concept state needed):**

| Operation | Input → Output | Description |
|-----------|---------------|-------------|
| `evaluate` | `(keys, rows) → rows` | Sort rows by keys in order (stable sort, so multi-key works via sequential application) |
| `compose` | `(a, b) → keys` | Concatenate key arrays — `a` is primary, `b` is tiebreaker |
| `reverse` | `(keys) → keys` | Flip all directions (asc↔desc) |
| `extractFields` | `(keys) → string[]` | List all field references |
| `isPrefix` | `(a, b) → boolean` | Does sort A's key list start with sort B's? (for incremental re-sort optimization) |
| `compareRows` | `(keys, rowA, rowB) → -1\|0\|1` | Compare two rows by these keys — the comparator function itself, usable with any sort algorithm |

A DSL author targeting SortKey[] gets `evaluate` and `compose` for free. Example DSL: `"name asc, created desc nulls last"` parses to `[{ field: "name", direction: "asc" }, { field: "created", direction: "desc", nulls: "last" }]`.

**Migration:** Today's `sorts` JSON field maps directly to a SortSpec.

---

#### GroupSpec [G] <!-- card:fdc0fe93 -->

**Purpose:** Defines how records are clustered into hierarchical groups with aggregations.

**State:**
```
groups: set G
name: G -> String
grouping: G -> String      // Serialized GroupingConfig
aggregations: G -> String  // Serialized AggregationDef[]
having: G -> String        // Optional post-aggregation FilterNode
```

**IR — GroupingConfig:**
```typescript
interface GroupingConfig {
  type: "basic" | "rollup" | "cube" | "grouping_sets";
  fields: GroupField[];
  sets?: string[][];  // Only for grouping_sets
}

interface GroupField {
  field: string;
  sort?: "asc" | "desc";
  hideEmpty?: boolean;
  defaultCollapsed?: boolean;
}

interface AggregationDef {
  function: "count" | "sum" | "avg" | "min" | "max" | "array_agg" | string;
  field?: string;         // null for COUNT(*)
  alias: string;
  distinct?: boolean;
  filter?: FilterNode;    // Per-aggregation filter (SQL FILTER WHERE)
}
```

**Key actions:** `create`, `get`, `evaluate` (group rows and compute aggregations — no pipeline needed), `list`

**Standalone usage:** `invoke('GroupSpec', 'evaluate', { name: 'by-status', rows })` — returns `{ groups: [{ key, rows, aggregates }] }`.

**Migration:** Today's `GroupConfig` with `fields: GroupFieldConfig[]` maps directly. The current limitation (only first field used) is a renderer limitation, not a data model one — the new concept supports the full array.

---

#### ProjectionSpec [J] <!-- card:01fdd621 -->

**Purpose:** Field selection, ordering, computed columns, and formatter bindings — what data is materialized for display.

**State:**
```
projections: set J
name: J -> String
fields: J -> list String   // Serialized ProjectionField[]
```

**IR — ProjectionField[]:**
```typescript
interface ProjectionField {
  key: string;              // Source field name
  label?: string;           // Display label
  visible?: boolean;        // Default true
  formatter?: string;       // Formatter name (badge, date-relative, etc.)
  computed?: string;        // Expression for virtual fields (future)
  weight?: number;          // Sort order for display
}
```

**Key actions:** `create`, `get`, `merge` (combine two projections, second wins on conflict), `list`

**Migration:** Today's `visibleFields: FieldConfig[]` maps directly to a ProjectionSpec.

---

#### DataSourceSpec [D] <!-- card:dd67c605 -->

**Purpose:** Declares the base dataset — what concept action to invoke, or what external source to query.

**State:**
```
sources: set D
name: D -> String
kind: D -> String           // "concept-action" | "remote-api" | "search-index" | "inline"
config: D -> String         // Serialized source config
parameters: D -> list String // Template variables
```

**IR — DataSourceConfig:**
```typescript
type DataSourceConfig =
  | { kind: "concept-action"; concept: string; action: string; params?: Record<string, unknown> }
  | { kind: "remote-api"; endpoint: string; method: string; headers?: Record<string, string> }
  | { kind: "search-index"; index: string; query?: string }
  | { kind: "inline"; data: unknown[] }
```

**Key actions:** `create`, `get`, `bind` (resolve template variables), `list`

**Migration:** Today's `dataSource: '{"concept":"ContentNode","action":"list"}'` maps to a DataSourceSpec with `kind: "concept-action"`.

---

#### PresentationSpec [P] <!-- card:9f4ff765 -->

**Purpose:** Names a display strategy and carries opaque display-specific hints. The spec does NOT enumerate or constrain which display types exist — display types are pluggable components resolved at render time, exactly as they are today. PresentationSpec is just the configuration artifact that says "use this display" and "here are hints the display can read if it wants."

**State:**
```
presentations: set P
name: P -> String
displayType: P -> String        // Opaque string — "table", "card-grid", "board", or anything registered
hints: P -> String              // Opaque JSON — display-specific options, interpreted only by the display component
displayModePolicy: P -> String  // "use" | "bypass"
defaultDisplayMode: P -> String
```

**There is no PresentationOptions IR.** Display types are an open set. A display component receives rows + the opaque `hints` JSON and interprets whatever keys it understands. A new display type (e.g., "swimlane", "heatmap", "gantt") is added by registering a component — PresentationSpec doesn't change.

This matches the current architecture exactly: `layout` is a string, the display component owns its own rendering logic, and WidgetResolver can recommend alternative displays based on context. PresentationSpec formalizes this as a shareable, named artifact without closing the set.

**Key actions:** `create`, `get`, `list`

**Migration:** Today's `layout` string becomes `displayType`. Today's `defaultDisplayMode` + `useDisplayMode` map directly. Any display-specific config that currently lives in view seeds moves into `hints`.

---

#### InteractionSpec [I] <!-- card:718de6da -->

**Purpose:** Controls, row actions, navigation, and picker behaviors.

**State:**
```
interactions: set I
name: I -> String
createForm: I -> String       // Serialized CreateFormConfig | null
rowClick: I -> String         // Serialized RowClickConfig | null
rowActions: I -> list String  // Serialized RowActionConfig[]
pickerMode: I -> Bool
```

**Key actions:** `create`, `get`, `list`

**Migration:** Today's `controls` JSON field maps directly.

---

#### ViewShell [V] <!-- card:f41f689e -->

**Purpose:** The named, user-facing view identity that ties all configuration concepts together by reference. A ViewShell owns no query logic — it is a composition point.

**State:**
```
views: set V
name: V -> String
title: V -> String
description: V -> String

// References to child specs (by ID)
dataSource: V -> String       // DataSourceSpec ID
filter: V -> String           // FilterSpec ID (composed from multiple filters)
sort: V -> String             // SortSpec ID
group: V -> String            // GroupSpec ID
projection: V -> String       // ProjectionSpec ID
presentation: V -> String     // PresentationSpec ID
interaction: V -> String      // InteractionSpec ID

// Legacy compat (deprecated, for migration)
legacyConfig: V -> String     // Original monolithic JSON (nullable)
```

**Key actions:** `create`, `get`, `update`, `list`, `resolve` (hydrate all referenced specs into a complete ViewConfig)

**Operational principle:** After `resolve(view: v)`, the returned config is equivalent to today's `ViewConfig` — the pipeline is the same, just assembled from independent parts.

---

### 3.2 The Query IR: QueryProgram [Q] (OPTIONAL — not needed for basic views) <!-- card:9837312f -->

> **When do you need this?** Only when you want pushdown negotiation (send part of the query to a backend), multi-backend execution, or pipeline-level analysis. For basic views that filter/sort/group in-memory, the standalone `evaluate` actions on FilterSpec/SortSpec/GroupSpec are sufficient — no QueryProgram required.

**Purpose:** Build sequences of relational operations as inspectable, composable data. A QueryProgram describes a data pipeline — source, filter, sort, group, project, limit — without executing it. Programs can be analyzed for pushdown capability, composed incrementally, and interpreted by different execution backends.

This follows the **exact same pattern** as StorageProgram (for storage) and RenderProgram (for UI). It is the third leg of Clef's program triad.

**State:**
```
programs: set Q
instructions: Q -> list String   // Serialized QueryInstruction[]
bindings: Q -> list String
terminated: Q -> Bool
readFields: Q -> set String      // Fields read (for pushdown analysis)
filterNodes: Q -> set String     // Embedded FilterNode refs
sortKeys: Q -> list String       // Embedded SortKey refs
```

**IR — QueryInstruction[]:**
```typescript
type QueryInstruction =
  | { type: "scan"; source: DataSourceConfig }
  | { type: "filter"; node: FilterNode; phase: "pre" | "post" }  // pre=WHERE, post=HAVING
  | { type: "sort"; keys: SortKey[] }
  | { type: "group"; config: GroupingConfig; aggregations: AggregationDef[] }
  | { type: "project"; fields: ProjectionField[] }
  | { type: "limit"; count: number; offset?: number }
  | { type: "enrich"; concept: string; action: string; joinField: string; bindAs: string }
  | { type: "bind"; name: string; value: unknown }      // Resolve a template variable
  | { type: "pure"; output: string }                      // Terminal
```

**Key actions:** `create`, `scan`, `filter`, `sort`, `group`, `project`, `limit`, `enrich`, `bind`, `pure`, `compose`

**Pipeline ordering invariant:**
```
Scan -> Filter(pre) -> Group -> Aggregate -> Filter(post) -> Sort -> Project -> Limit -> Pure
```
Instructions MUST follow this ordering. The concept enforces it — appending a `filter(pre)` after a `group` is an error.

**Algebraic properties:**
- Filter instructions compose via AND: `filter(a); filter(b)` is equivalent to `filter(and(a, b))`
- Sort instructions compose via concatenation: `sort([k1]); sort([k2])` is equivalent to `sort([k1, k2])`
- Project instructions compose via intersection: later project narrows earlier

**Relationship to existing IRs:**
| Clef IR | Domain | Instructions | Interpreter |
|---------|--------|-------------|-------------|
| StorageProgram | Concept handlers | get, put, del, branch, pure | ProgramInterpreter -> ConceptStorage |
| RenderProgram | Widget rendering | element, bind, aria, token, pure | RenderInterpreter -> React/Vue/Svelte |
| **QueryProgram** | **Data pipelines** | **scan, filter, sort, group, project, pure** | **QueryInterpreter -> Kernel/SQL/API** |

---

### 3.3 Coordination Concept: QueryExecution [E] <!-- card:c50a49b6 -->

**Purpose:** Registry and dispatcher for query execution backends. Manages named execution providers with capability-based routing — the data pipeline equivalent of RenderTransform's kind-based dispatch.

This follows the **exact same pattern** as RenderTransform.

**State:**
```
providers: set E
name: E -> String
kind: E -> String           // "kernel" | "sql" | "search" | "remote-api" | "in-memory"
capabilities: E -> set String
registeredKinds: set String
```

**Key actions:** `registerKind`, `register`, `execute`, `planPushdown`, `list`, `get`

**Execution flow:**
1. `planPushdown(program, provider)` — Given a QueryProgram and a provider, split the program into a **pushdown subplan** (operations the provider can handle natively) and a **residual subplan** (operations that must be evaluated client-side). Returns `{ pushdown: QueryProgram, residual: QueryProgram }`.

2. `execute(program, kind)` — Dispatch the program to the appropriate provider. The provider interprets the pushdown portion and returns raw data. The residual portion is then applied in-memory by the kernel provider (the Calcite `EnumerableConvention` fallback pattern).

**Provider interface:**
```typescript
interface QueryExecutionProvider {
  readonly name: string;
  readonly kind: string;
  readonly capabilities: Set<string>;  // "filter", "sort", "group", "project", "limit", "join"

  canHandle(instruction: QueryInstruction): boolean;
  execute(program: QueryProgram): Promise<{ rows: unknown[]; metadata: ExecutionMetadata }>;
}
```

**Built-in providers:**
| Provider | Kind | Capabilities | Description |
|----------|------|-------------|-------------|
| KernelQueryProvider | kernel | filter, sort, limit | Invokes concept actions + applies residual in-memory (current behavior) |
| InMemoryProvider | in-memory | filter, sort, group, project, limit | Pure client-side evaluation (for inlineData and small datasets) |

**Migration:** Today's ViewRenderer does `useConceptQuery → filter pipeline → display`. The kernel provider wraps this exact flow. No behavior change — just formalized as a provider.

---

### 3.4 Coordination Concept: FilterRepresentation [R] <!-- card:33779f17 -->

**Purpose:** Bidirectional conversion between authoring representations and the canonical FilterNode IR. Each representation provider satisfies lens laws (GetPut, PutGet) for round-trip fidelity.

**State:**
```
representations: set R
name: R -> String
kind: R -> String           // "toggle-group" | "text-dsl" | "url-params" | "visual-builder" | "odata"
registeredKinds: set String
```

**Key actions:** `registerKind`, `register`, `parse` (repr -> IR), `print` (IR -> repr), `canPrint` (capability check), `list`

**Provider interface (lens contract):**
```typescript
interface FilterRepresentationProvider {
  readonly name: string;
  readonly kind: string;
  readonly supportedOps: Set<ComparisonOp | "and" | "or" | "not" | "in" | "function">;

  // Forward: representation -> IR
  parse(repr: string): FilterNode;

  // Reverse: IR -> representation (may fail if IR uses unsupported ops)
  print(node: FilterNode): string | null;

  // Capability: can this provider faithfully represent this IR?
  canPrint(node: FilterNode): boolean;
}
```

**Lens laws (tested as invariants):**
- **GetPut:** `parse(print(ir)) == normalize(ir)` — round-trip preserves semantics
- **PutGet:** `print(parse(repr)) == prettyPrint(repr)` — stable formatting after normalization

**Built-in providers:**
| Provider | Kind | Description |
|----------|------|-------------|
| ToggleGroupProvider | toggle-group | Today's toggle-group filter UI (bidirectional with `{ type: "in" }` nodes) |
| ContextualProvider | contextual | Today's contextual filters (bidirectional with `{ type: "param" }` nodes) |
| UrlParamsProvider | url-params | Serialize/deserialize FilterNode to/from URL query params |
| TextDslProvider | text-dsl | Human-readable text DSL (future — Todoist-style) |

---

## 4. Sync Wiring

Syncs connect the independent concepts into the view pipeline.

### 4.1 View Resolution Pipeline <!-- card:62ea1bb5 -->

```
sync ViewResolve {
  when ViewShell/resolve -> ok(view, dataSourceId, filterId, sortId, groupId, projectionId, presentationId)
  then DataSourceSpec/get(name: dataSourceId)
   and FilterSpec/get(name: filterId)
   and SortSpec/get(name: sortId)
   and GroupSpec/get(name: groupId)
   and ProjectionSpec/get(name: projectionId)
   and PresentationSpec/get(name: presentationId)
}
```

### 4.2 Query Compilation <!-- card:6963ef4c -->

```
sync CompileQuery {
  when ViewShell/resolve -> ok(...)
  where DataSourceSpec/get -> ok(source)
    and FilterSpec/get -> ok(filter)
    and SortSpec/get -> ok(sort)
    and GroupSpec/get -> ok(group)
    and ProjectionSpec/get -> ok(projection)
  then QueryProgram/create(program: viewId)
   and QueryProgram/scan(program: viewId, source: source.config)
   and QueryProgram/filter(program: viewId, node: filter.tree, phase: "pre")
   and QueryProgram/group(program: viewId, config: group.grouping, aggregations: group.aggregations)
   and QueryProgram/sort(program: viewId, keys: sort.keys)
   and QueryProgram/project(program: viewId, fields: projection.fields)
   and QueryProgram/pure(program: viewId, output: "ready")
}
```

### 4.3 Query Execution <!-- card:cf24bcab -->

```
sync ExecuteQuery {
  when QueryProgram/pure -> ok(program)
  then QueryExecution/execute(program: program, kind: "kernel")
}
```

### 4.4 Filter Composition (multi-source) <!-- card:2b4bedb2 -->

```
sync ComposeFilters {
  when FilterSpec/bind -> ok(boundFilter)
  where FilterSpec/get(name: "system-tenant-filter") -> ok(tenantFilter)
    and FilterSpec/get(name: "user-interactive-filter") -> ok(userFilter)
  then FilterSpec/compose(a: tenantFilter, b: boundFilter)
   and FilterSpec/compose(a: composed, b: userFilter)
}
```

### 4.5 Representation Sync (bidirectional) <!-- card:c109cf7b -->

```
sync FilterFromDSL {
  when FilterRepresentation/parse -> ok(filterNode)
  then FilterSpec/create(name: generated, tree: filterNode)
}

sync FilterToDSL {
  when FilterSpec/update -> ok(filter)
  then FilterRepresentation/print(node: filter.tree, kind: "text-dsl")
}
```

---

## 5. How It Fits in clef-base

### 5.1 Migration Strategy

**Phase A — Standalone IRs + evaluate (immediate value)** <!-- card:ae04e780 -->
- Create FilterSpec, SortSpec, GroupSpec, ProjectionSpec concepts with `evaluate` actions
- Generate seeds from existing embedded JSON
- ViewRenderer calls `FilterSpec/evaluate` and `SortSpec/evaluate` instead of inline JS filter/sort logic
- **This alone makes filters reusable, testable, and composable** — no pipeline needed

**Phase B — ViewShell + seed migration** <!-- card:d03cd150 -->
- Create ViewShell concept that references child specs by ID
- Convert existing View seeds to ViewShell format
- ViewRenderer gains a `resolve` path: if ViewShell has child spec references, hydrate them; if only `legacyConfig`, parse JSON as before
- Both paths produce the same internal `ViewConfig` shape — zero visual change

**Phase C — Representation providers** <!-- card:a3d69420 -->
- Add FilterRepresentation providers for URL params (shareable filter links)
- Add text DSL provider for power users
- The toggle-group UI becomes one representation among many

**Phase D — QueryProgram integration (optional, when needed)** <!-- card:189fb92c -->
- Introduce QueryProgram only when pushdown or multi-backend execution is needed
- Replace the inline pipeline in ViewRenderer with QueryProgram compilation + KernelQueryProvider
- This is a performance/capability upgrade, not a prerequisite

### 5.2 Seed Data Shape (after migration)

```yaml
# FilterSpec seeds
- name: content-schema-filter
  tree: '{"type":"true"}'
  sourceType: interactive
  fieldRefs: '["schemas"]'
  parameters: '[]'

# SortSpec seeds
- name: default-name-sort
  keys: '[{"field":"node","direction":"asc"}]'

# ProjectionSpec seeds
- name: content-list-fields
  fields: '[{"key":"node","label":"Name"},{"key":"schemas","label":"Schemas","formatter":"schema-badges"}]'

# PresentationSpec seeds
- name: content-table
  displayType: table
  options: '{}'
  displayModePolicy: use
  defaultDisplayMode: table-row

# ViewShell seeds
- name: content-list
  title: Content
  description: Browse all content entities in the system.
  dataSource: content-list-source
  filter: content-schema-filter
  sort: default-name-sort
  projection: content-list-fields
  presentation: content-table
  interaction: content-list-controls
```

### 5.3 Runtime Pipeline — Lightweight Path (Phase A/B, no QueryProgram)

```
ViewShell/resolve("content-list")
  |
  v
Parallel fetch: DataSourceSpec + FilterSpec + SortSpec + GroupSpec + ProjectionSpec + PresentationSpec
  |
  v
DataSourceSpec/bind → useConceptQuery(concept, action, params) → raw rows
  |
  v
FilterSpec/evaluate(rows) → filtered rows        ← standalone IR, no pipeline
  |
  v
SortSpec/evaluate(rows) → sorted rows            ← standalone IR, no pipeline
  |
  v
GroupSpec/evaluate(rows) → grouped rows           ← standalone IR, no pipeline
  |
  v
PresentationSpec → display type component (TableDisplay, etc.)
  |
  v
DisplayModeRenderer (if displayModePolicy = "use")
```

This is functionally identical to today's ViewRenderer pipeline, but with each step backed by an independent, testable, composable concept instead of inline JS.

### 5.4 Runtime Pipeline — Full QueryProgram Path (Phase D, when needed)

```
ViewShell/resolve("content-list")
  |
  v
Sync: CompileQuery → QueryProgram = [scan, filter, sort, project, pure]
  |
  v
Sync: ExecuteQuery → QueryExecution/planPushdown
  |
  v
KernelQueryProvider:
  pushdown: scan (concept action invocation)
  residual: filter + sort + project (in-memory via standalone evaluate)
  |
  v
Result rows → PresentationSpec → display component
```

The full pipeline is an optimization that enables pushdown negotiation. It's not needed until views query backends that can natively handle filter/sort operations (SQL, Elasticsearch, etc.).

---

## 6. Concepts NOT Created (and why)

| Proposed in Research | Decision | Reason |
|---------------------|----------|--------|
| ExpressionSpec (shared expression tree) | **Defer** | FilterNode IS the expression tree. Making it a separate concept adds indirection without immediate benefit. Revisit if computed columns need the same expression IR. |
| BindingSpec (template variables) | **Absorbed into DataSourceSpec** | Template variable resolution is tightly coupled to data source params. A separate concept adds lifecycle overhead for 5 use-sites. |
| AggregationSpec | **Absorbed into GroupSpec** | Aggregations are meaningless without a grouping context. Keeping them together matches SQL semantics and reduces sync count. |
| FormatterProviderCoordination | **Defer** | Current formatters are a finite, stable set of pure functions. Provider pattern is overkill until domain-specific formatters or locale-aware formatting is needed. |
| PresentationProviderCoordination | **Defer** | WidgetResolver already provides this. Formalizing it as a coordination concept can happen when multi-platform rendering is needed. |

---

## 7. Relationship to Existing Clef Concepts

| Existing Concept | Relationship |
|-----------------|-------------|
| **StorageProgram** | Architectural sibling — QueryProgram follows the identical pattern (inspectable instruction sequence + interpreter + providers) for the data pipeline domain |
| **RenderProgram** | Architectural sibling — QueryProgram's output feeds into RenderProgram's input (query results become widget data bindings) |
| **RenderTransform** | Pattern template — QueryExecution follows the same coordination + kind-based provider dispatch; FilterRepresentation follows the same pattern for authoring surfaces |
| **Lens** | Used by FilterRepresentation providers for typed, composable field references within filter expressions; also the theoretical basis for bidirectional representation contracts |
| **ProgramAnalysis / Providers** | QueryProgram gets its own analysis providers: pushdown analysis (which operations can a backend handle?), field usage analysis (which fields are referenced?), filter normalization (CNF/DNF) |

---

## 8. New Concept Count Summary <!-- card:c6eb4099 -->

| Concept | Type | Suite |
|---------|------|-------|
| FilterSpec | Configuration | view (new suite) |
| SortSpec | Configuration | view |
| GroupSpec | Configuration | view |
| ProjectionSpec | Configuration | view |
| DataSourceSpec | Configuration | view |
| PresentationSpec | Configuration | view |
| InteractionSpec | Configuration | view |
| ViewShell | Composition | view |
| QueryProgram | IR (free monad) | view |
| QueryExecution | Coordination + providers | view |
| FilterRepresentation | Coordination + providers | view |

**Total: 11 new concepts, 1 new suite, ~8 syncs**

---

## 9. Open Questions <!-- card:7706da84 -->

1. **Should QueryProgram live in `specs/monadic/` alongside StorageProgram, or in a new `specs/view/` directory?** Argument for monadic: it follows the same free monad pattern. Argument for view: it's domain-specific to the view pipeline.

2. **How deep should pushdown analysis go for the KernelQueryProvider?** Currently the kernel returns all records and filtering is client-side. Should concept actions grow a filter/sort protocol, or is in-memory evaluation sufficient at current scale?

3. **Should FilterRepresentation providers be concepts or plain TypeScript provider classes?** The RenderTransform pattern makes providers into concepts wired by syncs. But representation providers are simpler — they're pure functions (parse/print) with no state.

4. **Derived views:** The research proposes derived concepts (`.derived` files) for named compositions like "Today Tasks Board". Should these be standard Clef derived concepts, or is ViewShell's reference-based composition sufficient?
