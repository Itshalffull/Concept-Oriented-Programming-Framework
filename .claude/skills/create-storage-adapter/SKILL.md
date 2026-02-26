---
name: create-storage-adapter
description: Write a Clef storage adapter that implements the ConceptStorage interface for a specific persistence backend (SQLite, PostgreSQL, Core Data, localStorage, or custom). Use when adding a new storage backend or customizing how concepts persist their data.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<backend-name>"
---

# Create a Clef Storage Adapter

Write a storage adapter for **$ARGUMENTS** that implements the `ConceptStorage` interface, giving concepts a persistence backend they can use to store and retrieve state.

## What is a Storage Adapter?

A **storage adapter** wraps a persistence backend behind the `ConceptStorage` interface. Every concept handler receives its own isolated storage instance — the adapter translates the document-oriented API (`put`, `get`, `find`, `del`, `delMany`) into backend-specific operations.

```
┌──────────────────┐    ConceptStorage    ┌──────────────────────┐
│  Concept Handler │─────────────────────▶│   Storage Adapter    │
│  (business logic)│  put/get/find/del    │  (backend-specific)  │
└──────────────────┘                      └──────────┬───────────┘
                                                     │
                                          ┌──────────▼───────────┐
                                          │  Persistence Backend │
                                          │  (SQLite, Postgres,  │
                                          │   Core Data, etc.)   │
                                          └──────────────────────┘
```

### Core Principle: Sovereign Storage

From the architecture doc: *"Each concept owns its data. No shared database. The concept chooses its own persistence strategy — Postgres, SQLite, Core Data, in-memory, a file — as an implementation detail."*

This means:
- Each concept gets its **own** storage instance (never shared)
- Cross-concept data access happens **only** through syncs and where-clause queries
- The storage adapter is invisible to business logic — handlers just call `storage.put()`, `storage.get()`, etc.

### The ConceptStorage Interface

```typescript
interface ConceptStorage {
  put(relation: string, key: string, value: Record<string, unknown>): Promise<void>;
  get(relation: string, key: string): Promise<Record<string, unknown> | null>;
  find(relation: string, criteria?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  del(relation: string, key: string): Promise<void>;
  delMany(relation: string, criteria: Record<string, unknown>): Promise<number>;
  getMeta?(relation: string, key: string): Promise<EntryMeta | null>;
  onConflict?: (info: ConflictInfo) => ConflictResolution;
}
```

See [references/storage-interface.md](references/storage-interface.md) for full type definitions.

## Step-by-Step Process

### Step 1: Understand the Data Model

Clef storage is **document-oriented by relation**. Each storage instance contains named relations (like tables or collections), and each relation contains records keyed by a string ID.

```
Storage Instance (one per concept)
├── relation: "article"
│   ├── key: "art-1" → { article: "art-1", title: "...", body: "..." }
│   ├── key: "art-2" → { article: "art-2", title: "...", body: "..." }
│   └── ...
├── relation: "tag"
│   ├── key: "javascript" → { tag: "javascript", articles: ["art-1"] }
│   └── ...
└── relation: "_meta"      (reserved: schema version tracking)
    └── key: "schema" → { version: 2 }
```

**Key characteristics:**
- Relations are created lazily (first `put` creates the relation)
- Keys are always strings
- Values are flat `Record<string, unknown>` objects (may contain arrays, nested objects)
- Each record includes its key field in the value (e.g., `{ article: "art-1", ... }`)
- The `_meta` relation with key `"schema"` is reserved for schema version tracking

### Step 2: Implement the Core Methods

Every storage adapter must implement 5 required methods:

```typescript
export function createMyStorage(
  /* backend-specific config */
): ConceptStorage {
  const storage: ConceptStorage = {
    async put(relation, key, value) {
      // Upsert: create or replace the record at (relation, key)
      // Must store value as-is (no field filtering)
      // Must track lastWrittenAt timestamp (for conflict detection)
    },

    async get(relation, key) {
      // Return the record at (relation, key), or null
      // Must return a COPY (not a reference to internal state)
      // Must NOT include metadata in the returned object
    },

    async find(relation, criteria?) {
      // Return all records in the relation matching criteria
      // No criteria → return all records
      // Criteria → AND matching on all specified fields (equality)
      // Must return copies
    },

    async del(relation, key) {
      // Delete the record at (relation, key)
      // Silent no-op if the record doesn't exist
    },

    async delMany(relation, criteria) {
      // Delete all records in the relation matching criteria
      // Return the count of deleted records
    },
  };

  return storage;
}
```

See [references/storage-interface.md](references/storage-interface.md) for the exact contract of each method.

### Step 3: Implement Metadata (Optional but Recommended)

The optional `getMeta()` method returns write timestamps for conflict detection:

```typescript
async getMeta(relation, key) {
  // Return { lastWrittenAt: "ISO-8601 string" } or null
  // Used by the conflict detection system
}
```

See [references/conflict-resolution.md](references/conflict-resolution.md) for the full conflict detection system.

### Step 4: Support Conflict Detection (Optional but Recommended)

The optional `onConflict` callback enables four resolution strategies when `put()` overwrites an existing record:

```typescript
storage.onConflict = (info: ConflictInfo): ConflictResolution => {
  // info contains: relation, key, existing.fields, existing.writtenAt,
  //                incoming.fields, incoming.writtenAt
  return { action: 'accept-incoming' };  // or keep-existing, merge, escalate
};
```

Your `put()` implementation must:
1. Check if a record already exists at (relation, key)
2. If it does AND `storage.onConflict` is set, call the callback
3. Handle the four resolution strategies: `keep-existing`, `accept-incoming`, `merge`, `escalate`
4. If no `onConflict` callback, use last-writer-wins (LWW) with a console warning

See [references/conflict-resolution.md](references/conflict-resolution.md) for the full protocol.

### Step 5: Handle Relation Patterns

Study how concepts use storage to ensure your adapter supports all patterns:

| Pattern | Example | Methods Used |
|---------|---------|-------------|
| Simple CRUD | Article create/update/delete/get | `put`, `get`, `del` |
| Uniqueness check | User registration | `find` with criteria |
| Array-valued fields | Follow/Favorite lists | `get`, `put` (read-modify-write) |
| Bulk delete | Delete all comments on article | `delMany` with criteria |
| Schema migration | Version tracking | `put`/`get` on `_meta`/`schema` |

See [references/relation-patterns.md](references/relation-patterns.md) for complete patterns from all RealWorld concepts.

### Step 6: Ensure Data Isolation

Critical invariants your adapter must maintain:

1. **Return copies, not references** — `get()` and `find()` must return new objects. If a handler modifies the returned object, it must not affect stored data.

2. **No metadata leakage** — `get()` and `find()` must NOT include internal metadata (timestamps, storage IDs) in returned records. Only user-provided fields.

3. **Relation isolation** — Operations on one relation must never affect another relation.

4. **Instance isolation** — Each `createMyStorage()` call returns an independent instance. Data from one concept's storage is never visible to another.

### Step 7: Wire into the System

Storage adapters are paired with concept handlers through the transport layer:

```typescript
import { createInProcessAdapter } from './transport.js';
import { createMyStorage } from './my-storage.js';

// Create isolated storage for this concept
const storage = createMyStorage(/* config */);

// Pair with handler via transport adapter
const transport = createInProcessAdapter(handler, storage);

// Register in the concept registry
registry.register('urn:app:MyConcept', transport);
```

The `InProcessAdapter` passes the storage instance to every handler call:
```typescript
const result = await actionFn(invocation.input, storage);
```

### Step 8: Declare in Deployment Manifest

The deployment manifest specifies which storage backend each concept uses:

```yaml
concepts:
  Article:
    spec: ./specs/article.concept
    implementations:
      - language: typescript
        runtime: server
        storage: my-backend    # Your new storage backend
        queryMode: graphql
```

### Step 9: Write Tests

Test your adapter against the standard storage contract:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMyStorage } from './my-storage.js';
import type { ConceptStorage } from './types.js';

let storage: ConceptStorage;

beforeEach(() => {
  storage = createMyStorage(/* test config */);
});

// Test put/get, find, del, delMany, metadata, conflict resolution
// See templates/storage-scaffold.md for the full test template
```

## Existing Backends

| Backend | Factory | File | Status |
|---------|---------|------|--------|
| In-Memory | `createInMemoryStorage()` | `kernel/src/storage.ts` | Implemented |
| SQLite | `createSQLiteStorage(dbPath, manifest)` | — | Planned (Architecture 6.8) |
| PostgreSQL | `createPostgresStorage(connUrl, manifest)` | — | Planned (Architecture 6.8) |
| Core Data | — | — | Planned (Swift runtime) |
| localStorage | — | — | Planned (Browser runtime) |

See [examples/existing-storage.md](examples/existing-storage.md) for a complete annotated walkthrough of the in-memory implementation.

## Design Guidelines

- **All methods async** — Even if your backend is synchronous (like localStorage), wrap returns in Promises for interface compliance.
- **Lazy relation creation** — Relations should be created on first `put()`, not pre-declared. Concepts may use any number of relations.
- **`find()` uses AND semantics** — When criteria has multiple fields, ALL must match (not OR).
- **`del()` is a silent no-op** — Deleting a non-existent key must not throw.
- **`delMany()` returns a count** — The count of actually deleted records.
- **Copies on read** — Always return new objects from `get()` and `find()`. Never return internal references.
- **No metadata leakage** — Internal timestamps and storage IDs must be invisible in `get()`/`find()` results.
- **Reserved `_meta` relation** — The framework uses `_meta` with key `"schema"` for schema migration tracking. Your adapter must support this like any other relation.
- **O(1) for get/put/del** — Key-based operations should be constant-time when possible. `find()` and `delMany()` may be O(n).

## Quick Reference

See [references/storage-interface.md](references/storage-interface.md) for the full ConceptStorage interface, EntryMeta, ConflictInfo, and ConflictResolution types.
See [references/conflict-resolution.md](references/conflict-resolution.md) for the conflict detection and resolution protocol.
See [references/relation-patterns.md](references/relation-patterns.md) for how concepts use storage (patterns from all RealWorld concepts).
See [examples/existing-storage.md](examples/existing-storage.md) for annotated walkthrough of the in-memory implementation.
See [templates/storage-scaffold.md](templates/storage-scaffold.md) for copy-paste adapter templates.

## Related Skills

| Skill | When to Use |
|-------|------------|
| `/create-transport-adapter` | Write the transport adapter that delivers actions to concepts |
| `/create-implementation` | Write the concept handler that uses this storage |
| `/configure-deployment` | Wire this storage into a deployment manifest |
| `/create-suite` | Bundle this storage into a domain suite's infrastructure |
