# query_program — MCP Tool Guide

Build sequences of query instructions as inspectable , composable data . A QueryProgram describes what a view intends to fetch and transform without executing side effects . Programs capture scan , filter , sort , group , project , limit , and pure termination steps as an ordered instruction list . Programs can be analyzed for the fields they read , composed via monadic bind , and handed to an interpreter or optimizer

## Design Principles

- **Decomposed View Configuration:** Each view concern (filter, sort, group, project, data source, presentation) is its own independent concept. They compose through syncs into ViewShell, not through imports or coupling.
- **QueryProgram is Sealed After Pure:** Once pure() is called, the program is terminated. No further instructions can be appended. This is the monadic return — it enables safe caching/memoization and prevents accidental mutation.
- **FilterSpec is Algebraic:** Filters compose via AND trees. The identity filter is {type:'true'}. Composition is associative. This enables incremental filter building in UIs.
- **SortSpec Composition is Ordered:** Sort composition is NOT commutative. compose(byName, byDate) means sort by name then break ties by date. This matches user mental models.
- **Schema-Scoped Data Sources:** When a view shows data from a single schema, ALWAYS use listBySchema in the DataSourceSpec instead of list + client-side schema filter. listBySchema does a server-side join returning pre-filtered, schema-enriched results in one query. Use list only when the view genuinely shows all content types with interactive schema toggles.
- **PaginationSpec for Paginated Views:** When a view needs pagination, include 'pagination' in the ViewShell features set and provide a PaginationSpec ref. The PaginationSpec manages mode (offset, cursor, keyset), page size, and position. compile-query injects offset+limit from PaginationSpec/evaluate. paginate-on-execute updates the spec's totalCount after query execution.
- **ViewShell Selective Features:** Views declare which specs they need via the features field: a JSON array of enabled feature names (filter, sort, group, projection, interaction, pagination). Always-on: dataSource, presentation. view-resolve.sync only fetches child specs for enabled features. .view files declare features in a features {} block.
- **Per-Schema Denormalized Relations:** schema-index-on-apply.sync maintains denormalized schema:{name} relations. listBySchema reads from these directly instead of joining membership + node tables. This eliminates the O(M+N) full-table join — a single find('schema:Article', {}, { limit: 50 }) suffices.
- **Split Execution by sourceType:** Filters are partitioned by sourceType for split execution: system + contextual push to backend, interactive + search run locally in-memory. This lets views fetch pre-filtered data from the kernel while keeping toggle filters responsive without round-trips. For E2EE (encrypted-local kind), ALL processing runs locally after client-side decrypt.
- **Pushdown for Remote Sources:** RemoteQueryProvider splits a QueryProgram into pushdown (sent to API) and residual (executed in-memory). Views over REST APIs get the same composable experience as local queries.
**create:**
- [ ] Does the view have a DataSourceSpec defining where data comes from?
- [ ] Are FilterSpec, SortSpec, GroupSpec, ProjectionSpec defined as independent concepts?
- [ ] Is the ViewShell wired to assemble individual specs via view-resolve.sync?
- [ ] Does the query terminate with pure (sealed)?
- [ ] For joined views, is join before filter (not after)?

**filter:**
- [ ] FilterNode tree is valid JSON?
- [ ] Field references in the tree match the data source schema?
- [ ] Parameters use {{varName}} syntax for runtime substitution?
- [ ] Filters composed via FilterSpec/compose, not manual AND trees?

**sort:**
- [ ] Sort key direction is 'asc' or 'desc'?
- [ ] Composition order correct? (primary sort first, tiebreaker second)
## References

- [QueryProgram instruction grammar and pipeline reference](references/query-program-grammar.md)
- [.view file grammar reference](references/view-grammar.md)
## Anti-Patterns

### Using list + client-side schema filter instead of listBySchema
Fetches ALL nodes then filters locally — full table scan every time. listBySchema does a server-side join returning only matching nodes with schemas pre-attached.

**Bad:**
```
DataSourceSpec/create: { config: '{"concept":"ContentNode","action":"list","params":{"schemaFilter":"Concept"}}' }
// Fetches ALL ContentNodes, then filters to Concepts client-side

```

**Good:**
```
DataSourceSpec/create: { config: '{"concept":"ContentNode","action":"listBySchema","params":{"schema":"Concept"}}' }
// Server-side join — returns only Concept nodes with schemas array

```

### Building filters as raw JSON in handlers
Bypasses composition, normalization, validation, and field reference tracking.

**Bad:**
```
// Hardcoded filter in handler
const results = items.filter(i => i.kind === 'concept');

```

**Good:**
```
// Declarative FilterSpec
FilterSpec/create: { name: "by-kind", tree: '{"type":"eq","field":"kind","value":"concept"}' }
// Composed via sync into QueryProgram

```

### Mutating a QueryProgram after pure
Violates the sealed invariant. Programs are immutable after termination.

**Bad:**
```
QueryProgram/pure(program: q, variant: "ok", output: "nodes")
QueryProgram/filter(program: q, ...)  // → sealed error!

```

**Good:**
```
// Create a new program, or compose two programs
QueryProgram/compose(first: q1, second: q2, bindAs: "result")

```

### Monolithic view config objects
Can't compose, can't reuse across views, can't independently test.

**Bad:**
```
View/create: { dataSource: {...}, filter: {...}, sort: {...}, display: {...} }

```

**Good:**
```
// Independent specs composed through syncs
DataSourceSpec/create: { name: "src", kind: "concept-action", ... }
FilterSpec/create: { name: "f1", tree: '...', ... }
SortSpec/create: { name: "s1", keys: '[...]' }

```
**Related tools:** [object Object], [object Object], [object Object], [object Object], [object Object]

