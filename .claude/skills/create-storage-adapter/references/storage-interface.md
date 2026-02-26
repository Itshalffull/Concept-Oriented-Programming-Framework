# Storage Interface Reference

Complete type definitions for the Clef storage layer. All storage adapters implement `ConceptStorage`.

## ConceptStorage

The interface every storage adapter must implement:

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

## Method Contracts

### `put(relation, key, value): Promise<void>`

Create or replace a record.

**Parameters:**
- `relation` — The relation name (e.g., `"article"`, `"credentials"`, `"follow"`)
- `key` — The record's unique key within this relation (always a string)
- `value` — The record data as a flat object

**Contract:**
- If the relation doesn't exist, create it
- If the key doesn't exist in the relation, insert a new record
- If the key exists:
  - If `onConflict` callback is set, call it and handle the resolution
  - If no `onConflict`, overwrite (LWW) with a console warning if the existing record has a more recent timestamp
- Store a `lastWrittenAt` timestamp alongside the record (for `getMeta()`)
- Store a defensive copy of `value` (not the original reference)

**Complexity:** O(1) expected

**Example calls from real concepts:**
```typescript
// Simple create (user.handler.ts)
await storage.put('user', user, { user, name, email });

// Create with timestamps (article.handler.ts)
await storage.put('article', article, {
  article, slug, title, description, body, author,
  createdAt: now, updatedAt: now,
});

// Update via spread (article.handler.ts)
const existing = await storage.get('article', article);
await storage.put('article', article, {
  ...existing,
  slug, title, description, body,
  updatedAt: now,
});

// Store array-valued field (follow.handler.ts)
await storage.put('follow', user, { user, following });
```

### `get(relation, key): Promise<Record<string, unknown> | null>`

Retrieve a single record by key.

**Parameters:**
- `relation` — The relation name
- `key` — The record key

**Contract:**
- Returns a **copy** of the record's fields, or `null` if not found
- Must NOT include internal metadata (timestamps, storage IDs) in the returned object
- If the relation doesn't exist, return `null` (don't throw)

**Complexity:** O(1) expected

**Example calls:**
```typescript
// Read with null check (article.handler.ts)
const record = await storage.get('article', article);
if (!record) {
  return { variant: 'notfound', message: 'Article not found' };
}

// Read-modify-write (follow.handler.ts)
const existing = await storage.get('follow', user);
const following: string[] = existing ? (existing.following as string[]) : [];
```

### `find(relation, criteria?): Promise<Record<string, unknown>[]>`

Query records in a relation.

**Parameters:**
- `relation` — The relation name
- `criteria` — Optional filter: key-value pairs for equality matching (AND semantics)

**Contract:**
- No criteria → return **all** records in the relation
- With criteria → return records where **all** specified fields match (AND)
- Returns **copies** of matching records
- Returns `[]` if the relation is empty or doesn't exist (don't throw)
- Criteria uses **exact equality** (`===`) for matching

**Complexity:** O(n) where n = number of records in the relation

**Example calls:**
```typescript
// Find all (tag.handler.ts)
const allTags = await storage.find('tag');

// Find with criteria — uniqueness check (user.handler.ts)
const existingByName = await storage.find('user', { name });
if (existingByName.length > 0) {
  return { variant: 'error', message: 'name already taken' };
}

// Find with criteria — filter by field (comment.handler.ts)
const results = await storage.find('comment', { target });
```

### `del(relation, key): Promise<void>`

Delete a single record.

**Parameters:**
- `relation` — The relation name
- `key` — The record key

**Contract:**
- Delete the record at (relation, key)
- **Silent no-op** if the key doesn't exist (don't throw)
- Also removes associated metadata (`getMeta()` should return `null` after `del()`)

**Complexity:** O(1) expected

**Example calls:**
```typescript
// Simple delete (article.handler.ts)
await storage.del('article', article);

// Cascading delete across relations (registry.handler.ts)
await storage.del('concepts', conceptId);
await storage.del('uri', conceptId);
await storage.del('transport', conceptId);
await storage.del('available', conceptId);
```

### `delMany(relation, criteria): Promise<number>`

Delete all records matching criteria.

**Parameters:**
- `relation` — The relation name
- `criteria` — Filter: key-value pairs for equality matching (AND semantics)

**Contract:**
- Delete all records where all specified criteria fields match
- Return the **count** of deleted records
- Returns `0` if no matches (don't throw)

**Complexity:** O(n) where n = number of records in the relation

**Example calls:**
```typescript
// Delete all comments on an article
const count = await storage.delMany('comment', { target: articleId });

// Delete by category
const count = await storage.delMany('items', { color: 'red' });
```

### `getMeta?(relation, key): Promise<EntryMeta | null>` (Optional)

Retrieve write metadata for a record.

**Parameters:**
- `relation` — The relation name
- `key` — The record key

**Contract:**
- Returns `{ lastWrittenAt: string }` (ISO 8601 timestamp) or `null`
- Returns `null` if the key doesn't exist (including after deletion)
- Used by the conflict detection system to compare write timestamps

**Example:**
```typescript
const meta = await storage.getMeta!('articles', 'art-1');
// meta = { lastWrittenAt: "2026-01-15T10:30:00.000Z" }
```

### `onConflict?: (info: ConflictInfo) => ConflictResolution` (Optional)

Callback for conflict detection during `put()`.

**Contract:**
- Set by the caller (engine/test) on the storage instance
- Called by `put()` when overwriting an existing record
- NOT called when inserting a new record
- Returns one of four resolution strategies

See [conflict-resolution.md](conflict-resolution.md) for the full protocol.

## Supporting Types

### EntryMeta

```typescript
interface EntryMeta {
  lastWrittenAt: string;  // ISO 8601 timestamp of the last write
}
```

### ConflictInfo

```typescript
interface ConflictInfo {
  relation: string;
  key: string;
  existing: { fields: Record<string, unknown>; writtenAt: string };
  incoming: { fields: Record<string, unknown>; writtenAt: string };
}
```

### ConflictResolution

```typescript
type ConflictResolution =
  | { action: 'keep-existing' }                             // Don't write
  | { action: 'accept-incoming' }                           // Write incoming
  | { action: 'merge'; merged: Record<string, unknown> }    // Write merged
  | { action: 'escalate' };                                 // Write incoming + signal conflict
```

## Performance Expectations

| Method | Expected Complexity | Notes |
|--------|-------------------|-------|
| `put()` | O(1) | Single key upsert |
| `get()` | O(1) | Single key lookup |
| `find()` (no criteria) | O(n) | Full relation scan |
| `find()` (with criteria) | O(n) | Scan + filter (index could improve) |
| `del()` | O(1) | Single key delete |
| `delMany()` | O(n) | Scan + filter + delete |
| `getMeta()` | O(1) | Single key lookup |

## Source Locations

| Type | File | Lines |
|------|------|-------|
| `ConceptStorage` | `kernel/src/types.ts` | 68-78 |
| `EntryMeta` | `kernel/src/types.ts` | 49-51 |
| `ConflictInfo` | `kernel/src/types.ts` | 61-66 |
| `ConflictResolution` | `kernel/src/types.ts` | 54-58 |
| `ConceptHandler` | `kernel/src/types.ts` | 82-87 |
| `createInMemoryStorage()` | `kernel/src/storage.ts` | 30-145 |
