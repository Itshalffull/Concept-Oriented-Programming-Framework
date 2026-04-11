---
name: create-view-query
description: Design and compose view query pipelines using the decomposed view suite — QueryProgram, FilterSpec, SortSpec, GroupSpec, ProjectionSpec, DataSourceSpec, PresentationSpec, ViewShell, FilterRepresentation, QueryExecution, and RemoteQueryProvider. Use when building data-driven views, configuring filters/sorts/groups, or wiring query execution.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<view-name or query-pipeline-description>"
---

# Create a View Query Pipeline

Design and compose a data-driven view query pipeline for **$ARGUMENTS** using the decomposed view suite concepts.

## What is the View Query System?

The view suite decomposes a rendered view into independent, composable configuration concepts. Instead of a monolithic "view" object, each concern — filtering, sorting, grouping, projection, data sourcing, presentation — is its own concept with its own actions, state, and invariants. These are composed through syncs into a **QueryProgram** — an inspectable, optimizable instruction sequence.

```
DataSourceSpec  FilterSpec  SortSpec  GroupSpec  ProjectionSpec  PresentationSpec
     │              │          │         │            │                │
     └──────────────┴──────────┴─────────┴────────────┴────────────────┘
                                    │
                            [view-resolve.sync]
                                    │
                                ViewShell (assembled config)
                                    │
                            [compile-query.sync]
                                    │
                              QueryProgram
                        (scan → filter → sort → group → project → pure)
                                    │
                            [execute-query.sync]
                                    │
                              QueryExecution
                        (kernel / in-memory / remote / federated)
                                    │
                                Results
```

## The Concepts

### Configuration Layer (required)

| Concept | Type Param | Purpose |
|---------|-----------|---------|
| **FilterSpec [F]** | filter | Named reusable predicate trees with field reference analysis. Supports algebraic composition (AND trees), normalization to CNF/DNF, and runtime parameter substitution. |
| **SortSpec [S]** | sort | Ordered sort key management. Composition is NOT commutative (primary + secondary for tiebreaking). Identity sort: empty key array `[]`. |
| **GroupSpec [G]** | group | Hierarchical grouping and aggregation definitions. Supports basic and advanced strategies with post-aggregation HAVING-style filtering. |
| **ProjectionSpec [P]** | projection | Field selection and formatting. Fields have key, label, visibility, formatter, computed, weight. Merge operation: overlay fields win on key conflict. |
| **DataSourceSpec [D]** | datasource | Base dataset declaration. Kinds: `concept-action`, `remote-api`, `search-index`, `inline`. Template variable substitution via `{{varName}}`. |
| **PresentationSpec [R]** | presentation | Display strategy and rendering hints. Display types are opaque strings (table, card-grid, board, graph, canvas, etc.). Manages display mode policy. |
| **InteractionSpec [I]** | interaction | Interaction bindings for row actions, bulk operations, and user controls. |
| **ViewShell [V]** | shell | Container that assembles all config specs into a resolved view configuration. The `view-resolve.sync` populates this from individual specs. |

### Coordination Layer (recommended)

| Concept | Type Param | Purpose |
|---------|-----------|---------|
| **FilterRepresentation [FR]** | filter-repr | Bidirectional filter authoring. Converts between FilterNode IR and user-facing formats: toggle-group, text-dsl, url-params, visual-builder, odata. |

### Query Execution Layer (recommended)

| Concept | Type Param | Purpose |
|---------|-----------|---------|
| **QueryProgram [Q]** | query | Composable query instruction sequences. Read instructions: create, scan, filter, sort, group, project, limit, join, pure (termination), compose (monadic bind). Write instructions: invoke (concept action dispatch via syncs), match (multi-way conditional on completion variant), traverseInvoke (batch invoke over bound set), traverse (general sub-program iteration). Programs are sealed after `pure`. Purity tracked: `pure`, `read-only`, `read-write`. |
| **QueryExecution [E]** | execution | Registry and dispatcher for execution providers. Routes to kernel, in-memory, remote, or federated backends. Supports pushdown analysis for query optimization. Coroutine-style execution for invoke instructions: yields `invoke_pending` with structured continuation, resumes via `resumeAfterInvoke`. |
| **RemoteQueryProvider [R]** | provider | External API query execution. Maps query instructions to HTTP calls via Projection. Splits programs into pushdown (API-native) and residual (in-memory). |

### Static Analysis Layer (recommended)

| Concept | Type Param | Purpose |
|---------|-----------|---------|
| **InvokeEffectProvider [T]** | invoke-effect | Extracts all concept/action pairs from invoke, traverseInvoke, and traverse instructions. Enables static authorization pre-check and impact analysis. |
| **QueryPurityProvider [R]** | purity | Classifies QueryProgram purity (pure/read-only/read-write) and extracts read fields + invoked actions. Drives caching decisions. |
| **QueryCompletionCoverage [C]** | coverage | Verifies every invoke variant has downstream handling via match. Reports uncovered variants at build time. |

## Step-by-Step Design Process

### Step 1: Identify the Data Source

Every view starts with a data source. Decide the kind:

| Kind | When to use | Example |
|------|-------------|---------|
| `concept-action` | Data comes from a kernel concept action | `ContentNode/list`, `ContentNode/listBySchema` |
| `remote-api` | Data comes from an external HTTP API | REST endpoint, GraphQL query |
| `search-index` | Data comes from a search index | Full-text search, faceted search |
| `inline` | Static data embedded in the config | Enum values, lookup tables |
| `encrypted-local` | E2EE data — fetch ciphertext, decrypt client-side, process locally | Encrypted content vaults |

Create a DataSourceSpec:
```
DataSourceSpec/create:
  name: "content-nodes"
  kind: "concept-action"
  config: { concept: "ContentNode", action: "list", params: {} }
```

For parameterized sources, use template variables:
```
config: { concept: "ContentNode", action: "listBySchema", params: { schema: "{{schemaId}}" } }
```

Then bind parameters at resolve time:
```
DataSourceSpec/bind:
  source: "content-nodes"
  parameters: { schemaId: "article" }
```

### CRITICAL: Schema-Scoped Data Sources

When a view shows data from a **single schema** (or a known schema filter), **always use `listBySchema` instead of `list`**. This is a major performance optimization:

| Pattern | What happens | Performance |
|---------|-------------|-------------|
| `ContentNode/list` + client-side schema filter | Fetches ALL nodes, then filters locally | Slow — full table scan |
| `ContentNode/listBySchema(schema)` | Server-side join, returns only matching nodes with schemas pre-attached | Fast — single indexed query |

**Use `listBySchema` when:**
- The view displays a single schema type (Concepts page, Syncs page, etc.)
- The schema is known at config time or derivable from context (`{{entityPrimarySchema}}`)
- You want pre-enriched results (each row includes its `schemas` array)

**Use `list` only when:**
- The view genuinely shows ALL content types (main Content page with toggle filters)
- Schema filtering is purely interactive (user toggles schema badges)

**Examples from clef-base seeds:**
```yaml
# Single schema — use listBySchema (server-side join)
- name: content-node-list-concept-source
  kind: concept-action
  config: '{"concept":"ContentNode","action":"listBySchema","params":{"schema":"Concept"}}'

# Context-derived schema — use listBySchema with template
- name: content-node-list-same-schema-source
  kind: concept-action
  config: '{"concept":"ContentNode","action":"listBySchema","params":{"schema":"{{entityPrimarySchema}}"}}'

# All content with interactive filters — use list (toggle filters run locally)
- name: content-node-list-source
  kind: concept-action
  config: '{"concept":"ContentNode","action":"list"}'
```

### Split Execution: Backend vs Local

Filters are partitioned by `sourceType` for split execution:
- **`system` + `contextual`** filters → pushed to the backend (kernel)
- **`interactive` + `search`** filters → run locally in-memory on the result

This means a view can fetch pre-filtered data from the kernel (system filters, schema scoping via `listBySchema`) and then apply toggle filters locally without round-trips. The `compile-split-query.sync` handles this partitioning automatically.

For **E2EE data** (`encrypted-local` kind), ALL processing runs locally after client-side decrypt — the kernel only handles the scan (fetch ciphertext).

### Step 2: Define Filters

Create FilterSpec instances for each filterable dimension. FilterSpec uses a **predicate tree** (FilterNode IR):

**FilterNode types:**
```json
{ "type": "eq", "field": "kind", "value": "concept" }
{ "type": "contains", "field": "name", "value": "auth" }
{ "type": "and", "children": [ ... ] }
{ "type": "or", "children": [ ... ] }
{ "type": "not", "child": { ... } }
{ "type": "gt", "field": "count", "value": 10 }
{ "type": "in", "field": "status", "value": ["active", "draft"] }
{ "type": "exists", "field": "metadata.tags" }
{ "type": "true" }   // identity (matches everything)
```

```
FilterSpec/create:
  name: "by-schema-type"
  definition: {
    name: "by-schema-type",
    tree: { type: "eq", field: "kind", value: "concept" },
    sourceType: "content-nodes"
  }
```

**Compose filters** algebraically:
```
FilterSpec/compose:
  name: "combined"
  filters: ["by-schema-type", "by-active-status"]
  // Creates an AND tree combining both predicates
```

**Normalize** for optimization:
```
FilterSpec/normalize:
  filter: "combined"
  form: "cnf"   // or "dnf"
```

**Parameterized filters** with runtime binding:
```
FilterSpec/create:
  name: "by-author"
  definition: {
    tree: { type: "eq", field: "author", value: "{{currentUser}}" },
    parameters: ["currentUser"]
  }

FilterSpec/bind:
  filter: "by-author"
  bindings: { currentUser: "alice" }
```

### Step 3: Define Sort Order

SortSpec manages ordered sort keys. **Composition is not commutative** — the first spec's keys become primary, the second's become tiebreakers.

```
SortSpec/create:
  name: "by-name-asc"
  keys: [{ field: "name", direction: "asc" }]

SortSpec/create:
  name: "by-date-desc"
  keys: [{ field: "updatedAt", direction: "desc" }]

SortSpec/compose:
  name: "name-then-date"
  primary: "by-name-asc"
  secondary: "by-date-desc"
  // Result: sort by name asc, then by updatedAt desc for ties
```

### Step 4: Define Grouping (if needed)

GroupSpec partitions records into groups with optional aggregation:

```
GroupSpec/create:
  name: "by-kind"
  config: {
    grouping: { type: "basic", keys: ["kind"] },
    aggregations: [
      { function: "count", alias: "count" },
      { function: "list", field: "name", alias: "names" }
    ],
    having: { type: "gt", field: "count", value: 1 }
  }
```

### Step 5: Define Projection

ProjectionSpec selects and formats output fields:

```
ProjectionSpec/create:
  name: "content-summary"
  fields: [
    { key: "id", label: "ID", visibility: "hidden" },
    { key: "name", label: "Name", visibility: "visible", weight: 2 },
    { key: "kind", label: "Type", visibility: "visible", formatter: "badge" },
    { key: "updatedAt", label: "Updated", visibility: "visible", formatter: "relative-date" },
    { key: "wordCount", label: "Words", visibility: "visible", computed: "body.split(' ').length" }
  ]
```

**Merge projections** for composition:
```
ProjectionSpec/merge:
  base: "content-summary"
  overlay: "admin-fields"
  // Overlay fields win on key conflict
```

### Step 6: Define Presentation

PresentationSpec chooses the display strategy:

```
PresentationSpec/create:
  name: "content-table"
  definition: {
    displayType: "table",
    hints: { striped: true, compact: false, stickyHeader: true }
  }
  policy: {
    displayModePolicy: "user-selectable",
    defaultDisplayMode: "table"
  }
```

Display types: `table`, `card-grid`, `board`, `calendar`, `canvas`, `graph`, `stat-cards`, `detail`, `list`

### Step 7: Wire into ViewShell

The `view-resolve.sync` automatically assembles individual specs into a ViewShell. You declare which specs belong to a view:

```
ViewShell/create:
  name: "content-browser"
  dataSource: "content-nodes"
  filter: "by-schema-type"
  sort: "by-name-asc"
  group: null
  projection: "content-summary"
  presentation: "content-table"
  interaction: "content-row-actions"
```

### Step 8: Compile to QueryProgram (optional)

The `compile-query.sync` builds a QueryProgram from the ViewShell:

```
ViewShell resolved
  → compile-query.sync produces:
    QueryProgram/create
    QueryProgram/scan("contentNodes", "nodes")
    QueryProgram/filter(filterNode, "filtered")
    QueryProgram/sort(sortKeys, "sorted")
    QueryProgram/project(fields, "projected")
    QueryProgram/pure("ok", "projected")
```

Four compilation variants exist:
- **CompileQuery**: scan → filter → sort → project → pure (read-only)
- **CompileQueryWithSchemaJoin**: scan → join(membership) → filter → sort → project → pure (read-only)
- **CompileQueryWithGroup**: scan → filter → group → sort → project → pure (read-only)
- **CompileActionQuery**: scan → filter → invoke/traverseInvoke → match → scan → pure (read-write, from InteractionSpec's createProgram/actionProgram)

### Step 8b: Add Invoke Instructions (for read-write views)

If the view supports inline actions (create, bulk update, etc.), add invoke instructions:

```
# Single invoke — create a record, then refresh
QueryProgram/invoke:
  program: "create-and-refresh"
  concept: "ContentNode"
  action: "create"
  input: '{"node":"new-article","kind":"concept"}'
  bindAs: "createResult"

# Multi-way match on completion variant
QueryProgram/match:
  program: "create-and-refresh"
  binding: "createResult"
  cases: '{"ok":"refresh-prog","duplicate":"dup-prog","*":"error-prog"}'
  bindAs: "final"

# Batch invoke — escalate all overdue tasks
QueryProgram/traverseInvoke:
  program: "bulk-escalate"
  sourceBinding: "overdue"
  itemBinding: "_task"
  concept: "Task"
  action: "escalate"
  inputTemplate: '{"taskId":"$_task.id"}'
  bindAs: "results"

# General traverse — per-item sub-program with error handling
QueryProgram/traverse:
  program: "bulk-archive"
  sourceBinding: "completed"
  itemBinding: "_task"
  bodyProgram: "archive-body"    # must be sealed
  bindAs: "outcomes"
  declaredEffects: '{"invokedActions":["Task/archive"]}'
```

**Purity rules:**
- Programs with only read instructions (scan, filter, sort, etc.) are `read-only`
- Programs with any invoke, traverseInvoke, or traverse-with-invoke-body are `read-write`
- `read-write` programs are never cached
- Purity is monotonic: once promoted, it never decreases

### Step 9: Execute the Query

The `execute-query.sync` dispatches sealed QueryPrograms to QueryExecution:

```
QueryExecution/execute:
  program: <sealed QueryProgram>
  provider: "kernel"   // or "in-memory", "remote", "federated"
```

For remote sources, `RemoteQueryProvider` splits the program:
```
RemoteQueryProvider/planPushdown:
  program: <QueryProgram>
  // Returns: pushdownProgram (sent to API) + residualProgram (executed in-memory)
```

### Step 10: Add Filter Representation (for UI)

FilterRepresentation converts between FilterNode IR and user-facing formats:

```
FilterRepresentation/registerKind:
  name: "toggle-group"

FilterRepresentation/parse:
  kind: "toggle-group"
  input: { selectedValues: ["concept", "sync"], field: "kind" }
  // Returns: FilterNode { type: "in", field: "kind", value: ["concept", "sync"] }

FilterRepresentation/print:
  kind: "toggle-group"
  node: { type: "in", field: "kind", value: ["concept", "sync"] }
  // Returns: { selectedValues: ["concept", "sync"], field: "kind" }
```

Supported formats: `toggle-group`, `text-dsl`, `url-params`, `visual-builder`, `odata`

## Sync Wiring Reference

| Sync | Tier | What it does |
|------|------|-------------|
| `view-resolve.sync` | required | Assembles individual specs into ViewShell |
| `compose-filters.sync` | recommended | Composes FilterSpec predicates with FilterRepresentation |
| `filter-from-dsl.sync` | optional | Parses DSL string → FilterSpec |
| `filter-to-dsl.sync` | optional | Serializes FilterSpec → DSL string |
| `compile-query.sync` | optional | Builds read-only QueryProgram from ViewShell |
| `compile-action-query.sync` | optional | Builds read-write QueryProgram from InteractionSpec's createProgram/actionProgram |
| `execute-query.sync` | optional | Dispatches sealed QueryProgram to QueryExecution |
| `execute-invoke.sync` | optional | Routes invoke_pending to Connection/invoke |
| `invoke-complete.sync` | optional | Returns invoke completion to QueryExecution for resume |
| `execute-remote-query.sync` | optional | Routes to RemoteQueryProvider |
| `compile-remote-query.sync` | optional | Compiles for remote data sources |

## Design Principles

### 1. Each Concern is Independent
FilterSpec knows nothing about SortSpec. GroupSpec knows nothing about ProjectionSpec. They compose through syncs, not imports. This means you can use FilterSpec alone without the rest of the suite.

### 2. FilterSpec is Algebraic
Filters compose via AND trees. The identity filter is `{ type: "true" }`. Composition is associative: `compose(a, compose(b, c)) = compose(compose(a, b), c)`. This enables incremental filter building in UIs.

### 3. SortSpec Composition is Ordered
Unlike filters, sort composition is NOT commutative. `compose(byName, byDate)` means "sort by name, break ties by date" — different from `compose(byDate, byName)`. This matches user mental models of "sort by X then Y."

### 4. QueryProgram is Sealed After Pure
Once `pure` is called, the program is terminated. This is the monadic return — it prevents accidental mutation of completed programs and enables safe caching/memoization.

### 5. Pushdown for Performance
RemoteQueryProvider performs pushdown analysis — sending as much of the query to the API as possible and executing the rest in-memory. This means views over REST APIs get the same composable filter/sort/group experience as local concept queries.

## Anti-Patterns

| Anti-Pattern | Why It's Wrong | Correct Approach |
|-------------|---------------|-----------------|
| Using `ContentNode/list` with client-side schema filter | Fetches ALL nodes then filters — full table scan every time | Use `ContentNode/listBySchema(schema)` in DataSourceSpec for server-side join |
| Building filters as raw JSON in handlers | Bypasses composition, normalization, and validation | Use FilterSpec/create + compose |
| Hardcoding sort order in ViewRenderer | Can't be changed by users or syncs | Use SortSpec as config entity |
| Monolithic view config objects | Can't compose, can't reuse across views | Decompose into individual spec concepts |
| Executing queries without QueryProgram | No optimization, no analysis, no caching | Compile to QueryProgram, execute via QueryExecution |
| Mixing filter logic with display logic | Coupling prevents reuse | FilterSpec for logic, FilterRepresentation for UI |
| Mutating a QueryProgram after pure | Violates the sealed invariant | Create a new program or compose two programs |
| Invoking concept actions directly from views | Bypasses sync engine, no observability | Use QueryProgram/invoke — dispatches through syncs |
| Using invoke without match for error handling | Silently drops error variants | Add match with cases for all variants |
| Not declaring .view invariants for read-write views | Purity can change silently, invoke targets can break | Add `.view` file with purity + completion coverage invariants |
| Using traverseInvoke when per-item error handling needed | Can't branch on individual item failures | Use traverse with a body sub-program containing invoke + match |

## Quick Reference: Pipeline Shapes

**Simple view** (most common):
```
DataSource → Filter → Sort → Project → Present
```

**Grouped view** (dashboards, reports):
```
DataSource → Filter → Group(aggregation) → Sort → Project → Present
```

**Joined view** (content with schema membership):
```
DataSource → Join(membership) → Filter → Sort → Project → Present
```

**Remote view** (external API):
```
DataSource(remote-api) → [planPushdown] → API call → residual Filter/Sort → Project → Present
```

**Composed view** (multiple sources):
```
QueryProgram A (scan source1 → filter → pure)
QueryProgram B (scan source2 → filter → pure)
compose(A, B) → merge → project → present
```

**Action view** (inline create/edit, read-write):
```
DataSource → Filter → invoke(Concept/action) → match(ok/error) → re-scan → Project → Present
```

**Bulk action view** (batch operations, read-write):
```
DataSource → Filter → traverseInvoke(Concept/action per item) → re-scan → Project → Present
```

**Complex action view** (per-item error handling, read-write):
```
DataSource → Filter → traverse(body: invoke → match → handle) → Project → Present
```

## View Invariants (.view files)

After building a view query pipeline, declare invariants in a `.view` manifest to get auto-generated tests:

```
view "content-list" {
  shell: "content-list"

  purpose {
    Browse all content entities with schema-based filtering and
    alphabetical sorting. Read-only — no inline write actions.
  }

  invariants {
    always "purity is read-only": {
      purity = "read-only"
    }

    always "no invoke instructions": {
      invokeCount = 0
    }

    always "projects only known fields": {
      forall f in projectedFields:
      f in ["id", "node", "kind", "name"]
    }
  }
}
```

Place `.view` files in `specs/view/views/` and register in `suite.yaml`:

```yaml
views:
  - path: ./views/content-list.view
    description: "Content listing view — read-only"
```

Generate tests:
```bash
npx tsx scripts/generate-view-tests.ts
```

See `.claude/skills/create-view-query/references/view-grammar.md` for full grammar.

## Related Skills

| Skill | When to Use |
|-------|------------|
| `/create-concept` | Design a new concept that participates in the view pipeline |
| `/create-sync` | Write syncs that wire view concepts together |
| `/create-implementation` | Implement handlers for view concepts |
| `/create-widget` | Design the UI widget that renders view results |
| `/create-derived-concept` | Compose view concepts into a named view abstraction |
| `/decompose-feature` | Break down a complex view feature into individual specs |
