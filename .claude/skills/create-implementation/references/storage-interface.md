# Storage Interface Reference

The complete ConceptStorage API, document model, and usage patterns.

## ConceptStorage Interface

```typescript
// From kernel/src/types.ts
export interface ConceptStorage {
  put(relation: string, key: string, value: Record<string, unknown>): Promise<void>;
  get(relation: string, key: string): Promise<Record<string, unknown> | null>;
  find(relation: string, criteria?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  del(relation: string, key: string): Promise<void>;
  delMany(relation: string, criteria: Record<string, unknown>): Promise<number>;
  getMeta?(relation: string, key: string): Promise<EntryMeta | null>;
  onConflict?: (info: ConflictInfo) => ConflictResolution;
}
```

Every concept gets its own **isolated** storage instance. Concepts cannot access each other's storage — all cross-concept data access happens through syncs and where-clause queries.

## Document Model

Storage is **document-oriented by relation**. Each concept has one or more **relations** (think: tables or collections), and each relation holds **records** keyed by a string ID.

```
Concept Storage
├── relation "article"
│   ├── key "article-001" → { article, slug, title, description, body, author, createdAt, updatedAt }
│   ├── key "article-002" → { ... }
│   └── key "article-003" → { ... }
├── relation "comment"
│   ├── key "comment-001" → { comment, body, target, author, createdAt }
│   └── key "comment-002" → { ... }
```

### Relation Naming

Relations map from the concept spec's `state` section. Convention:

| Spec State | Relation Name | Key |
|-----------|---------------|-----|
| `articles: set A` | `'article'` | Article ID (type param A) |
| `name: U -> String` | `'user'` | User ID (type param U) |
| `hash: U -> Bytes` | `'password'` | User ID (type param U) |
| `tokens: U -> String` | `'tokens'` | User ID (type param U) |

When a spec has multiple `U -> X` mappings (like `hash: U -> Bytes` and `salt: U -> Bytes`), they merge into a **single relation** keyed by `U`, with fields for each mapping.

### Record Structure

Records are plain objects with string keys and unknown values. Always include the key field for easy access after queries:

```typescript
await storage.put('article', article, {
  article,          // Include the key for self-reference
  slug,
  title,
  description,
  body,
  author,
  createdAt: now,
  updatedAt: now,
});
```

## Core Operations

### put(relation, key, value)

Store or overwrite a record.

```typescript
// Create a new record
await storage.put('user', userId, { user: userId, name, email });

// Overwrite an existing record (full replacement)
await storage.put('article', articleId, { ...existing, title: newTitle, updatedAt: now });
```

**Behavior:**
- If the key doesn't exist, creates a new record
- If the key exists, **replaces** the entire record (not a merge)
- Tracks `lastWrittenAt` timestamp automatically
- If `onConflict` is set, detects concurrent writes

**Always include all fields** when updating — `put()` does full replacement, not partial update:

```typescript
// CORRECT: spread existing, overwrite what changed
const existing = await storage.get('article', id);
await storage.put('article', id, { ...existing, title: newTitle, updatedAt: now });

// WRONG: loses all other fields
await storage.put('article', id, { title: newTitle });
```

### get(relation, key)

Fetch a single record by key. Returns `null` if not found.

```typescript
const record = await storage.get('article', articleId);
if (!record) {
  return { variant: 'notfound', message: 'Article not found' };
}

// Access fields
const title = record.title as string;
const author = record.author as string;
```

**Always check for null** before accessing fields.

### find(relation, criteria?)

Query records by field values. Returns an array (empty if no matches).

```typescript
// Find all records in a relation
const allUsers = await storage.find('user');

// Find by exact field match
const matches = await storage.find('user', { email: 'alice@example.com' });

// Find by multiple criteria (AND semantics)
const results = await storage.find('comment', { target: articleId, author: userId });
```

**Behavior:**
- No criteria → returns all records in the relation
- Criteria → exact equality match on all specified fields (AND)
- Returns copies of records (safe to mutate)
- Order is not guaranteed

### del(relation, key)

Delete a single record by key.

```typescript
await storage.del('article', articleId);
```

**Behavior:**
- Silently succeeds even if key doesn't exist
- Always check existence first if you need `notfound` variant

### delMany(relation, criteria)

Delete all records matching criteria. Returns the count of deleted records.

```typescript
const count = await storage.delMany('comment', { target: articleId });
```

**Behavior:**
- Criteria uses same matching as `find()` (exact equality, AND)
- Returns count of deleted records
- Useful for cascade deletes

## Optional: Metadata

### getMeta(relation, key)

Retrieve write timestamp for a stored entry.

```typescript
const meta = await storage.getMeta?.('article', articleId);
if (meta) {
  console.log(`Last written at: ${meta.lastWrittenAt}`);
}
```

Returns `{ lastWrittenAt: string }` (ISO 8601 timestamp) or `null`.

## Optional: Conflict Detection

### onConflict Callback

For eventual syncs with concurrent writes:

```typescript
storage.onConflict = (info: ConflictInfo): ConflictResolution => {
  // info.relation, info.key
  // info.existing.fields, info.existing.writtenAt
  // info.incoming.fields, info.incoming.writtenAt

  // Option 1: Keep the existing record
  return { action: 'keep-existing' };

  // Option 2: Accept the incoming write
  return { action: 'accept-incoming' };

  // Option 3: Custom merge
  return { action: 'merge', merged: { ...info.existing.fields, ...info.incoming.fields } };

  // Option 4: Escalate to a sync
  return { action: 'escalate' };
};
```

Most app implementations don't need this — it's for eventual syncs spanning runtimes.

## Storage Patterns by Use Case

### Single-Relation CRUD

Most concepts use one relation:

```typescript
// User concept: one 'user' relation
await storage.put('user', userId, { user: userId, name, email });
const user = await storage.get('user', userId);
const byEmail = await storage.find('user', { email });
await storage.del('user', userId);
```

### Multi-Relation

Some concepts use multiple relations for different data:

```typescript
// Registry concept: 4 relations
await storage.put('concepts', id, { id, uri, name });
await storage.put('uri', uri, { uri, concept: id });
await storage.put('transport', id, { id, transport });
await storage.put('available', id, { id, available: true });
```

### Array-Valued Fields

For set-typed state (`favorites: set Article`):

```typescript
// Read or initialize array
const existing = await storage.get('favorite', userId);
const favorites: string[] = existing ? (existing.favorites as string[]) : [];

// Add to array
if (!favorites.includes(articleId)) {
  favorites.push(articleId);
}
await storage.put('favorite', userId, { user: userId, favorites });

// Remove from array
const updated = favorites.filter(a => a !== articleId);
await storage.put('favorite', userId, { user: userId, favorites: updated });

// Check membership
const isFav = favorites.includes(articleId);
```

### Metadata Relation

Framework concepts sometimes use a `_meta` relation for schema versioning:

```typescript
await storage.put('_meta', 'schema', { version: 2 });
const meta = await storage.get('_meta', 'schema');
const version = meta ? (meta.version as number) : 0;
```

## In-Memory Storage Factory

For tests and lightweight use:

```typescript
import { createInMemoryStorage } from '@clef/kernel';

const storage = createInMemoryStorage();
```

This creates a storage instance backed by in-memory Maps. Data is lost on process restart. The kernel factory creates one per registered concept automatically.

## Performance Notes

- `get()` is O(1) — direct key lookup
- `find()` is O(n) — scans all records in the relation
- `put()` is O(1) — direct key set
- `del()` is O(1) — direct key delete
- `delMany()` is O(n) — scans all records

For production workloads, the framework provides alternative storage backends (SQLite, PostgreSQL, etc.) that implement the same interface with indexed queries.
