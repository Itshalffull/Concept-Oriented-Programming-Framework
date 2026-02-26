# Storage Adapter Scaffold Templates

Copy-paste templates for creating new storage adapters. Each template is self-contained — fill in the backend-specific sections.

## Template 1: Minimal Custom Storage Adapter

The simplest possible adapter. Start here and add backend details.

```typescript
// my-storage.ts
import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
  ConflictResolution,
} from './types.js';

/**
 * Create a storage adapter for [backend name].
 */
export function createMyStorage(
  // Backend-specific config:
  config: { /* ... */ },
): ConceptStorage {
  // TODO: Initialize backend connection/state

  const storage: ConceptStorage = {
    async put(relation, key, value) {
      const now = new Date().toISOString();

      // TODO: Check if record exists at (relation, key)
      const existing = null; // TODO: fetch existing record

      if (existing) {
        // Conflict detection
        if (storage.onConflict) {
          const info: ConflictInfo = {
            relation,
            key,
            existing: {
              fields: { /* TODO: existing fields */ },
              writtenAt: /* TODO: existing timestamp */,
            },
            incoming: {
              fields: { ...value },
              writtenAt: now,
            },
          };

          const resolution = storage.onConflict(info);
          switch (resolution.action) {
            case 'keep-existing':
              return;
            case 'accept-incoming':
              break;
            case 'merge':
              // TODO: Store resolution.merged with lastWrittenAt = now
              return;
            case 'escalate':
              break;
          }
        }
      }

      // TODO: Store value with lastWrittenAt = now
    },

    async get(relation, key) {
      // TODO: Lookup record at (relation, key)
      // Return a COPY of the fields, or null
      // Do NOT include metadata in the return value
      return null;
    },

    async find(relation, criteria?) {
      // TODO: If no criteria, return all records in relation
      // TODO: If criteria, return records where ALL fields match (AND)
      // Return copies of matching records
      return [];
    },

    async del(relation, key) {
      // TODO: Delete record at (relation, key)
      // Silent no-op if key doesn't exist
    },

    async delMany(relation, criteria) {
      // TODO: Delete all records matching criteria
      // Return count of deleted records
      return 0;
    },

    async getMeta(relation, key) {
      // TODO: Return { lastWrittenAt } or null
      return null;
    },
  };

  return storage;
}
```

## Template 2: In-Memory Storage (Reference Implementation)

The canonical implementation. Matches `kernel/src/storage.ts` exactly.

```typescript
// memory-storage.ts
import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
} from './types.js';

interface StoredEntry {
  fields: Record<string, unknown>;
  meta: EntryMeta;
}

export function createInMemoryStorage(): ConceptStorage {
  const relations = new Map<string, Map<string, StoredEntry>>();

  function getRelation(name: string): Map<string, StoredEntry> {
    let rel = relations.get(name);
    if (!rel) {
      rel = new Map();
      relations.set(name, rel);
    }
    return rel;
  }

  const storage: ConceptStorage = {
    async put(relation, key, value) {
      const rel = getRelation(relation);
      const now = new Date().toISOString();
      const existing = rel.get(key);

      if (existing) {
        if (storage.onConflict) {
          const info: ConflictInfo = {
            relation,
            key,
            existing: {
              fields: { ...existing.fields },
              writtenAt: existing.meta.lastWrittenAt,
            },
            incoming: {
              fields: { ...value },
              writtenAt: now,
            },
          };

          const resolution = storage.onConflict(info);
          switch (resolution.action) {
            case 'keep-existing':
              return;
            case 'accept-incoming':
              break;
            case 'merge':
              rel.set(key, {
                fields: { ...resolution.merged },
                meta: { lastWrittenAt: now },
              });
              return;
            case 'escalate':
              break;
          }
        } else {
          if (existing.meta.lastWrittenAt > now) {
            console.warn(
              `[copf/storage] LWW conflict: overwriting ${relation}/${key} ` +
              `(existing: ${existing.meta.lastWrittenAt}, incoming: ${now})`,
            );
          }
        }
      }

      rel.set(key, {
        fields: { ...value },
        meta: { lastWrittenAt: now },
      });
    },

    async get(relation, key) {
      const rel = getRelation(relation);
      const entry = rel.get(key);
      return entry ? { ...entry.fields } : null;
    },

    async find(relation, criteria?) {
      const rel = getRelation(relation);
      const entries = Array.from(rel.values()).map(e => e.fields);

      if (!criteria || Object.keys(criteria).length === 0) {
        return entries.map(e => ({ ...e }));
      }

      return entries
        .filter(entry =>
          Object.entries(criteria!).every(([k, v]) => entry[k] === v),
        )
        .map(e => ({ ...e }));
    },

    async del(relation, key) {
      const rel = getRelation(relation);
      rel.delete(key);
    },

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
    },

    async getMeta(relation, key) {
      const rel = getRelation(relation);
      const entry = rel.get(key);
      return entry ? { ...entry.meta } : null;
    },
  };

  return storage;
}
```

## Template 3: SQLite Storage Adapter

For Node.js concepts using SQLite. Uses a JSON `fields` column for flexibility.

```typescript
// sqlite-storage.ts
import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
  ConceptManifest,
} from './types.js';

/**
 * SQLite-backed storage adapter.
 * Uses one table per relation with a JSON 'fields' column.
 */
export function createSQLiteStorage(
  dbPath: string,
  manifest?: ConceptManifest,
): ConceptStorage {
  // TODO: Initialize SQLite connection
  // const db = new Database(dbPath);

  const createdTables = new Set<string>();

  function ensureTable(relation: string): void {
    if (createdTables.has(relation)) return;
    // TODO:
    // db.exec(`
    //   CREATE TABLE IF NOT EXISTS "${relation}" (
    //     key TEXT PRIMARY KEY,
    //     fields TEXT NOT NULL,
    //     last_written_at TEXT NOT NULL
    //   )
    // `);
    createdTables.add(relation);
  }

  const storage: ConceptStorage = {
    async put(relation, key, value) {
      ensureTable(relation);
      const now = new Date().toISOString();

      // Check for existing record (for conflict detection)
      // TODO:
      // const row = db.prepare(
      //   `SELECT fields, last_written_at FROM "${relation}" WHERE key = ?`
      // ).get(key);

      const row = null; // TODO: replace with actual query
      if (row && storage.onConflict) {
        const info: ConflictInfo = {
          relation,
          key,
          existing: {
            fields: JSON.parse((row as any).fields),
            writtenAt: (row as any).last_written_at,
          },
          incoming: {
            fields: { ...value },
            writtenAt: now,
          },
        };

        const resolution = storage.onConflict(info);
        switch (resolution.action) {
          case 'keep-existing':
            return;
          case 'accept-incoming':
            break;
          case 'merge':
            // TODO:
            // db.prepare(
            //   `INSERT OR REPLACE INTO "${relation}" (key, fields, last_written_at) VALUES (?, ?, ?)`
            // ).run(key, JSON.stringify(resolution.merged), now);
            return;
          case 'escalate':
            break;
        }
      }

      // TODO:
      // db.prepare(
      //   `INSERT OR REPLACE INTO "${relation}" (key, fields, last_written_at) VALUES (?, ?, ?)`
      // ).run(key, JSON.stringify(value), now);
    },

    async get(relation, key) {
      ensureTable(relation);
      // TODO:
      // const row = db.prepare(
      //   `SELECT fields FROM "${relation}" WHERE key = ?`
      // ).get(key);
      // return row ? JSON.parse(row.fields) : null;
      return null;
    },

    async find(relation, criteria?) {
      ensureTable(relation);
      // TODO:
      // const rows = db.prepare(`SELECT fields FROM "${relation}"`).all();
      // const records = rows.map(r => JSON.parse(r.fields));
      //
      // if (!criteria || Object.keys(criteria).length === 0) return records;
      // return records.filter(entry =>
      //   Object.entries(criteria).every(([k, v]) => entry[k] === v)
      // );
      return [];
    },

    async del(relation, key) {
      ensureTable(relation);
      // TODO:
      // db.prepare(`DELETE FROM "${relation}" WHERE key = ?`).run(key);
    },

    async delMany(relation, criteria) {
      ensureTable(relation);
      // Scan all, filter in JS, delete by key batch
      // TODO:
      // const rows = db.prepare(`SELECT key, fields FROM "${relation}"`).all();
      // const toDelete = rows.filter(r => {
      //   const fields = JSON.parse(r.fields);
      //   return Object.entries(criteria).every(([k, v]) => fields[k] === v);
      // });
      // const del = db.prepare(`DELETE FROM "${relation}" WHERE key = ?`);
      // for (const row of toDelete) del.run(row.key);
      // return toDelete.length;
      return 0;
    },

    async getMeta(relation, key) {
      ensureTable(relation);
      // TODO:
      // const row = db.prepare(
      //   `SELECT last_written_at FROM "${relation}" WHERE key = ?`
      // ).get(key);
      // return row ? { lastWrittenAt: row.last_written_at } : null;
      return null;
    },
  };

  return storage;
}
```

## Template 4: PostgreSQL Storage Adapter

For server-side concepts using PostgreSQL with JSONB.

```typescript
// postgres-storage.ts
import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
  ConceptManifest,
} from './types.js';

/**
 * PostgreSQL-backed storage adapter.
 * Uses JSONB 'fields' column for flexible schema.
 * Supports efficient criteria matching via JSONB containment operator (@>).
 */
export function createPostgresStorage(
  connectionUrl: string,
  manifest?: ConceptManifest,
): ConceptStorage {
  // TODO: Initialize connection pool
  // const pool = new Pool({ connectionString: connectionUrl });

  const createdTables = new Set<string>();

  async function ensureTable(relation: string): Promise<void> {
    if (createdTables.has(relation)) return;
    // TODO:
    // await pool.query(`
    //   CREATE TABLE IF NOT EXISTS "${relation}" (
    //     key TEXT PRIMARY KEY,
    //     fields JSONB NOT NULL,
    //     last_written_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    //   )
    // `);
    createdTables.add(relation);
  }

  const storage: ConceptStorage = {
    async put(relation, key, value) {
      await ensureTable(relation);
      const now = new Date().toISOString();

      // Check for existing (conflict detection)
      // TODO:
      // const { rows } = await pool.query(
      //   `SELECT fields, last_written_at FROM "${relation}" WHERE key = $1`,
      //   [key]
      // );
      //
      // if (rows.length > 0 && storage.onConflict) {
      //   const info: ConflictInfo = { ... };
      //   const resolution = storage.onConflict(info);
      //   // Handle resolution...
      // }

      // UPSERT
      // TODO:
      // await pool.query(`
      //   INSERT INTO "${relation}" (key, fields, last_written_at)
      //   VALUES ($1, $2::jsonb, $3)
      //   ON CONFLICT (key) DO UPDATE
      //   SET fields = $2::jsonb, last_written_at = $3
      // `, [key, JSON.stringify(value), now]);
    },

    async get(relation, key) {
      await ensureTable(relation);
      // TODO:
      // const { rows } = await pool.query(
      //   `SELECT fields FROM "${relation}" WHERE key = $1`,
      //   [key]
      // );
      // return rows.length > 0 ? rows[0].fields : null;
      return null;
    },

    async find(relation, criteria?) {
      await ensureTable(relation);
      // TODO: Use JSONB containment for criteria
      // if (criteria && Object.keys(criteria).length > 0) {
      //   const { rows } = await pool.query(
      //     `SELECT fields FROM "${relation}" WHERE fields @> $1::jsonb`,
      //     [JSON.stringify(criteria)]
      //   );
      //   return rows.map(r => r.fields);
      // }
      // const { rows } = await pool.query(`SELECT fields FROM "${relation}"`);
      // return rows.map(r => r.fields);
      return [];
    },

    async del(relation, key) {
      await ensureTable(relation);
      // TODO:
      // await pool.query(`DELETE FROM "${relation}" WHERE key = $1`, [key]);
    },

    async delMany(relation, criteria) {
      await ensureTable(relation);
      // TODO: Use JSONB containment + RETURNING for count
      // const { rowCount } = await pool.query(
      //   `DELETE FROM "${relation}" WHERE fields @> $1::jsonb`,
      //   [JSON.stringify(criteria)]
      // );
      // return rowCount ?? 0;
      return 0;
    },

    async getMeta(relation, key) {
      await ensureTable(relation);
      // TODO:
      // const { rows } = await pool.query(
      //   `SELECT last_written_at FROM "${relation}" WHERE key = $1`,
      //   [key]
      // );
      // return rows.length > 0
      //   ? { lastWrittenAt: rows[0].last_written_at.toISOString() }
      //   : null;
      return null;
    },
  };

  return storage;
}
```

## Template 5: localStorage Storage Adapter

For browser-based concepts. Namespace-based isolation.

```typescript
// localstorage-storage.ts
import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
} from './types.js';

interface StoredEntry {
  fields: Record<string, unknown>;
  meta: EntryMeta;
}

/**
 * Browser localStorage-backed storage adapter.
 * Each relation stored as a JSON string under `${namespace}:${relation}`.
 */
export function createLocalStorage(
  namespace: string = 'copf',
): ConceptStorage {

  function storageKey(relation: string): string {
    return `${namespace}:${relation}`;
  }

  function loadRelation(relation: string): Record<string, StoredEntry> {
    const raw = localStorage.getItem(storageKey(relation));
    return raw ? JSON.parse(raw) : {};
  }

  function saveRelation(relation: string, data: Record<string, StoredEntry>): void {
    localStorage.setItem(storageKey(relation), JSON.stringify(data));
  }

  const storage: ConceptStorage = {
    async put(relation, key, value) {
      const now = new Date().toISOString();
      const data = loadRelation(relation);
      const existing = data[key];

      if (existing && storage.onConflict) {
        const info: ConflictInfo = {
          relation,
          key,
          existing: {
            fields: { ...existing.fields },
            writtenAt: existing.meta.lastWrittenAt,
          },
          incoming: {
            fields: { ...value },
            writtenAt: now,
          },
        };

        const resolution = storage.onConflict(info);
        switch (resolution.action) {
          case 'keep-existing':
            return;
          case 'accept-incoming':
            break;
          case 'merge':
            data[key] = {
              fields: { ...resolution.merged },
              meta: { lastWrittenAt: now },
            };
            saveRelation(relation, data);
            return;
          case 'escalate':
            break;
        }
      }

      data[key] = {
        fields: { ...value },
        meta: { lastWrittenAt: now },
      };
      saveRelation(relation, data);
    },

    async get(relation, key) {
      const data = loadRelation(relation);
      const entry = data[key];
      return entry ? { ...entry.fields } : null;
    },

    async find(relation, criteria?) {
      const data = loadRelation(relation);
      const entries = Object.values(data).map(e => e.fields);

      if (!criteria || Object.keys(criteria).length === 0) {
        return entries.map(e => ({ ...e }));
      }

      return entries
        .filter(entry =>
          Object.entries(criteria!).every(([k, v]) => entry[k] === v),
        )
        .map(e => ({ ...e }));
    },

    async del(relation, key) {
      const data = loadRelation(relation);
      delete data[key];
      saveRelation(relation, data);
    },

    async delMany(relation, criteria) {
      const data = loadRelation(relation);
      let count = 0;
      for (const [key, entry] of Object.entries(data)) {
        if (Object.entries(criteria).every(([k, v]) => entry.fields[k] === v)) {
          delete data[key];
          count++;
        }
      }
      saveRelation(relation, data);
      return count;
    },

    async getMeta(relation, key) {
      const data = loadRelation(relation);
      const entry = data[key];
      return entry ? { ...entry.meta } : null;
    },
  };

  return storage;
}
```

## Template 6: Comprehensive Storage Test Suite

Run this against any adapter to verify the `ConceptStorage` contract.

```typescript
// my-storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createMyStorage } from './my-storage.js';
import type { ConceptStorage, ConflictInfo } from './types.js';

describe('MyStorage', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createMyStorage(/* test config */);
  });

  // ---- Core CRUD ----

  describe('put and get', () => {
    it('stores and retrieves a record', async () => {
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

    it('returns a copy, not a reference', async () => {
      await storage.put('users', 'u1', { name: 'Alice' });
      const a = await storage.get('users', 'u1');
      const b = await storage.get('users', 'u1');
      expect(a).not.toBe(b);
    });

    it('handles array-valued fields', async () => {
      await storage.put('follow', 'u1', { user: 'u1', following: ['u2', 'u3'] });
      const record = await storage.get('follow', 'u1');
      expect(record!.following).toEqual(['u2', 'u3']);
    });
  });

  // ---- find ----

  describe('find', () => {
    beforeEach(async () => {
      await storage.put('users', 'u1', { name: 'Alice', role: 'admin' });
      await storage.put('users', 'u2', { name: 'Bob', role: 'user' });
      await storage.put('users', 'u3', { name: 'Charlie', role: 'user' });
    });

    it('finds all records', async () => {
      expect(await storage.find('users')).toHaveLength(3);
    });

    it('finds by criteria (AND semantics)', async () => {
      const users = await storage.find('users', { role: 'user' });
      expect(users).toHaveLength(2);
      expect(users.map(u => u.name).sort()).toEqual(['Bob', 'Charlie']);
    });

    it('returns empty for empty relation', async () => {
      expect(await storage.find('empty')).toEqual([]);
    });

    it('does not leak metadata', async () => {
      const all = await storage.find('users');
      for (const entry of all) {
        expect(entry).not.toHaveProperty('lastWrittenAt');
        expect(entry).not.toHaveProperty('_meta');
      }
    });
  });

  // ---- del ----

  describe('del', () => {
    it('deletes a record', async () => {
      await storage.put('users', 'u1', { name: 'Alice' });
      await storage.del('users', 'u1');
      expect(await storage.get('users', 'u1')).toBeNull();
    });

    it('is a silent no-op for missing key', async () => {
      await storage.del('users', 'nonexistent'); // should not throw
    });
  });

  // ---- delMany ----

  describe('delMany', () => {
    it('deletes matching records and returns count', async () => {
      await storage.put('users', 'u1', { name: 'Alice', role: 'admin' });
      await storage.put('users', 'u2', { name: 'Bob', role: 'user' });
      await storage.put('users', 'u3', { name: 'Charlie', role: 'user' });

      expect(await storage.delMany('users', { role: 'user' })).toBe(2);
      expect(await storage.find('users')).toHaveLength(1);
    });

    it('returns 0 when nothing matches', async () => {
      await storage.put('users', 'u1', { role: 'admin' });
      expect(await storage.delMany('users', { role: 'superadmin' })).toBe(0);
    });
  });

  // ---- Isolation ----

  describe('isolation', () => {
    it('isolates relations', async () => {
      await storage.put('users', 'u1', { name: 'Alice' });
      await storage.put('posts', 'p1', { title: 'Hello' });
      expect(await storage.find('users')).toHaveLength(1);
      expect(await storage.find('posts')).toHaveLength(1);
    });
  });

  // ---- getMeta ----

  describe('getMeta', () => {
    it('returns lastWrittenAt after put', async () => {
      await storage.put('users', 'u1', { name: 'Alice' });
      const meta = await storage.getMeta!('users', 'u1');
      expect(meta).not.toBeNull();
      expect(meta!.lastWrittenAt).toBeDefined();
      expect(new Date(meta!.lastWrittenAt).toISOString()).toBe(meta!.lastWrittenAt);
    });

    it('returns null for missing key', async () => {
      expect(await storage.getMeta!('users', 'missing')).toBeNull();
    });

    it('returns null after deletion', async () => {
      await storage.put('users', 'u1', { name: 'Alice' });
      await storage.del('users', 'u1');
      expect(await storage.getMeta!('users', 'u1')).toBeNull();
    });
  });

  // ---- Conflict Detection ----

  describe('onConflict', () => {
    it('calls onConflict on overwrite', async () => {
      await storage.put('users', 'u1', { name: 'Alice' });
      const conflicts: ConflictInfo[] = [];
      storage.onConflict = (info) => {
        conflicts.push(info);
        return { action: 'accept-incoming' };
      };
      await storage.put('users', 'u1', { name: 'Bob' });
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].existing.fields.name).toBe('Alice');
      expect(conflicts[0].incoming.fields.name).toBe('Bob');
    });

    it('does not call onConflict for new entries', async () => {
      const conflicts: ConflictInfo[] = [];
      storage.onConflict = (info) => {
        conflicts.push(info);
        return { action: 'accept-incoming' };
      };
      await storage.put('users', 'u1', { name: 'Alice' });
      expect(conflicts).toHaveLength(0);
    });

    it('keep-existing prevents write', async () => {
      await storage.put('users', 'u1', { name: 'Alice' });
      storage.onConflict = () => ({ action: 'keep-existing' });
      await storage.put('users', 'u1', { name: 'Bob' });
      expect((await storage.get('users', 'u1'))!.name).toBe('Alice');
    });

    it('accept-incoming writes new value', async () => {
      await storage.put('users', 'u1', { name: 'Alice' });
      storage.onConflict = () => ({ action: 'accept-incoming' });
      await storage.put('users', 'u1', { name: 'Bob' });
      expect((await storage.get('users', 'u1'))!.name).toBe('Bob');
    });

    it('merge writes merged fields', async () => {
      await storage.put('users', 'u1', { name: 'Alice', score: 10 });
      storage.onConflict = (info) => ({
        action: 'merge',
        merged: {
          name: info.incoming.fields.name,
          score: (info.existing.fields.score as number) + (info.incoming.fields.score as number),
        },
      });
      await storage.put('users', 'u1', { name: 'Alice', score: 5 });
      expect((await storage.get('users', 'u1'))!.score).toBe(15);
    });

    it('escalate writes incoming value', async () => {
      await storage.put('users', 'u1', { name: 'Alice' });
      let escalated = false;
      storage.onConflict = () => { escalated = true; return { action: 'escalate' }; };
      await storage.put('users', 'u1', { name: 'Bob' });
      expect(escalated).toBe(true);
      expect((await storage.get('users', 'u1'))!.name).toBe('Bob');
    });
  });
});
```

## Template 7: Wiring a Storage Adapter into the System

```typescript
// bootstrap.ts — How to wire your storage adapter into COPF
import { createInProcessAdapter, createConceptRegistry } from '@copf/kernel';
import { createMyStorage } from './my-storage.js';
import { articleHandler } from './app/article.handler.js';
import { userHandler } from './app/user.handler.js';

// Create registry
const registry = createConceptRegistry();

// Each concept gets its own isolated storage instance
const articleStorage = createMyStorage({ /* backend config */ });
const userStorage = createMyStorage({ /* backend config */ });

// Pair handler + storage via transport adapter
const articleTransport = createInProcessAdapter(articleHandler, articleStorage);
const userTransport = createInProcessAdapter(userHandler, userStorage);

// Register concepts by URI
registry.register('urn:app:Article', articleTransport);
registry.register('urn:app:User', userTransport);

// Optionally: set up conflict detection
articleStorage.onConflict = (info) => {
  // Custom merge logic for articles
  return { action: 'accept-incoming' };
};
```
