# Existing Storage Implementation Walkthrough

Annotated walkthrough of the in-memory storage adapter — the only currently implemented `ConceptStorage` backend. Use as a reference model for new adapters.

## In-Memory Storage

**Source:** `kernel/src/storage.ts` (145 lines)
**Factory:** `createInMemoryStorage()`
**Backend:** JavaScript `Map` objects (no persistence)
**Used for:** Tests, development, ephemeral concepts

### Internal Data Structure

```typescript
/** Internal entry with metadata */
interface StoredEntry {
  fields: Record<string, unknown>;  // The user-visible data
  meta: EntryMeta;                  // { lastWrittenAt: string }
}

// relations = Map<relationName, Map<key, StoredEntry>>
const relations = new Map<string, Map<string, StoredEntry>>();
```

**Key design decision:** Each record is stored as a `StoredEntry` that wraps the user's `fields` and internal `meta` separately. This ensures metadata never leaks into `get()`/`find()` results.

### Relation Access Helper

```typescript
function getRelation(name: string): Map<string, StoredEntry> {
  let rel = relations.get(name);
  if (!rel) {
    rel = new Map();
    relations.set(name, rel);
  }
  return rel;
}
```

**Lazy creation:** Relations are created on first access. No need to declare them upfront.

### put() — Create or Replace with Conflict Detection

```typescript
async put(relation, key, value) {
  const rel = getRelation(relation);
  const now = new Date().toISOString();
  const existing = rel.get(key);

  if (existing) {
    // --- Conflict detection ---
    if (storage.onConflict) {
      const info: ConflictInfo = {
        relation,
        key,
        existing: {
          fields: { ...existing.fields },      // Copy of current data
          writtenAt: existing.meta.lastWrittenAt,
        },
        incoming: {
          fields: { ...value },                 // Copy of incoming data
          writtenAt: now,
        },
      };

      const resolution = storage.onConflict(info);

      switch (resolution.action) {
        case 'keep-existing':
          return;  // Don't write — existing value preserved
        case 'accept-incoming':
          break;   // Fall through to normal write below
        case 'merge':
          // Write the merged result instead of incoming
          rel.set(key, {
            fields: { ...resolution.merged },
            meta: { lastWrittenAt: now },
          });
          return;
        case 'escalate':
          // Write incoming but signal conflict to caller
          break;   // Fall through to normal write below
      }
    } else {
      // No callback — default LWW with warning
      if (existing.meta.lastWrittenAt > now) {
        console.warn(
          `[clef/storage] LWW conflict: overwriting ${relation}/${key} ` +
          `(existing: ${existing.meta.lastWrittenAt}, incoming: ${now})`,
        );
      }
    }
  }

  // Normal write (new entry, accept-incoming, or escalate)
  rel.set(key, {
    fields: { ...value },           // Defensive copy
    meta: { lastWrittenAt: now },   // Track write time
  });
}
```

**Critical details:**
1. **Defensive copies everywhere** — `{ ...existing.fields }`, `{ ...value }`, `{ ...resolution.merged }`. Never stores or exposes the original reference.
2. **Timestamp always set** — Even for `merge` and `escalate` resolutions, `lastWrittenAt` is updated to `now`.
3. **onConflict only called for existing keys** — New record insertions skip the conflict check entirely.
4. **LWW warning is non-blocking** — The write always proceeds; the warning is informational.

### get() — Key Lookup with Copy

```typescript
async get(relation, key) {
  const rel = getRelation(relation);
  const entry = rel.get(key);
  return entry ? { ...entry.fields } : null;
}
```

**Returns `entry.fields`** (user data only), not the full `StoredEntry`. Metadata never leaks. Returns a spread copy (`{ ...entry.fields }`) so mutations by the caller don't affect stored data.

### find() — Scan with Criteria

```typescript
async find(relation, criteria?) {
  const rel = getRelation(relation);
  const entries = Array.from(rel.values()).map(e => e.fields);

  if (!criteria || Object.keys(criteria).length === 0) {
    // No criteria → return all records (as copies)
    return entries.map(e => ({ ...e }));
  }

  // Filter by criteria (AND semantics, equality matching)
  return entries
    .filter(entry =>
      Object.entries(criteria!).every(([k, v]) => entry[k] === v),
    )
    .map(e => ({ ...e }));  // Return copies
}
```

**Key behaviors:**
1. **Extracts `fields` only** — Maps `StoredEntry` → `fields` before filtering.
2. **AND semantics** — `every()` ensures all criteria fields must match.
3. **Strict equality** — Uses `===` for comparison.
4. **Returns copies** — Each returned record is a new object.
5. **Empty relation returns `[]`** — `getRelation()` creates an empty Map, so `Array.from(Map.values())` is `[]`.

### del() — Key Delete (Silent No-Op)

```typescript
async del(relation, key) {
  const rel = getRelation(relation);
  rel.delete(key);
}
```

**Simple:** `Map.delete()` is a no-op if the key doesn't exist. No error thrown.

### delMany() — Bulk Delete with Count

```typescript
async delMany(relation, criteria) {
  const rel = getRelation(relation);
  let count = 0;
  for (const [key, entry] of rel.entries()) {
    if (Object.entries(criteria).every(([k, v]) => entry.fields[k] === v)) {
      rel.delete(key);
      count++;
    }
  }
  return count;
}
```

**Key details:**
1. **Matches against `entry.fields`** (not the full `StoredEntry`).
2. **Same AND/equality semantics** as `find()`.
3. **Returns delete count** — Used by callers for cascading operations.
4. **Safe iteration** — Iterating and deleting from a Map within a `for...of` loop is safe in JavaScript.

### getMeta() — Timestamp Retrieval

```typescript
async getMeta(relation, key) {
  const rel = getRelation(relation);
  const entry = rel.get(key);
  return entry ? { ...entry.meta } : null;
}
```

**Returns `entry.meta`** (the `{ lastWrittenAt }` object), or `null`. Returns a copy so callers can't modify internal metadata.

## How Storage Gets Wired to Concepts

### In registerConcept() (self-hosted.ts)

```typescript
registerConcept(uri: string, handler: ConceptHandler): void {
  const storage = createInMemoryStorage();
  const transport = createInProcessAdapter(handler, storage);
  registry.register(uri, transport);
}
```

Each call creates a **fresh, isolated** storage instance. The `InProcessAdapter` holds a reference to both the handler and storage, passing storage to every handler call.

### In registerVersionedConcept() (kernel-factory.ts)

```typescript
async registerVersionedConcept(uri, handler, specVersion) {
  const storage = createInMemoryStorage();
  const baseTransport = createInProcessAdapter(handler, storage);

  const needed = await checkMigrationNeeded(specVersion, storage);
  if (needed) {
    const gated = createMigrationGatedTransport(baseTransport, storage, ...);
    registry.register(uri, gated);
    return;
  }

  registry.register(uri, baseTransport);
}
```

Same isolation pattern, with an optional migration gate that wraps the transport.

## How Storage Bridges to the Lite Query Protocol

The `createStorageLiteProtocol()` function bridges `ConceptStorage` to the `LiteQueryProtocol`:

```typescript
export function createStorageLiteProtocol(
  storage: ConceptStorage,
  relationNames: string[],
): LiteQueryProtocol {
  return {
    async snapshot() {
      const relations: Record<string, Record<string, unknown>[]> = {};
      for (const name of relationNames) {
        relations[name] = await storage.find(name);
      }
      return { asOf: new Date().toISOString(), relations };
    },

    async lookup(relation, key) {
      return storage.get(relation, key);
    },

    async filter(criteria) {
      // ... filter implementation
    },
  };
}
```

**Three tiers backed by storage:**
- **snapshot()** → calls `storage.find()` for each relation name
- **lookup()** → calls `storage.get()` (O(1))
- **filter()** → calls `storage.find()` + `applyFilter()` per criterion

## Testing the In-Memory Storage

**Source:** `tests/storage.test.ts` (89 lines)

The test suite verifies the storage contract:

```typescript
import { createInMemoryStorage, type ConceptStorage } from '@clef/kernel';

describe('In-Memory Storage', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('puts and gets a record', async () => {
    await storage.put('users', 'u1', { name: 'Alice', email: 'a@b.com' });
    const record = await storage.get('users', 'u1');
    expect(record).toEqual({ name: 'Alice', email: 'a@b.com' });
  });

  it('returns null for missing record', async () => {
    expect(await storage.get('users', 'nonexistent')).toBeNull();
  });

  it('overwrites existing record', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.put('users', 'u1', { name: 'Bob' });
    expect((await storage.get('users', 'u1'))!.name).toBe('Bob');
  });

  it('finds all records', async () => {
    await storage.put('users', 'u1', { name: 'Alice', role: 'admin' });
    await storage.put('users', 'u2', { name: 'Bob', role: 'user' });
    await storage.put('users', 'u3', { name: 'Charlie', role: 'user' });
    expect(await storage.find('users')).toHaveLength(3);
  });

  it('finds records matching criteria', async () => {
    await storage.put('users', 'u1', { name: 'Alice', role: 'admin' });
    await storage.put('users', 'u2', { name: 'Bob', role: 'user' });
    await storage.put('users', 'u3', { name: 'Charlie', role: 'user' });
    const users = await storage.find('users', { role: 'user' });
    expect(users).toHaveLength(2);
  });

  it('deletes a record', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.del('users', 'u1');
    expect(await storage.get('users', 'u1')).toBeNull();
  });

  it('deletes records matching criteria', async () => {
    await storage.put('users', 'u1', { name: 'Alice', role: 'admin' });
    await storage.put('users', 'u2', { name: 'Bob', role: 'user' });
    await storage.put('users', 'u3', { name: 'Charlie', role: 'user' });
    expect(await storage.delMany('users', { role: 'user' })).toBe(2);
    expect(await storage.find('users')).toHaveLength(1);
  });

  it('returns empty for empty relation', async () => {
    expect(await storage.find('empty')).toEqual([]);
  });

  it('isolates relations', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.put('posts', 'p1', { title: 'Hello' });
    expect(await storage.find('users')).toHaveLength(1);
    expect(await storage.find('posts')).toHaveLength(1);
  });
});
```

This same test suite can be run against any storage adapter — just replace `createInMemoryStorage()` with your factory function.

## Planned But Not Yet Implemented Backends

The architecture document (Section 6.8) specifies two additional backends:

### SQLite Storage

```typescript
function createSQLiteStorage(
  dbPath: string,
  manifest: ConceptManifest,
): ConceptStorage;
```

Would use `ConceptManifest.relations` to create tables with typed columns. Each relation becomes a SQLite table. `find()` criteria maps to `WHERE` clauses.

### PostgreSQL Storage

```typescript
function createPostgresStorage(
  connectionUrl: string,
  manifest: ConceptManifest,
): ConceptStorage;
```

Same approach as SQLite but with PostgreSQL. Would support connection pooling and transactions.

### Common Traits of Planned Backends

Both planned backends:
- Accept a `ConceptManifest` to know the schema (relation names, field types)
- Create tables automatically from the manifest
- Map `find()` criteria to SQL `WHERE` clauses
- Support `getMeta()` via a `_lastWrittenAt` column
- Support `onConflict` via `SELECT ... FOR UPDATE` or `ON CONFLICT`
