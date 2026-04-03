# PRD: ContentNode Query Performance

## Problem

Every ContentNode view (content list, schemas, views, etc.) executes two
full-table scans on every render:

1. `ContentNode/list` → `find('node', {})` — returns **all** nodes
2. `Schema/listMemberships` → `find('membership', {})` — returns **all** memberships

The client then builds an in-memory map, enriches each node with its schemas,
and filters client-side. For N nodes and M memberships, every page load is
O(N + M) regardless of how many results the user actually sees.

### Current flow (ViewRenderer lines 281-332)

```
invoke('ContentNode', 'list', {})           → all N nodes
invoke('Schema', 'listMemberships', {})     → all M memberships
client: build entity→schemas map            → O(M)
client: enrich nodes with schemas           → O(N)
client: filter by schemaFilter              → O(N)
render 20 rows
```

### Where the bottleneck lives

| Location | File | Line | What it does |
|----------|------|------|-------------|
| ContentNode.list handler | `handlers/ts/app/content-node.handler.ts` | 134-138 | `find(p, 'node', {}, 'items')` — no filtering |
| Schema.listMemberships handler | `handlers/ts/app/schema.handler.ts` | 194-201 | `find(p, 'membership', {}, 'items')` — no filtering |
| Schema.getEntitiesFor handler | `handlers/ts/app/schema.handler.ts` | 179-192 | Full scan + in-memory filter by schema |
| Schema.getSchemasFor handler | `handlers/ts/app/schema.handler.ts` | 164-177 | Full scan + in-memory filter by entity_id |
| StorageProgram find instruction | `runtime/storage-program.ts` | 211-223 | Only supports equality criteria, no limit/offset |
| In-memory storage find | `runtime/adapters/storage.ts` | 105-118 | Linear scan, equality filter only |
| ConceptStorage.find interface | `runtime/types.ts` | 74 | `find(relation, criteria?)` — no pagination params |
| ViewRenderer enrichment | `clef-base/app/components/ViewRenderer.tsx` | 289-332 | Two queries + client-side join |

---

## Approach 1: Add `listBySchema` to ContentNode

**Goal:** Eliminate the two-full-scan pattern by pushing schema-filtered queries
to the server.

### Changes

#### 1a. Add `listBySchema` action to ContentNode concept spec
- **File:** `repertoire/concepts/foundation/content-node.concept`
- **What:** New action `listBySchema(schema: String)` that returns only nodes
  with that schema applied
- **Variants:** `ok(items: String)` — JSON array of matching nodes with schemas
  inline

#### 1b. Implement `listBySchema` in ContentNode handler
- **File:** `handlers/ts/app/content-node.handler.ts`
- **What:** New handler method that:
  1. Calls `find(p, 'membership', {}, 'allMemberships')` to get memberships
  2. Uses `mapBindings` to filter memberships by schema, collect entity IDs
  3. Calls `find(p, 'node', {}, 'allNodes')` to get all nodes
  4. Uses `mapBindings` to filter nodes by collected entity IDs and attach schemas
  5. Returns enriched, filtered list
- **Why not two `find` calls with criteria?** Because `find` only supports
  equality on stored fields, and schema membership is in a separate relation.
  The handler does the join server-side instead of client-side.

#### 1c. Update ViewRenderer to use `listBySchema`
- **File:** `clef-base/app/components/ViewRenderer.tsx`
- **What:** When a View's dataSource targets ContentNode and has a `schemaFilter`
  param, use `listBySchema` instead of `list` + `listMemberships`. This
  eliminates the second query and the client-side enrichment.

### Performance impact
- **Before:** 2 full scans (O(N) + O(M)), client-side join O(N + M)
- **After:** 2 full scans server-side but single response with filtered results;
  client receives only matching rows. Eliminates the second `useConceptQuery` call.

---

## Approach 2: Add `limit`, `offset`, and `sort` to StorageProgram `find`

**Goal:** Let any concept paginate results at the storage level.

### Changes

#### 2a. Extend `find` Instruction type with options
- **File:** `runtime/storage-program.ts`
- **What:** Add optional `options` field to the `find` instruction:
  ```typescript
  { tag: 'find'; relation: string; criteria: Record<string, unknown>;
    bindAs: string; options?: FindOptions }
  ```
  Where `FindOptions = { limit?: number; offset?: number; sort?: { field: string; order: 'asc' | 'desc' } }`

#### 2b. Extend `find` DSL function signature
- **File:** `runtime/storage-program.ts`
- **What:** Add optional `options` parameter to the `find()` function

#### 2c. Update ConceptStorage interface
- **File:** `runtime/types.ts`
- **What:** Extend `find` signature:
  ```typescript
  find(relation: string, criteria?: Record<string, unknown>,
       options?: FindOptions): Promise<Record<string, unknown>[]>;
  ```

#### 2d. Implement in in-memory storage adapter
- **File:** `runtime/adapters/storage.ts`
- **What:** After filtering by criteria, apply sort, then slice for offset/limit

#### 2e. Update interpreter to pass options through
- **File:** `runtime/interpreter.ts`
- **What:** Pass `instr.options` to `storage.find()` call

#### 2f. Use pagination in ContentNode.list
- **File:** `handlers/ts/app/content-node.handler.ts`
- **What:** Accept optional `limit`/`offset` params and pass to `find` options

### Performance impact
- **Before:** Every `find({})` returns all rows
- **After:** `find({}, { limit: 50, offset: 0, sort: { field: 'updatedAt', order: 'desc' } })`
  returns only the requested page. In-memory adapter slices; SQL adapter pushes
  to `LIMIT`/`OFFSET`.

---

## Approach 3: Wire View through Query concept (revised)

**Goal:** Route View data resolution through the existing Query concept from
the query-retrieval suite, making Query schema-aware so it handles the
membership join and field filtering server-side. Replaces the original
standalone SchemaIndex approach.

### Why this replaces SchemaIndex

The query-retrieval suite already has:
- **Query** — parse expressions, execute with filters/sorts/scope
- **ExposedFilter** — user-facing filter controls that modify queries via sync
- **SearchIndex** — full-text indexing with pipelines

Making Query handle `schema = 'X'` predicates by joining the membership
relation is more aligned than a separate SchemaIndex concept. It also
means View's dataSource can be a query expression instead of raw
`{ concept, action }`, and all the ExposedFilter/SearchIndex wiring
works automatically.

### Changes

#### 3a. Make Query.execute actually execute queries with schema awareness
- **File:** `handlers/ts/app/query.handler.ts`
- **What:** Rewrite `execute` to:
  1. Parse the expression into structured clauses (field/op/value predicates)
  2. Fetch all nodes + memberships via `find`
  3. Join memberships to build entity→schemas map
  4. Handle `schema = 'X'` predicates via membership join
  5. Apply field predicates, additional filters, and sorts server-side
  6. Return filtered, enriched, sorted results

#### 3b. Add expression parser to Query handler
- **File:** `handlers/ts/app/query.handler.ts`
- **What:** `parseExpression()` function supporting:
  - `field = 'value'` (equality)
  - `field != 'value'` (inequality)
  - `field > / < / >= / <=` (comparison)
  - `field CONTAINS 'value'` (substring)
  - `field IN ('a','b')` (set membership)
  - `pred AND pred` (conjunction)
  - `schema = 'Article'` (special: joined via membership relation)

#### 3c. Create sync: View.resolve → Query
- **File:** `syncs/foundation/view-resolves-via-query.sync`
- **What:** When View.resolve fires and the dataSource has a `query` field,
  route through `Query/parse` → `Query/execute`. Also wires View/setFilter
  and View/setSort to `Query/addFilter` and `Query/addSort`.

#### 3d. Add `query` field to ViewRenderer DataSourceConfig
- **File:** `clef-base/app/components/ViewRenderer.tsx`
- **What:** Three-mode data fetching:
  1. **Query mode** — dataSource has `query` expression → Query/parse + Query/execute
  2. **Schema-optimized** — ContentNode + schemaFilter → ContentNode/listBySchema
  3. **Legacy** — raw concept/action + listMemberships (backward compatible)

### Performance impact
- **Before:** 2 full scans + client-side join for every ContentNode view
- **After:** Query/execute does the join + filter + sort server-side, returns
  only matching rows. ExposedFilter modifies the query via existing sync
  wiring. No client-side enrichment needed for query-mode views.

---

## Implementation Order

1. **Approach 2 first** (framework-level) — benefits every concept, low risk
2. **Approach 1 second** (ContentNode-specific) — immediate win for the main bottleneck
3. **Approach 3 third** (Query-based) — View → Query pipeline for long-term scalability

---

## Traceability Matrix

Every PRD section maps to an exact implementation location.

### Approach 2: FindOptions (limit/offset/sort)

| PRD Section | File | Lines | What was implemented |
|-------------|------|-------|---------------------|
| 2a. FindOptions type | `runtime/types.ts` | 72-76 | `export interface FindOptions { limit?, offset?, sort? }` |
| 2c. ConceptStorage.find signature | `runtime/types.ts` | 81 | `find(relation, criteria?, options?: FindOptions)` |
| 2a. find Instruction type | `runtime/storage-program.ts` | 32 | Added `options?` field to find instruction |
| 2b. find DSL function | `runtime/storage-program.ts` | 211-223 | Added `options?` param to `find()` function |
| 2d. In-memory adapter sort | `runtime/adapters/storage.ts` | 122-132 | Sort by field with asc/desc |
| 2d. In-memory adapter pagination | `runtime/adapters/storage.ts` | 134-139 | `slice(offset, offset + limit)` |
| 2e. Interpreter passthrough (1) | `runtime/interpreter.ts` | 105 | `storage.find(instr.relation, instr.criteria, instr.options)` |
| 2e. Interpreter passthrough (2) | `runtime/interpreter.ts` | 322 | Same passthrough in second interpreter path |
| 2f. ContentNode.list pagination | `handlers/ts/app/content-node.handler.ts` | 134-148 | Accepts `limit`, `offset`, `sortField`, `sortOrder` |

### Approach 1: ContentNode.listBySchema

| PRD Section | File | Lines | What was implemented |
|-------------|------|-------|---------------------|
| 1a. Concept spec | `repertoire/concepts/foundation/content-node.concept` | 98-113 | `listBySchema(schema, limit?, offset?)` action |
| 1b. Handler: server-side join | `handlers/ts/app/content-node.handler.ts` | 155-204 | Fetch memberships + nodes, filter by schema, enrich, paginate |

### Approach 3: Query-based View resolution

| PRD Section | File | Lines | What was implemented |
|-------------|------|-------|---------------------|
| 3b. Expression parser | `handlers/ts/app/query.handler.ts` | 29-68 | `parseExpression()` — supports =, !=, >, <, CONTAINS, IN, AND |
| 3b. Predicate applicator | `handlers/ts/app/query.handler.ts` | 70-92 | `applyPredicates()` — evaluates clauses against records |
| 3b. Sort applicator | `handlers/ts/app/query.handler.ts` | 94-113 | `applySorts()` — sorts by field asc/desc |
| 3a. Query.execute rewrite | `handlers/ts/app/query.handler.ts` | 148-241 | Full pipeline: parse → fetch nodes + memberships → schema join → filter → sort → return |
| 3c. View→Query sync | `syncs/foundation/view-resolves-via-query.sync` | 1-39 | View.resolve → Query/parse → Query/execute; View.setFilter → Query.addFilter |
| 3d. ViewRenderer query mode | `clef-base/app/components/ViewRenderer.tsx` | 289-302 | `hasQueryExpression` detection + Query/parse + Query/execute |
| 3d. ViewRenderer schema-optimized mode | `clef-base/app/components/ViewRenderer.tsx` | 290-296 | `useListBySchema` detection + ContentNode/listBySchema |
| 3d. ViewRenderer allData memo | `clef-base/app/components/ViewRenderer.tsx` | 339-400 | Three-mode data normalization (query / listBySchema / legacy) |
| 3d. DataSourceConfig.query field | `clef-base/app/components/ViewRenderer.tsx` | 67-69 | `query?: string` field on DataSourceConfig |
