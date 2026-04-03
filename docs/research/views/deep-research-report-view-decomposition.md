# Decomposing Clef Views into Composable Concepts with a Bidirectional IR Layer

## Baseline from the current clef-base Views pipeline

The current clef-base View system is explicitly designed as a data-driven “query-to-render” pipeline: **View config** (stored in-kernel), **data source** (a concept action invocation returning rows), and **display type** (a layout component such as table/card-grid/graph), with an optional **DisplayMode** layer for per-item rendering where applicable. fileciteturn0file1L8-L19

At the data model level, the View configuration is defined as a single kernel entity (concept: `View`) whose structured sub-parts are stored as **JSON strings** and parsed at render time: a `dataSource` (concept/action/params), `visibleFields`, `filters`, `sorts`, `groups`, and `controls`, plus presentation metadata like title/description and DisplayMode toggles. fileciteturn0file1L44-L58 This structure makes Views easy to seed and render, but it also makes “views as composable artifacts” difficult: filters, sorts, group rules, and field configurations are not first-class, shareable objects, and providers cannot naturally target individual sub-capabilities (e.g., “a provider for filters” vs “a provider for sorting”).

Operationally, filtering is already a multi-stage pipeline: raw data is first constrained by an optional schemaFilter embedded in `dataSource` params, then contextual filters, then interactive filters. fileciteturn0file1L301-L305 Grouping and sorting illustrate the current “partially implemented” state that motivates decomposition: grouping semantics exist, but the implementation groups by the **first** group field only (with BoardDisplay also using the first group field) and ignores the rest. fileciteturn0file1L332-L339 Sorting is acknowledged as “parsed but minimally used,” and ordering is mostly implicit in the backing concept action or group sort configuration rather than an explicit, composable sort IR. fileciteturn0file1L343-L347

Finally, display selection already has a “provider flavor”: while `layout` chooses the default display, ViewRenderer can consult a kernel `WidgetResolver` concept to recommend an alternative display component based on context. fileciteturn0file1L219-L224 That’s an important design hint: the system already benefits from separating a “what this is” abstraction (the semantic interactor/context) from “how it is rendered” (resolved widget/layout). The decomposition you’re proposing generalizes this principle across query, filter, sort, group, and display.

All of this sits inside Clef’s architectural constraints: concepts are intended to be **spec-first**, **independent**, and coordinated through syncs; multi-backend variability is commonly handled via a coordination concept + provider plugins routed through a registry. fileciteturn0file0L5-L12 fileciteturn0file0L604-L614 Those constraints strongly shape where “provider patterns” want to live in a decomposed Views architecture.

## Research synthesis on IRs for query, filter, sort, and grouping

A practical way to make filters/sorts/groups/displays individually extensible is to introduce one or more **canonical intermediate representations (IRs)** with well-defined semantics and then build translators (“providers”) around them. This is exactly how several mature ecosystems handle heterogeneous query languages and backends.

A key pattern is to represent a query as a **tree of algebraic operators** (logical plan), then transform and/or lower it to execution backends (physical plan). For example, entity["organization","Apache Calcite","query optimizer framework"] explicitly states that “every query is represented as a tree of relational operators,” and that queries can be translated from SQL to relational algebra and then optimized using semantics-preserving rewrite rules. citeturn0search3turn0search7 The Calcite architecture paper highlights adapters as the abstraction for external sources, with relational algebra at the core and an optimizer transforming plans. citeturn0search15 This is directly analogous to your goal: a canonical IR for “filter/sort/group/projection” that can be produced from many surface syntaxes and lowered to many execution targets.

A newer, explicitly interoperability-focused version of the same idea is entity["organization","Substrait","query plan ir spec"]: it defines a cross-system format for describing compute operations on structured data, designed for interoperability (essentially, a standardized query-plan IR). citeturn0search2turn0search10 Substrait is valuable for your design not because you must adopt it wholesale, but because it demonstrates several “IR hygiene” lessons for multi-provider worlds: explicit operator vocabularies, explicit type/function extension mechanisms, and a clean separation between a portable logical plan and engine-specific execution details. citeturn0search10turn0search14

Another important, battle-tested pattern is “IR as host-language AST,” exemplified by C# expression trees. entity["company","Microsoft","technology company"] documents expression trees as tree-shaped representations of code, explicitly used for analysis and translation (including visiting/modifying nodes to translate an algorithm to another environment). citeturn1search2turn1search18 This is essentially the “provider pattern” you’re describing: a single canonical IR (expression tree) enables multiple providers (LINQ providers) to translate the same abstract query into different backends.

On the “surface syntax” side—what users author—several ecosystems provide instructive building blocks:

- OData defines a standardized “query options” vocabulary ($filter, $select, $orderby, $top, $skip, $expand, etc.) intended to be applied uniformly across web APIs. citeturn1search1turn1search21 This is essentially a ready-made conceptual decomposition of “filter/sort/projection/pagination/expand,” albeit packaged as URL query options rather than as independent concepts.

- GraphQL’s core query language centers on selection sets over a typed schema and supports nested traversal; the spec describes selection sets as ordered sets of selections (fields/fragments), and GraphQL.org emphasizes fetching related data via traversal rather than multiple round trips. citeturn1search0turn1search4 This highlights an important semantic distinction for your IR design: “query” may be relational (set-oriented) or hierarchical (tree-shaped), and you may need parallel IR tracks or a unifying “shape layer” (collection vs tree vs graph).

- JSON querying standards and de facto standards (JSONPath, JMESPath) provide strong examples of compact, machine-parsable filter/projection languages shaped around JSON. JSONPath is now standardized as an entity["organization","IETF","internet standards org"] RFC, explicitly defining a string syntax for selecting/extracting JSON values. citeturn2search0 JMESPath defines a JSON query language with well-specified evaluation behavior. citeturn2search3turn2search7

- File search queries show “user-facing filters” that are not obviously database-like but still map to a predicate/projection notion. Windows Search Advanced Query Syntax (AQS) is documented by Microsoft as the default query syntax used to query the index and refine/narrow search parameters. citeturn2search5turn2search1

- Finally, your motivating example—task filtering DSLs—is well illustrated by entity["company","Todoist","task manager app"], which explicitly frames filters as “custom views of your tasks using specific query syntaxes” and supports composed boolean queries (and/or). citeturn1search3turn1search15

Taken together, these sources support a pragmatic research conclusion: the most interoperable approach is to define (at least) one canonical **logical query IR** (operators + expressions) and then treat authoring syntaxes (Todoist DSL, OData-like, JSONPath/JMESPath-like, SQL-ish) and execution backends (concept action pushdown, local evaluation, search-index evaluation, remote API calls) as provider-pluggable translations around that IR. citeturn0search3turn0search2turn1search1turn1search3turn2search0turn2search5

## Bidirectional mapping theory for “two-way IR ↔ representations”

Your strongest requirement—**two-way** interchange between IR and multiple representations—is where academic literature matters most, because naive parse/print loops routinely lose information (formatting, precedence, ambiguous constructs) or lose intent (two different surface syntaxes compiling to the same IR).

The relevant theoretical framing is the “view update problem” and the notion of **lenses** (bidirectional transformations). entity["people","Benjamin C. Pierce","computer scientist"] and collaborators’ lenses work formalizes a bidirectional transformation as: (1) a forward mapping from “concrete source” to “abstract view,” and (2) a backward mapping that takes a modified view plus the original source and produces an updated source, aiming for well-behaved round-trips. citeturn0search1 That is directly analogous to what you want when you say “two-way between IR and representation”: IR is the “abstract view,” and each authoring representation is a different “concrete source.”

For relational data specifically, entity["people","Aaron Bohannon","computer scientist"], entity["people","Jeffrey A. Vaughan","computer scientist"], and Pierce propose **relational lenses**: a bidirectional language aimed at relational views, explicitly framed as a new approach to the classical view update problem in relational databases. citeturn0search0turn0search4 Later work on incremental relational lenses makes the “practicality” case: it equips relational lenses with change-propagating semantics and reports significant improvements over non-incremental approaches, emphasizing that lens ideas can support expressive, efficient view updates without relying on database-native updatable views. citeturn0search16

Translating that to your system implies a concrete architectural principle:

A “two-way” provider should not just implement `(parse: repr → IR)` and `(print: IR → repr)`; it should implement a **lens-like contract** that includes some notion of (a) *normalization*, (b) *identity/round-trip laws*, and (c) *handling of ambiguity and unsupported features* (often by retaining the original representation or preserving opaque fragments). citeturn0search1turn0search0turn0search16

In practice, robust systems often weaken the naive notion of “perfect round trip” and instead guarantee something like:

- `parse(print(IR)) == normalize(IR)` (semantic preservation up to canonicalization), and
- `print(parse(text)) == pretty(text)` (stable formatting after normalization),

which is consistent with the “view update problem” framing: the inverse direction needs extra information (often the original source) because the mapping is not injective. citeturn0search1turn0search0

This matters operationally for your multi-representation requirement (e.g., Todoist DSL ↔ IR ↔ OData or IR ↔ SQL-ish). You will inevitably encounter constructs that:
- exist only in one representation (e.g., domain-specific tokens like “overdue,” “today,” or “next week” in task DSLs), citeturn1search3turn1search15
- exist in multiple representations but with subtly different semantics (e.g., string search, null handling, time zone handling), citeturn1search1turn2search5turn2search0
- or exist in the IR but cannot be expressed in a given representation (e.g., complex window functions in a simple DSL, or multi-join queries in a filter-only expression language). citeturn0search3turn0search10

So the “academic” takeaway is not “use lenses everywhere,” but: **make ambiguity and loss explicit**—either by restricting IR subsets per representation, or by carrying residual/opaque nodes, or by making “printability” a capability predicate rather than an assumption. citeturn0search1turn0search16

## A concept inventory that matches Clef’s independence and provider patterns

Clef’s design rules suggest a clean way to separate what should be “first-class concepts” (stateful, shareable configuration artifacts) from what should be “coordination concepts with providers” (multiple backends / multiple representations / multiple algorithms). fileciteturn0file0L5-L12 fileciteturn0file0L20-L24 fileciteturn0file0L604-L614 The following inventory treats your requested decomposition (“groups, filters, sorts, displays, queries… each its own concept”) as **configuration concepts**, while treating “parse/print/execute/render” variability as coordination + provider families.

### Canonical configuration concepts

**ViewShell**  
Purpose: The stable, user-facing “view identity” that ties everything together (title, description, ownership, where it appears). It references other specs by ID rather than embedding them as JSON blobs, matching Clef’s independence rule. fileciteturn0file0L20-L24 fileciteturn0file1L44-L58

**DataSourceSpec**  
Purpose: Declare “what base dataset do we start from?” In clef-base this is `{concept, action, params}` stored inside `dataSource`. fileciteturn0file1L44-L58 Making it a concept enables providers beyond kernel concept invocation (remote APIs, search indexes, file systems).

**QueryPlanSpec**  
Purpose: A logical query plan over a base dataset. This is where query IR lives, analogous to relational operator trees in Calcite or Substrait plans. citeturn0search3turn0search2

**ExpressionSpec**  
Purpose: A reusable expression tree type for predicates and scalar transforms (field refs, literals, boolean ops, function calls). This is the shared substrate for Filter/Sort/Group computed keys, similar in role (not identity) to expression trees. citeturn1search2turn1search18

**FilterSpec**  
Purpose: A predicate expression, plus optional UI metadata (label, default state, faceting behavior) and parameter bindings (context variables). This generalizes both “interactive filters” and “contextual filters” as a single artifact. fileciteturn0file1L301-L305

**SortSpec**  
Purpose: Ordered list of sort keys (each an expression + direction + null ordering), decoupled from display and from backend. This addresses the current “parsed but minimally used” state. fileciteturn0file1L343-L347

**GroupSpec**  
Purpose: Grouping keys and group ordering semantics, expressed independently of the table/board UI. This addresses the current constraint where only the first group field is used and enables multiple consumer displays. fileciteturn0file1L332-L339

**ProjectionSpec**  
Purpose: Field selection and computed columns—what data should be “materialized” for display. This cleanly separates query shaping from display, similar to $select in OData. citeturn1search1

**AggregationSpec**  
Purpose: Aggregations (count/sum/etc.), grouped or global. This supports “stat-cards” and other holistic displays, and aligns with relational plan concepts. citeturn0search3turn0search10

**PresentationSpec**  
Purpose: Layout selection and layout-specific options (table columns, card templates, graph encodings), and how DisplayMode participates (per-item vs holistic). This corresponds to the current `layout` plus DisplayMode toggles. fileciteturn0file1L8-L19 fileciteturn0file1L44-L58

**InteractionSpec**  
Purpose: Controls, row actions, navigation, picker behaviors—currently embedded under `controls`. fileciteturn0file1L44-L58 Separate state enables sharing a “row action set” across multiple views.

**BindingSpec**  
Purpose: Standardize context-variable binding and templating (e.g., the existing `{{varName}}` pattern in dataSource params) as a first-class, typed binding model rather than ad hoc templating. fileciteturn0file1L44-L58

A key justification for splitting these is that Clef treats “named, purposeful, independent state + actions” as the criterion for a concept; view substructures like “FilterSpec” and “SortSpec” meet that bar if they are shareable artifacts with lifecycle (create/edit/version/compose). fileciteturn0file0L20-L24

### Coordination concepts that want the provider pattern

Clef’s own documentation emphasizes that coordination + provider is appropriate when multiple optional implementations exist and routing is done via a registry. fileciteturn0file0L604-L614 In your architecture, the provider pattern is most valuable when the “same abstract thing” can be implemented in different ways.

The high-leverage coordination concepts are:

**RepresentationProviderCoordination**  
Purpose: Convert between “authoring representations” and canonical specs (especially QueryPlanSpec / FilterSpec / SortSpec / GroupSpec). Providers include:
- Todoist-style task filter DSL parsing/printing (domain-specific authoring). citeturn1search3turn1search15  
- OData-style query options parsing/printing (web/API authoring). citeturn1search1turn1search21  
- SQL-ish WHERE/ORDER BY subset parsing/printing (analyst authoring). citeturn0search3turn2search10  
- JSONPath/JMESPath parsing/printing (JSON authoring). citeturn2search0turn2search3  
- Windows AQS parsing/printing (file/search authoring). citeturn2search5turn2search1  
- GraphQL query shaping parsing/printing (hierarchical selection sets, separate from relational filtering). citeturn1search0turn1search4  

**ExecutionProviderCoordination**  
Purpose: Execute a QueryPlanSpec against a backend, possibly pushing down parts of the plan. This mirrors the Calcite “adapter” idea and the general plan-IR-to-engine translation idea. citeturn0search15turn0search3 Providers include:
- In-kernel concept invocation + client-side residual evaluation (the current behavior). fileciteturn0file1L301-L305  
- Backend pushdown into a search/index service (if available), aligning with how AQS targets Windows Search indexes. citeturn2search5  
- Remote API pushdown (e.g., task provider that can execute Todoist filter strings directly). citeturn1search3turn1search15  
- SQL backend pushdown (where applicable), which becomes easier if your IR aligns with relational operator trees or Substrait-like operators. citeturn0search3turn0search2turn2search10

**PresentationProviderCoordination**  
Purpose: Map a PresentationSpec to concrete UI implementations per platform/theme. This generalizes the existing WidgetResolver-driven “layout recommendation” step. fileciteturn0file1L219-L224

**FormatterProviderCoordination**  
Purpose: Resolve formatters consistently across table/card/detail/DisplayMode rendering (today this exists as a finite set of formatters; decomposing it enables domain-specific renderers and consistent portability).

In Clef terms, these coordination concepts would route to provider plugins via a registry, matching the documented pattern for dispatching to the correct provider. fileciteturn0file0L604-L614

## How the IRs connect to a shell view concept and derived views

Your stated goal suggests two compositional modes, both compatible with Clef’s “concept vs derived concept” distinction. Clef explicitly distinguishes stateful concepts from derived concepts (named compositions without independent state). fileciteturn0file0L180-L189 In the Views space, that yields a clean split:

**Shell view concept mode (stateful, editable, shareable)**  
- `ViewShell` is the canonical identity and storage point for “a view a user can select.”  
- It references immutable or versioned child specs: DataSourceSpec, QueryPlanSpec, FilterSpecSet, SortSpec, GroupSpec, ProjectionSpec, PresentationSpec, InteractionSpec, BindingSpec.  
- Editing a view is editing those specs (possibly with re-use), not manipulating a single JSON blob. This directly addresses the current “structured JSON strings parsed at render time” design. fileciteturn0file1L44-L58

**Derived view mode (stateless, named compositions)**  
- A derived view (Clef `.derived`) can compose a stable pipeline: e.g., “Today Tasks Board” could be a derived concept that binds a DataSourceSpec (Tasks/list), a FilterSpec (today/overdue), a GroupSpec (group by project), and a PresentationSpec (board), without owning its own state. fileciteturn0file0L180-L189  
- This is the right place for “semantic views” that should exist as durable features even if the underlying specs evolve (because you can evolve the composed specs while keeping the derived view’s surface stable).

A key implementation insight from the query/UI literature is that users expect extremely fast feedback when manipulating filters or facets. Dynamic queries research frames this as interactive widgets that let users iterate rapidly with immediate result updates. entity["people","Ben Shneiderman","hci researcher"] citeturn3search1 Faceted search design guidance similarly emphasizes how facet-driven filtering structures user exploration and discovery. entity["people","Marti A. Hearst","information retrieval researcher"] citeturn3search2turn3search18 These findings imply that your runtime architecture should explicitly support **incremental evaluation** and **partial recomputation** when FilterSpec/SortSpec/GroupSpec changes—especially if you intend to swap between execution providers (pushdown vs local). The incremental relational lenses literature reinforces the value of change-propagating semantics for view updates. citeturn0search16

## A concrete “wiring diagram” for concepts, providers, and two-way translation

Below is a connection model that matches your requirements (decomposition + IR + providers + two-way translation) while staying consistent with Clef’s provider coordination pattern. fileciteturn0file0L604-L614

### Concept graph at rest

- **ViewShell**  
  - references **DataSourceSpec**  
  - references **QueryPlanSpec** (may be absent if “raw list view”)  
  - references **FilterSpecSet**, **SortSpec**, **GroupSpec**, **ProjectionSpec**, **AggregationSpec**  
  - references **PresentationSpec** and optional **DisplayMode policy**  
  - references **InteractionSpec** and **BindingSpec**  
  (This structure corresponds one-to-one with the monolithic fields currently embedded in ViewConfig.) fileciteturn0file1L44-L58

### Runtime compilation and execution

1. **Load + bind**  
   - Resolve context bindings / templated params (BindingSpec), producing a “bound” DataSourceSpec and parameterized FilterSpecs. This generalizes the existing contextual filter + template variable behavior. fileciteturn0file1L301-L305

2. **Canonicalize to IR**  
   - Combine QueryPlanSpec + FilterSpec + SortSpec + GroupSpec + ProjectionSpec into a single logical plan (or a small DAG of “plan fragments”). This matches the relational-algebra operator tree model. citeturn0search3turn0search15

3. **Plan + capability negotiation**  
   - Ask the ExecutionProviderCoordination concept: “given this backend and this plan, what can you push down?”  
   - Split into pushdown subplan + residual subplan. This is the exact kind of boundary Calcite’s adapter model enables, while Substrait provides a portable envelope for representing the plan if you later want cross-engine interchange. citeturn0search15turn0search2turn0search10

4. **Execute + incrementally refine**  
   - Execute pushdown plan (concept action query / remote API / search index).  
   - Apply residual filters/sorts/groups locally if needed (ensuring the same semantics regardless of backend). This is also where “dynamic queries” expectations argue for caching and incremental recomputation. citeturn3search1turn0search16

5. **Render**  
   - Resolve PresentationSpec to a concrete layout (possibly via a presentation provider / WidgetResolver-like step). fileciteturn0file1L219-L224  
   - Render per-item via DisplayMode where relevant; render holistic displays directly otherwise. fileciteturn0file1L8-L19

### Two-way representation interchange

To support “edit in DSL A, then switch to DSL B if it supports the IR,” treat representation conversion as a first-class workflow:

- **Parse:** `reprA → IR` via RepresentationProvider(A)  
- **Normalize:** `IR → IRcanon` (canonical form)  
- **Emit:** `IRcanon → reprB` via RepresentationProvider(B), if capability(B) supports IRcanon  

This mirrors the common compilation pipeline pattern (parse → AST/IR → pretty-print), but with an explicit bidirectional contract inspired by lenses: where perfect inversion is impossible, either:
- restrict to a “printable subset,” or
- preserve uninterpreted fragments as opaque nodes/annotations, or
- require the original representation as context for “putback” (update) semantics. citeturn0search1turn0search0turn0search16

This lens framing is particularly important if you want to support *semantic* edits in one representation and keep stable formatting/idioms of another—precisely the classic “view update” ambiguity problem that lenses were built to address. citeturn0search1turn0search4

A useful historical analogue is Query-By-Example: entity["company","IBM","technology company"] and entity["people","Moshé M. Zloof","qbe inventor"] designed QBE as a graphical authoring surface that can be converted into a database manipulation language behind the scenes—explicitly a “UI representation ↔ executable query” bridge. citeturn3search4turn3search0 That same idea generalizes to “Todoist DSL ↔ canonical IR ↔ OData/SQL/other,” as long as you treat the IR as the semantic bridge and remain explicit about what can and cannot round-trip.

## What “makes the most sense” as a final decomposition

Based on the baseline architecture and the literature above, the decomposition that best matches your goals is one that recognizes *two different kinds of modularity*:

**Semantic modularity (first-class concepts)**  
Filters, sorts, groups, projections, aggregations, bindings, and presentation choices become independent, shareable, versionable concepts referenced by a ViewShell. This directly upgrades today’s “JSON strings inside ViewConfig” into a proper graph of artifacts. fileciteturn0file1L44-L58

**Implementation modularity (provider families around IRs)**  
Anything that varies by language, backend, platform, or algorithm becomes a coordination concept + provider plugins: parsers/printers for surface syntaxes (Todoist/OData/JSONPath/AQS/SQL-ish), execution backends (pushdown vs local), and rendering backends (table/card/graph with platform-specific implementation). This matches Clef’s own documented provider pattern and mirrors how query ecosystems like Calcite or standardized IR work like Substrait enable many frontends/backends to interoperate. fileciteturn0file0L604-L614 citeturn0search3turn0search2

The “two-way” requirement then becomes feasible if you formally adopt lens-like constraints at provider boundaries: treat printable subsets and normalization as explicit, and design providers to be “bidirectional where possible, explicitly lossy where not.” citeturn0search1turn0search0turn0search16