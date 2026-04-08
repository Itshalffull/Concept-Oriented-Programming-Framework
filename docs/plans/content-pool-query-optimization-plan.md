# Content Pool Query Optimization — Implementation Plan

**Version:** 1.0.0  
**Date:** 2026-04-08  
**Status:** Implementation-ready  
**Problem:** `listBySchema` does two full-table scans (all memberships + all nodes) and joins in-memory for every call. O(N+M) to return 50 rows.  
**New concepts:** 0  
**Modified concepts:** 1 (ContentNode — update listBySchema handler)  
**Infrastructure:** Storage adapter secondary indexes, per-schema denormalized relations, cache wiring, SQL indexes

### Kanban Cards (Vibe Kanban)

| Card | PRD Sections | Blocked By | Blocks | Commit |
|---|---|---|---|---|
| **MAG-544** Storage Adapter Secondary Indexes | §1 | — | MAG-546, MAG-547, MAG-548 | |
| **MAG-545** Per-Schema Denormalized Relations | §2 | — | MAG-546, MAG-547, MAG-548 | |
| **MAG-546** listBySchema Handler Optimization | §3 | MAG-544, MAG-545 | MAG-548 | |
| **MAG-547** Cache Integration via Syncs | §4 | MAG-544, MAG-545 | MAG-548 | |
| **MAG-548** Integration Tests | §5 | MAG-544–547 | — | |

---

## 0. Current State (Why This Matters)

Every `ContentNode/listBySchema("Article", limit=50)` call currently:

```
find('membership', {})          → ALL M memberships (e.g., 10,000 rows)
find('node', {})                → ALL N nodes (e.g., 100,000 rows)
mapBindings: in-memory join     → O(M + N) = 110,000 operations
filter + slice(0, 50)           → discard 99,950 results
Return: 50 rows
```

This happens on every page load for every view. The Cache concept exists but is not wired into this path. The in-memory storage adapter has no indexes — every `find()` is a linear scan.

Four independent optimizations stack to eliminate this:

| Layer | What It Does | Cost Reduction |
|---|---|---|
| §1 Secondary indexes | `find('membership', { schema })` → O(1) index lookup | M → K (matching only) |
| §2 Per-schema relations | Eliminates the join entirely | No membership scan at all |
| §3 Handler optimization | Uses §1 + §2 to avoid full scans | O(N+M) → O(K) |
| §4 Cache integration | Avoids re-computation on repeated reads | O(K) → O(1) on cache hit |

---

## 1. Storage Adapter Secondary Indexes

### 1.1 Problem

The in-memory storage adapter's `find(relation, criteria)` does a linear scan over all entries, checking each against the criteria object. With 10K memberships, `find('membership', { schema: 'Article' })` scans all 10K even though only 50 match.

### 1.2 Design

Add optional secondary index declarations to the storage adapter. When a field is indexed, the adapter maintains a `Map<fieldValue, Set<key>>` alongside the primary `Map<key, StoredEntry>`.

#### ConceptStorage interface addition (`runtime/types.ts`):

```typescript
export interface ConceptStorage {
  // ... existing methods ...

  /** Declare a secondary index on a relation field. */
  ensureIndex?(relation: string, field: string): void;
}
```

#### In-memory adapter changes (`runtime/adapters/storage.ts`):

```typescript
// New internal structure alongside the existing data map
const indexes = new Map<string, Map<string, Map<string, Set<string>>>>();
// indexes: relation → field → value → Set<key>

function ensureIndex(relation: string, field: string) {
  // Create index structure
  // Backfill from existing data
}

// On put/merge: update index entries
// On del: remove index entries

// On find with criteria: if an indexed field is in criteria,
// use the index to get candidate keys, then filter by remaining criteria
```

#### Behavior:

- `ensureIndex('membership', 'schema')` — creates index on schema field
- `find('membership', { schema: 'Article' })` — uses index: O(1) set lookup + O(K) result construction
- `find('membership', {})` — no criteria, still linear scan (but this call should become unnecessary)
- Index maintenance on `put`/`merge`/`del` — O(1) amortized per operation

### 1.3 SQL Adapter Impact

For PostgreSQL/SQLite adapters, `ensureIndex` translates to:
```sql
CREATE INDEX IF NOT EXISTS idx_{relation}_{field} ON {relation}({field});
```

The `find` method already generates `WHERE` clauses from criteria — the database uses the index automatically.

### 1.4 Deliverables

| Deliverable | File |
|---|---|
| `ensureIndex` on ConceptStorage interface | `runtime/types.ts` |
| In-memory index implementation | `runtime/adapters/storage.ts` |
| Index maintenance on put/merge/del | `runtime/adapters/storage.ts` |
| Index-aware find | `runtime/adapters/storage.ts` |
| Unit tests | `tests/storage-secondary-index.test.ts` |

### 1.5 Backward Compatibility

- `ensureIndex` is optional on the interface (existing adapters don't break)
- `find()` behavior is unchanged for unindexed fields (linear scan)
- No concept changes required

---

## 2. Per-Schema Denormalized Relations

### 2.1 Problem

Even with secondary indexes, `listBySchema` requires joining two relations (membership + node). The join is inherent to the normalized data model where schema membership is stored separately from node data.

### 2.2 Design

When `Schema/applyTo` fires, a sync writes the node's fields into a per-schema relation `schema:{schemaName}`. When `Schema/removeFrom` fires, the entry is deleted. This creates a denormalized copy organized by schema — a materialized view.

#### Sync: `schema-index-on-apply.sync`

```sync
sync SchemaIndexOnApply
when {
  Schema/applyTo: [ entity_id: ?id, schema: ?schema ] => [ ok: _ ]
}
where {
  query ContentNode/get: [ node: ?id ] => [ ok: ?nodeData ]
}
then {
  ContentStorage/save: [
    relation: "schema:?schema",
    key: ?id,
    data: ?nodeData
  ]
}
```

#### Sync: `schema-index-on-remove.sync`

```sync
sync SchemaIndexOnRemove
when {
  Schema/removeFrom: [ entity_id: ?id, schema: ?schema ] => [ ok: _ ]
}
then {
  ContentStorage/remove: [
    relation: "schema:?schema",
    key: ?id
  ]
}
```

#### Sync: `schema-index-on-save.sync`

When a ContentNode is saved and already has schema memberships, update all per-schema relations:

```sync
sync SchemaIndexOnSave
when {
  ContentStorage/save: [ id: ?id ] => [ ok: _ ]
}
where {
  query Schema/getSchemasFor: [ entity_id: ?id ] => [ ok: ?schemas ]
  guard(?schemas != "")
}
then {
  # For each schema, update the denormalized copy
  ContentStorage/save: [
    relation: "schema:?schema",
    key: ?id,
    data: ?nodeData
  ]
}
```

**Note:** The `schema-index-on-save` sync needs to iterate over multiple schemas. This may require a `traverse` pattern or multiple sync variants. Open question: does the sync engine support iterating over a set binding? If not, this sync fires once per schema via fan-out from the `getSchemasFor` result.

#### Result

After syncs are wired:
```
find('schema:Article', {}, { limit: 50 })  → 50 Article nodes, no join
find('schema:Concept', {}, { limit: 50 })  → 50 Concept nodes, no join
```

### 2.3 Seed Data Migration

Existing seed data creates ContentNodes and applies schemas. The per-schema relations need to be populated during seed application. Two approaches:

**A.** The `SchemaIndexOnApply` sync fires during seeding (if the sync engine is active during seed loading). This is the preferred approach — no migration script needed.

**B.** If syncs don't fire during seeding, add a `rebuildSchemaIndex` action to ContentNode that scans all memberships and populates per-schema relations. Run once after seeding.

### 2.4 Deliverables

| Deliverable | File |
|---|---|
| SchemaIndexOnApply sync | `clef-base/suites/entity-lifecycle/syncs/schema-index-on-apply.sync` |
| SchemaIndexOnRemove sync | `clef-base/suites/entity-lifecycle/syncs/schema-index-on-remove.sync` |
| SchemaIndexOnSave sync | `clef-base/suites/entity-lifecycle/syncs/schema-index-on-save.sync` |
| rebuildSchemaIndex action (if needed) | `handlers/ts/app/content-node.handler.ts` |
| Tests | included in MAG-548 |

### 2.5 Trade-offs

- **Write amplification**: every `Schema/applyTo` and `ContentStorage/save` triggers additional writes
- **Storage duplication**: node fields stored in both `node` relation and `schema:X` relation
- **Consistency**: syncs are eventual — brief window where denormalized relation is stale
- **Benefit**: eliminates the join entirely for read-heavy schema queries

---

## 3. listBySchema Handler Optimization

### 3.1 Current Implementation

```typescript
// CURRENT: Two full scans + in-memory join
find(p, 'membership', {}, 'allMemberships');    // ALL memberships
find(p, 'node', {}, 'allNodes');                 // ALL nodes
mapBindings(p, join_and_filter);                 // O(M+N)
```

### 3.2 Optimized Implementation

With per-schema relations (§2):
```typescript
// NEW: Single indexed read
find(p, `schema:${schema}`, {}, 'items', { limit, offset, sort });
```

That's it. One `find()` call on the denormalized relation with pagination pushed to the storage layer. No membership lookup, no join, no post-filtering.

#### Fallback path

If the per-schema relation doesn't exist (e.g., new schema with no syncs yet), fall back to indexed membership query:

```typescript
// FALLBACK: Use secondary index on membership
find(p, 'membership', { schema }, 'matchingMemberships');  // Uses index from §1
// Then batch-get nodes by key
```

### 3.3 Schema enrichment

The current handler enriches each node with its list of all schemas (`schemas: ["Article", "Publishable"]`). With the per-schema relation, we only know the node belongs to the queried schema. Two options:

**A.** Don't enrich — views usually only need the queried schema, not all schemas. Simpler, faster.

**B.** Lazy enrichment — store the schemas array in the denormalized relation (updated by SchemaIndexOnApply/Remove syncs). Slight write amplification, but reads include full schema list.

Recommend **B** for compatibility with existing views that display schema badges.

### 3.4 Deliverables

| Deliverable | File |
|---|---|
| Updated listBySchema handler | `handlers/ts/app/content-node.handler.ts` |
| Fallback path for unindexed schemas | same |
| Updated list handler (optional) | same |

---

## 4. Cache Integration via Syncs

### 4.1 Current State

The `SaveInvalidatesCache` sync already exists (`clef-base/suites/entity-lifecycle/syncs/save-invalidates-cache.sync`). It fires `Cache/invalidateByTags` with schema names when a ContentNode is saved. But no sync **writes** to the cache on read.

### 4.2 Design

Wire cache writes on `ContentNode/listBySchema` completion:

#### Sync: `cache-list-by-schema.sync`

```sync
sync CacheListBySchema
when {
  ContentNode/listBySchema: [ schema: ?schema ] => [ ok: ?items ]
}
then {
  Cache/set: [
    bin: "listBySchema",
    key: ?schema,
    data: ?items,
    tags: ?schema,
    maxAge: 300
  ]
}
```

#### Handler change: check cache first

Update `listBySchema` handler to check cache before querying:

```typescript
listBySchema(input) {
  const schema = input.schema as string;
  let p = createProgram();

  // Check cache first
  p = perform(p, 'cache', 'get', { bin: 'listBySchema', key: schema }, 'cached');
  p = branch(p, 'cached',
    // Cache hit — return cached data
    (b) => completeFrom(b, 'ok', (bindings) => ({ items: bindings.cached })),
    // Cache miss — query per-schema relation
    (b) => {
      let b2 = find(b, `schema:${schema}`, {}, 'items', { limit, offset });
      return completeFrom(b2, 'ok', ...);
    }
  );
  return p;
}
```

**Note:** Cache check via `perform` requires an EffectHandler for the cache protocol. If that's not wired, the simpler approach is sync-only caching (the sync writes to cache after every successful listBySchema, and a separate sync reads from cache before). But handler-level caching is more direct.

**Alternative (sync-only, no handler change):**

The existing `SaveInvalidatesCache` sync handles invalidation. A new `CacheListBySchema` sync handles population. The ViewRenderer or kernel-query-provider checks cache before dispatching. This keeps the handler pure.

### 4.3 Invalidation

Already handled by existing syncs:
- `SaveInvalidatesCache` — fires on `ContentStorage/save`, invalidates by schema tags
- `SchemaIndexOnApply` / `SchemaIndexOnRemove` — update denormalized relations (§2)

Add one more invalidation point:
- On `Schema/applyTo` → `Cache/invalidateByTags([schema])` — membership change invalidates the cached list
- On `Schema/removeFrom` → same

#### Sync: `schema-change-invalidates-cache.sync`

```sync
sync SchemaChangeInvalidatesCache
when {
  Schema/applyTo: [ schema: ?schema ] => [ ok: _ ]
}
then {
  Cache/invalidateByTags: [ tags: ?schema ]
}
```

(Same pattern for `removeFrom`.)

### 4.4 Deliverables

| Deliverable | File |
|---|---|
| CacheListBySchema sync | `clef-base/suites/entity-lifecycle/syncs/cache-list-by-schema.sync` |
| SchemaChangeInvalidatesCache sync | `clef-base/suites/entity-lifecycle/syncs/schema-change-invalidates-cache.sync` |
| SchemaRemoveInvalidatesCache sync | `clef-base/suites/entity-lifecycle/syncs/schema-remove-invalidates-cache.sync` |
| Optional handler-level cache check | `handlers/ts/app/content-node.handler.ts` |

---

## 5. Testing

### 5.1 Storage Secondary Index Tests

- `ensureIndex` creates index structure
- `put` updates index entries
- `del` removes index entries
- `find` with indexed criteria uses index (verify by checking result correctness)
- `find` without criteria still does full scan
- Performance: `find` with index on 10K entries completes in < 1ms
- Performance: `find` without index on 10K entries is measurably slower

### 5.2 Per-Schema Relation Tests

- `Schema/applyTo` creates entry in `schema:X` relation
- `Schema/removeFrom` deletes entry from `schema:X` relation
- `ContentStorage/save` updates entry in all per-schema relations
- `find('schema:Article', {}, { limit: 5 })` returns correct subset
- Multiple schemas on one entity → entry in multiple per-schema relations

### 5.3 listBySchema Optimization Tests

- `listBySchema("Article", limit=10)` returns correct results
- Results match old behavior (same nodes, same schema enrichment)
- Pagination: offset=5, limit=5 returns correct window
- Empty schema returns empty results
- Performance: with per-schema relation, listBySchema on 10K nodes < 5ms

### 5.4 Cache Integration Tests

- First `listBySchema` populates cache (sync fires)
- Second `listBySchema` served from cache (if handler-level caching)
- `Schema/applyTo` invalidates cache for that schema
- `Schema/removeFrom` invalidates cache
- `ContentStorage/save` invalidates cache for all entity's schemas

### 5.5 SQL Adapter Tests (if applicable)

- `ensureIndex` generates correct DDL
- `find` with indexed criteria uses WHERE clause
- JOIN query for fallback path produces correct results

---

## 6. Impact Analysis

### 6.1 Files Modified

| File | Change |
|---|---|
| `runtime/types.ts` | Add `ensureIndex?` to ConceptStorage interface |
| `runtime/adapters/storage.ts` | Secondary index implementation |
| `handlers/ts/app/content-node.handler.ts` | Optimized listBySchema |

### 6.2 Files Created

| File | Description |
|---|---|
| `clef-base/suites/entity-lifecycle/syncs/schema-index-on-apply.sync` | Denormalize on Schema/applyTo |
| `clef-base/suites/entity-lifecycle/syncs/schema-index-on-remove.sync` | Clean up on Schema/removeFrom |
| `clef-base/suites/entity-lifecycle/syncs/schema-index-on-save.sync` | Update denormalized on save |
| `clef-base/suites/entity-lifecycle/syncs/cache-list-by-schema.sync` | Cache population |
| `clef-base/suites/entity-lifecycle/syncs/schema-change-invalidates-cache.sync` | Cache invalidation on apply |
| `clef-base/suites/entity-lifecycle/syncs/schema-remove-invalidates-cache.sync` | Cache invalidation on remove |
| `tests/storage-secondary-index.test.ts` | Index tests |
| `tests/content-pool-optimization.test.ts` | Integration tests |

---

## 7. Open Questions

1. **Sync fan-out for multi-schema save**: When a ContentNode is saved and has 3 schemas, `SchemaIndexOnSave` needs to update 3 per-schema relations. Does the sync engine support iterating over a set result from `getSchemasFor`? If not, need a traverse pattern or handler-level loop.

2. **Seed-time sync activation**: Do syncs fire during `applyDeclarativeSeeds()`? If yes, per-schema relations populate automatically. If no, need a `rebuildSchemaIndex` bootstrap action.

3. **Cache at handler vs sync level**: Handler-level caching (check cache before query) is fastest but couples handler to Cache. Sync-level caching (write cache after query, read via separate path) is cleaner but requires ViewRenderer/kernel changes to check cache first.

4. **SQL adapter implementation**: The PostgreSQL and SQLite adapter concepts exist but their handler implementations weren't found in the audit. Should this PRD include SQL adapter index creation, or defer to a separate card?

Resolved by default: Going with sync-level caching and noting SQL as deferred unless adapters are found.
