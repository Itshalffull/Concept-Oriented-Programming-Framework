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

## Approach 3: SchemaIndex — materialized per-schema collections

**Goal:** O(1) lookup for "all entities with schema X" instead of scanning
the entire membership relation.

### Changes

#### 3a. Create SchemaIndex concept spec
- **File:** `repertoire/concepts/foundation/schema-index.concept`
- **What:** Maintains a secondary index relation keyed by schema name, storing
  a set of entity IDs. Actions: `add(schema, entityId)`, `remove(schema, entityId)`,
  `lookup(schema)` → returns entity IDs, `lookupWithNodes(schema)` → returns
  full ContentNode records.

#### 3b. Create SchemaIndex handler
- **File:** `handlers/ts/app/schema-index.handler.ts`
- **What:** Uses a `schemaIndex` relation keyed by `schema::entityId`.
  `lookup` does `find('schemaIndex', { schema })` — single equality scan on
  one field. `lookupWithNodes` does lookup then fetches each node by ID.

#### 3c. Create sync: index on Schema/applyTo
- **File:** `syncs/foundation/schema-index-maintain.sync`
- **What:** Two syncs:
  - `Schema/applyTo → ok` triggers `SchemaIndex/add`
  - `Schema/removeFrom → ok` triggers `SchemaIndex/remove`
  This keeps the index in sync with membership changes.

#### 3d. Update ViewRenderer to use SchemaIndex
- **File:** `clef-base/app/components/ViewRenderer.tsx`
- **What:** When schema-filtered, use `SchemaIndex/lookupWithNodes` instead of
  `ContentNode/list` + `Schema/listMemberships`.

### Performance impact
- **Before:** O(M) scan of all memberships, O(N) scan of all nodes
- **After:** O(K) where K = entities with that specific schema. For "show all
  Views" with 50 views out of 10,000 nodes, this is 200x faster.

---

## Implementation Order

1. **Approach 2 first** (framework-level) — benefits every concept, low risk
2. **Approach 1 second** (ContentNode-specific) — immediate win for the main bottleneck
3. **Approach 3 third** (index concept) — long-term scalability

---

## Traceability Matrix

Every section above maps to a specific file and line range. After implementation,
this matrix will be updated with the exact lines where each change was made.
