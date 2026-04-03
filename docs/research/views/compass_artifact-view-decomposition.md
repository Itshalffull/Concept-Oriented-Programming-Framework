# Decomposing views into composable concepts with intermediate representations

**A monolithic "View" is not a single concept — it is a composition of at least six independent concepts (Filter, Sort, Group, Query, Display, Field), each with its own intermediate representation, wired together via declarative syncs.** This decomposition is not merely architectural preference: it is empirically validated by every major data-driven application studied — Notion, Airtable, AG Grid, TanStack Table, SharePoint, Salesforce, Tableau, and Power BI all independently converge on the same separation. The key enabling insight is that each concept's IR can be modeled as a node in an algebraic structure (typically a monoid), and bidirectional mappings between the IR and concrete formats follow the LLVM-style **M+N pattern** — M frontends and N backends connected through a canonical intermediate form, avoiding M×N bespoke translations.

Daniel Jackson's Concept Design framework provides the theoretical grounding: each concept has private state, defined actions, and an operational principle. Concepts compose through **syncs** — declarative action synchronizations — not direct procedure calls. The resulting system achieves radical independence: any concept can be developed, tested, serialized, and swapped in isolation.

---

## The universal decomposition every system converges on

Every data-driven view system studied — from spreadsheet-derived tools to enterprise platforms to headless UI libraries — decomposes into the same six independent concerns. AG Grid separates these as distinct JSON state objects (`filterModel`, `sortModel`, `columnState`). TanStack Table implements them as independent state slices with separate `onChange` handlers. SharePoint CAML serializes them as separate XML elements (`<Where>`, `<OrderBy>`, `<GroupBy>`, `<ViewFields>`). Notion's API accepts `filter` and `sorts` as independent parameters. The convergence is striking.

The minimal decomposed view, expressed as a type, looks like this across all systems:

```typescript
interface DecomposedView {
  filter: FilterIR | null;           // Which records pass (boolean predicate tree)
  sorts: SortIR[];                   // Record ordering (ordered sort key array)
  groupBy: GroupIR | null;           // Record clustering (dimensions + aggregations)
  visibleFields: FieldVisibility[];  // Which fields shown, in what order
  displayType: DisplayIR;            // How to render (table/board/calendar/...)
  pagination: PaginationIR;          // Row limit and offset
}
```

A "view" is simply a **named, saved composition** of these independent configurations, all operating on a shared underlying dataset. The data is never duplicated — only the lens changes. This pattern enables multiple views of the same data, view configuration portability, independent state persistence, and modification of any single concern without affecting others.

The processing pipeline is consistent across all systems studied: **Source → Filter(pre) → Group → Aggregate → Filter(post) → Sort → Limit → Render**. SQL's distinction between WHERE (pre-aggregation) and HAVING (post-aggregation) is the formalization of this pipeline ordering. PRQL elegantly unifies both under a single `filter` keyword, letting pipeline position determine semantics.

---

## Filter IR: the most critical and well-studied intermediate representation

The filter predicate is the most extensively formalized concept. The relational algebra selection operator **σ** provides the theoretical foundation: `σ_condition(R)` returns tuples satisfying a propositional formula using comparisons and logical connectives. Every filter system studied — from databases to productivity apps to UI frameworks — converges on the same fundamental AST structure: **Comparison nodes** (field + operator + value) composed via **Logical nodes** (AND/OR/NOT). The differences across systems are purely syntactic.

**LINQ expression trees** represent the closest existing realization of a provider-agnostic filter IR. Microsoft's `System.Linq.Expressions` namespace defines an immutable tree with `BinaryExpression` (comparisons, AND/OR), `MemberExpression` (field access), `ConstantExpression` (literals), and `UnaryExpression` (NOT). The `IQueryProvider` interface enables different backends — Entity Framework generates SQL, the MongoDB driver generates BSON queries — from the same expression tree. The `ExpressionVisitor` base class provides the traversal mechanism. LINQ's key limitation is .NET specificity and lack of native JSON serialization.

**JSONLogic** offers a language-agnostic alternative: every rule is a JSON object with one key (the operator) and an array of operands. Field access uses `{"var": "path.to.field"}` with dot notation. Logical composition: `{"and": [...]}`, `{"or": [...]}`, `{"!": [...]}`. Implementations exist in 10+ languages. Its weakness is the absence of a formal spec, limited type system, and no native date/time handling.

Across all systems studied, these comparison operators are universal: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn`, `contains`, `startsWith`, `endsWith`, `exists`, `isNull`. The logical combinators `AND`, `OR`, `NOT` appear in every system without exception. The proposed canonical Filter IR synthesizes the best properties of each system:

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

type ComparisonOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
type Literal = string | number | boolean | null | Date
```

This design takes **JSONLogic's JSON-native serialization**, **LINQ's typed node hierarchy with visitor support**, **MongoDB's implicit-AND conciseness**, **Prisma/Hasura's self-referential nesting**, and **NSPredicate's clean ComparisonPredicate/CompoundPredicate class hierarchy**. The JSON serialization format follows the `{"and": [{"field": "age", "op": "gte", "value": 18}, ...]}` pattern, where logical combinators wrap arrays and leaf nodes specify field-operator-value triples.

Database internals inform optimization: query planners convert filter trees to **Conjunctive Normal Form** (AND of ORs) for index selection and predicate pushdown, or **Disjunctive Normal Form** (OR of ANDs) when each disjunct maps to a separate index scan path. The IR should support normalization to both forms. Polars demonstrates predicate pushdown at the IR level — pushing filters through the plan into Parquet row-group skipping via min/max metadata.

---

## Sort and group IRs follow algebraic patterns

**Sort specifications are universally an ordered array** of `{field, direction}` objects. TanStack Table uses `ColumnSort = { id: string; desc: boolean }` with `SortingState = ColumnSort[]`. AG Grid uses `{ colId: string; sort: 'asc' | 'desc' }`. SQL uses `ORDER BY col1 ASC, col2 DESC`. The consensus is total.

Sort keys form a **monoid under concatenation**: the binary operation appends sort keys (lexicographic composition), and the identity element is the empty array (natural order). This monoid is **not commutative** — `[sortByName, sortByDate] ≠ [sortByDate, sortByName]` — which distinguishes it from the filter monoid. Sort stability is essential for composition: a stable sort preserves relative order of equal elements, enabling multi-key sorts through sequential single-key stable sorts (the radix sort principle).

Each sort key carries its own **collation** (the Unicode Collation Algorithm handles locale-specific ordering across four sensitivity levels: base, accent, case, variant) and **null positioning** (NULLS FIRST/LAST, independent of sort direction). The proposed Sort IR:

```typescript
interface SortSpec {
  keys: Array<{
    field: string;
    direction: "asc" | "desc";
    nulls?: "first" | "last" | "auto";
    collation?: { locale?: string; sensitivity?: "base"|"accent"|"case"|"variant";
                  numeric?: boolean };
  }>;
}
// Monoid: identity = { keys: [] }, combine = (a, b) => { keys: [...a.keys, ...b.keys] }
```

**Grouping is the most complex concept** because it entangles three sub-concerns: which fields to group by (dimensions), what to compute per group (aggregations), and how to arrange the output (layout). The relational algebra **γ operator** formalizes the first two: `γ_{A1,A2,f1(B1)→C1}(R)` partitions tuples by A1,A2 and applies aggregation f1 to B1 in each partition. SQL's GROUP BY extensions — **ROLLUP** (hierarchical subtotals, N+1 grouping sets), **CUBE** (all 2^N combinations), and **GROUPING SETS** (explicit specification) — generalize basic grouping for reporting.

The critical distinction between **WHERE and HAVING** maps to pre-aggregation vs. post-aggregation filtering. A composable system must model this: filters contributed before the group step become WHERE clauses; filters after become HAVING. Tableau's shelf metaphor makes this tangible — dimensions on Row/Column shelves determine GROUP BY, measures determine aggregations, and the Filters shelf controls WHERE.

**Kanban/board-style grouping** is structurally identical to tabular grouping but with a positional layout constraint (2D grid) and **mutability semantics** (drag-and-drop changes the grouping field's value). The Group IR must support both tabular and board arrangements, plus pivot table semantics (row fields, column fields, value fields — as in Excel's PivotTable model and Pandas' `pivot_table()` API):

```typescript
interface GroupSpec {
  grouping: { type: "basic"; fields: string[] }
           | { type: "rollup"; fields: string[] }
           | { type: "cube"; fields: string[] }
           | { type: "grouping_sets"; sets: string[][] };
  aggregations: Array<{
    function: "count"|"sum"|"avg"|"min"|"max"|"array_agg"|string;
    field?: string;  // null for COUNT(*)
    alias: string;
    distinct?: boolean;
    filter?: FilterNode;  // Per-aggregation filter (SQL FILTER WHERE)
  }>;
  having?: FilterNode;  // Post-aggregation filter
}
```

---

## Query and data source IRs: Calcite, Substrait, and the relational core

The Query/DataSource IR represents the complete pipeline from source to result. Two systems dominate this space: **Apache Calcite** and **Apache Substrait**.

**Apache Calcite** provides a JVM-based framework where all queries are represented as immutable `RelNode` trees: `LogicalTableScan`, `LogicalFilter`, `LogicalProject`, `LogicalJoin`, `LogicalAggregate`, `LogicalSort`. Expressions within operators use `RexNode` types (`RexInputRef` for field references by ordinal, `RexLiteral` for constants, `RexCall` for operators). The `RelBuilder` offers a stack-based fluent API: `builder.scan("EMP").filter(...).project(...).sort(...).build()`. Calcite's **adapter pattern** is the key innovation for multi-backend support: each data source defines a `Convention` and provides convention-specific `RelNode` subclasses (e.g., `CassandraFilter`, `JdbcProject`). Planner rules convert logical operators into backend-specific physical operators through cost-based optimization. When an adapter cannot handle an operation, Calcite falls back to `EnumerableConvention` — an in-memory execution engine. This **graceful degradation** pattern is essential for any multi-provider system. Calcite powers Hive, Flink, Druid, Phoenix, and dozens of other systems.

**Apache Substrait** is Calcite's language-agnostic successor — a cross-language specification using Protocol Buffers for serialization. Its relation types (`ReadRel`, `FilterRel`, `ProjectRel`, `SortRel`, `AggregateRel`, `JoinRel`, `FetchRel`, `SetRel`) mirror Calcite's logical operators but are defined as protobuf messages rather than Java classes. Substrait's producer/consumer ecosystem includes Ibis (Python) as a producer and DuckDB, DataFusion (Rust), Acero (Arrow C++), and Velox (Meta) as consumers — demonstrating the **one plan, multiple engines** vision. The `substrait-mlir-contrib` project integrates Substrait with LLVM's MLIR, enabling compiler-grade optimizations (CSE, dead code elimination, pushdown) on query plans.

**PRQL** (Pipelined Relational Query Language) demonstrates a more composable surface syntax. Its linear pipeline — `from → filter → derive → group → aggregate → sort → take` — maps directly to relational algebra but avoids SQL's inside-out nesting. Each transform is an independent, orthogonal stage. PRQL compiles to SQL via an internal IR, targeting PostgreSQL, MySQL, SQLite, DuckDB, and others. The insight: **PRQL's pipeline is the ideal user-facing API for composable query construction**, while Calcite/Substrait provide the internal optimization and execution layer.

**LINQ's IQueryable** demonstrates how to expose this in a host language: chained `.Where().OrderBy().GroupBy().Select()` calls build an expression tree incrementally via deferred execution. The `IQueryProvider` interface translates the accumulated tree to the target backend. The conditional composition pattern — `if (needsSort) query = query.OrderBy(...)` — is exactly what a view system needs.

**SQL AST libraries** provide the parsing layer: `sqlparser-rs` (Rust, used by DataFusion/Polars), `sqlglot` (Python, 31+ dialects with transpilation), `libpg_query` (PostgreSQL's parser as a library). SQLGlot is particularly notable for its **single unified AST representing the superset of all SQL dialects**, enabling dialect-to-dialect transpilation through a canonical intermediate form.

---

## Display and field configuration are the presentation layer

**Display/Layout IR** uses a discriminated union keyed on view type. All view archetypes share universal cross-view configuration (filter, sort, group, field visibility), but each archetype requires type-specific field mappings: a **board view requires a grouping field**, a **calendar view requires a date field**, a **timeline requires start and end dates**, a **chart requires axis field mappings**. Notion's API formalizes this clearly — each view's `configuration` object has a `type` discriminant that determines which additional properties are valid.

Dashboard layout follows the **grid positioning** model pioneered by Grafana (24-column grid) and react-grid-layout: items are positioned with `{x, y, w, h}` on an N-column grid, with responsive breakpoint overrides. Grafana's panel model cleanly separates the **data query** (`targets`), **field configuration** (`fieldConfig` with units, thresholds, overrides), and **visualization options** (`options` with legend, tooltip settings) — three independent concerns per panel.

**Field/Column Configuration IR** must separate **definition** (schema-level: field type, validation, options) from **state** (runtime: width, visibility, sort state, pinned position). AG Grid formalizes this as `ColDef[]` vs. `ColumnState[]`, with `applyColumnState()` modifying runtime state without replacing definitions. TanStack Table achieves the same separation through `ColumnDef` (data access + display config) vs. independent state slices (`VisibilityState`, `ColumnOrderState`).

The field type system should follow the **discriminated union** pattern observed in both Airtable and Notion: a `type` field determines the available type-specific options. **31 distinct field types** appear across the surveyed systems, but they cluster into families: text types (single-line, multi-line, rich text), numeric types (number, currency, percent, rating, duration), temporal types (date, datetime, created_time, last_edited_time), categorical types (select, multi-select, status), relational types (relation, rollup, lookup, count), identity types (person, email, URL, phone), and computed types (formula, auto_number). The formatter layer is separate from the data type: a number field renders differently as currency ($1,234.56), percentage (12%), or plain (1234.56), governed by locale-aware `Intl.NumberFormat` and `Intl.DateTimeFormat` APIs.

---

## Two-way mapping follows the LLVM M+N pattern

The bidirectional mapping between IR and concrete formats is the engineering core of this architecture. The **LLVM analogy** is precise: LLVM IR sits between M frontends (Clang, rustc, Swift) and N backends (x86, ARM, WASM), achieving **M+N implementations instead of M×N**. Optimizations at the IR level benefit all language/target combinations. For a Filter IR, the pattern is: M source formats (Todoist DSL, Notion API, Airtable formula, user input) compile **to** the IR, and N target formats (SQL WHERE, MongoDB query, Elasticsearch bool, OData $filter, GraphQL where) compile **from** the IR.

The **Visitor pattern** is the universal mechanism for IR→concrete translation. SQLAlchemy uses a `Compiler` class hierarchy where each dialect subclass (`PGCompiler`, `MySQLCompiler`) overrides `visit_*` methods. SQLGlot uses `TRANSFORMS` dictionaries mapping expression types to generator functions. Calcite uses `RelOptRule` implementations that convert logical operators to convention-specific physical operators. Prisma's Quaint library uses the same pattern: a generic SQL AST with dialect-specific visitors (`Postgres::build()`, `Mysql::build()`, `Sqlite::build()`).

For the **reverse direction** (concrete→IR), the approach depends on the source format. For structured formats (JSON-based like Notion filters, MongoDB queries, Elasticsearch DSL), parsing is straightforward tree transformation. For text-based formats (SQL WHERE, OData $filter, Todoist DSL), a parser produces an AST that maps to the IR. SQLGlot demonstrates the complete round-trip: `parse_one(sql, dialect="spark")` produces an AST, and `.sql(dialect="duckdb")` generates target SQL.

**Lens theory** from functional programming provides the mathematical foundation for round-trip correctness. A lens is a pair of functions — `get: Source → View` and `put: View × Source → Source` — satisfying two laws: **GetPut** (if the view hasn't changed, the source shouldn't change) and **PutGet** (updates must be reflected in the view). Van Laarhoven lenses compose with ordinary function composition, enabling deeply nested access. The critical insight for IR mapping: when converting a rich native format to a simplified IR, **information is lost**. The backward mapping (IR→native) needs supplementary context — the lens `put` function takes both the new view AND the original source. In practice, this means the IR should carry a `metadata` field for preserving provider-specific hints needed for faithful reconstruction.

The concrete **provider interface** synthesizes patterns from Calcite (capability declaration and graceful degradation), SQLAlchemy (parameterized output), Prisma (dialect visitors), and lens theory (round-trip metadata):

```typescript
interface FilterProvider<TNative> {
  readonly name: string;
  readonly capabilities: Set<ComparisonOp | "and" | "or" | "not" | "in" | "contains" | ...>;

  // Forward: IR → native format
  compile(filter: FilterNode): TNative;

  // Reverse: native format → IR (may carry metadata for round-trip fidelity)
  decompile(native: TNative): FilterNode;

  // Capability check: can this provider handle this specific filter?
  canHandle(filter: FilterNode): boolean;
}
```

Each concept (Filter, Sort, Group, Query) has its own provider interface. A `SqlFilterProvider` compiles `FilterNode` to a SQL WHERE clause string with parameters. A `MongoFilterProvider` compiles to a MongoDB query document. A `NotionFilterProvider` compiles to Notion's API filter format. The provider declares which operations it supports; unsupported operations trigger client-side fallback evaluation (the Calcite `EnumerableConvention` pattern).

---

## Algebraic composition and concept syncs

The composability of this architecture rests on algebraic properties. Filter predicates form a **Boolean algebra** — a complemented distributive lattice with AND (meet), OR (join), NOT (complement), TRUE (top/identity for AND), and FALSE (bottom/identity for OR). Key properties: commutativity (`A AND B = B AND A`), associativity, distributivity, De Morgan's laws, and **idempotency** (`A AND A = A` — applying the same filter twice equals applying it once). This means filter fragments from independent sources — tenant filter, user-specified filter, permission filter, search filter — compose freely via AND:

```
finalFilter = tenantFilter AND userFilter AND permissionFilter AND searchFilter
```

Order doesn't matter (commutativity). Grouping doesn't matter (associativity). Redundant filters are absorbed (idempotency). The identity element TRUE means absent contributions are no-ops. This is the **Filter monoid** under AND.

Sort specifications form a **monoid under concatenation** (lexicographic composition). The identity is the empty array. Unlike filters, sorts are **not commutative** — primary key order matters. The stability guarantee ensures that within groups of equal primary keys, secondary ordering is preserved.

These monoid structures enable the **Composite pattern** identified by Mark Seemann: an interface forms a Composite if and only if all method return types are monoids. Since each view concept returns a monoidal value, the entire view is a composite of independently-contributed fragments.

Daniel Jackson's **concept design** framework formalizes the composition mechanism. Each concept (Filter, Sort, Group, Display, Field) has private state and defined actions. Concepts compose through **syncs** — declarative synchronizations: "when `Filter.filtersChanged` or `Sort.sortChanged` or `Group.groupChanged`, recompute the pipeline." Crucially, concepts never call each other directly. They communicate only through syncs, maintaining radical independence.

Modern **reactive signals** (Angular Signals, SolidJS, Svelte runes) provide the implementation mechanism for syncs. The view is naturally modeled as **derived state**: `viewResult = computed(() => pipeline(filterState(), sortState(), groupState(), displayState(), rawData()))`. When any input signal changes, the view automatically recomputes with fine-grained reactivity — only the specific stages affected by the change are re-evaluated.

The **Reader monad** pattern enables injecting shared context (current data source, tenant ID, user permissions) into the pipeline without threading it explicitly through every stage. PRQL demonstrates this: its pipeline `from → filter → group → sort → take` is a composition of independent transforms, each receiving context implicitly.

---

## Concrete recommendations for implementation

Based on the full body of research, these are the concrete design recommendations for implementing the decomposed view system:

- **Use the LINQ-style deferred composition pattern** for building queries. Chain `.filter().sort().group().select()` calls that build an IR tree incrementally, with materialization deferred until execution. This is the most ergonomic API for application code and matches PRQL's pipeline model.

- **Adopt Substrait's protobuf-based serialization** for the Query IR when cross-language support is needed. For JavaScript/TypeScript-only systems, JSON serialization of the AST (following the JSONLogic-inspired format for filters) is sufficient and more debuggable.

- **Implement the Calcite adapter pattern** for multi-backend support. Each provider declares capabilities, the planner pushes supported operations to the provider, and unsupported operations fall back to client-side evaluation. Track which operations were pushed down vs. evaluated client-side in compilation metadata.

- **Model filters as a Boolean algebra monoid (AND, TRUE)** to enable composition from independent sources. Model sorts as a concatenation monoid. Model field visibility as a set intersection. These algebraic properties ensure that independently-contributed fragments compose predictably.

- **Separate field definition from field state** (the AG Grid ColDef/ColumnState pattern). Definitions are schema-level (what fields exist, their types, validation rules). State is runtime-level (current width, visibility, sort direction, filter values). Views store only state references, not copies of definitions.

- **Use discriminated unions for type-specific configuration** in both field types and view types. A `type` discriminant determines which additional properties are valid. This is the pattern used by Notion, Airtable, and AG Grid, and it provides the best balance of type safety and extensibility.

- **Apply lens laws for round-trip correctness** when implementing bidirectional providers. The GetPut law (serialize then deserialize = identity) and PutGet law (deserialize then serialize = identity) should be property-tested for every provider. Carry provider-specific metadata in the IR for information that would otherwise be lost in translation.

- **Distinguish pre-aggregation and post-aggregation filters** explicitly in the IR, following PRQL's approach: a single `filter` concept whose pipeline position determines whether it generates SQL WHERE or HAVING. The pipeline ordering `Filter(pre) → Group → Aggregate → Filter(post) → Sort → Limit` must be a first-class part of the query IR.

The resulting architecture achieves the COPF pattern's goal: each concept is independently developable, testable, serializable, and swappable. A Filter concept can be unit-tested with an in-memory provider. A Sort concept can be developed without knowing anything about filtering. The shell View concept is a pure composition — a named bundle of concept states wired together by syncs — with no logic of its own beyond orchestrating the pipeline. This decomposition is not theoretical; it is the empirically validated architecture of every major data-driven application built in the last decade.