// ============================================================
// Serverless Storage Adapter Tests
//
// Tests for DynamoDB, Firestore, and Redis storage adapters
// using mock backends. Each adapter is tested against the
// full ConceptStorage contract, following the same pattern
// as edge-storage.test.ts.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createDynamoDBStorage } from '../runtime/adapters/dynamodb-storage.js';
import { createFirestoreStorage } from '../runtime/adapters/firestore-storage.js';
import { createRedisStorage } from '../runtime/adapters/redis-storage.js';
import {
  getDynamoDBStorage,
  getFirestoreStorage,
  getRedisStorage,
  clearStorageCache,
} from '../runtime/adapters/serverless/connection-pool.js';
import type { DynamoDBDocumentClient } from '../runtime/adapters/dynamodb-storage.js';
import type { FirestoreClient, FirestoreDocument, FirestoreQuerySnapshot } from '../runtime/adapters/firestore-storage.js';
import type { RedisClient } from '../runtime/adapters/redis-storage.js';
import type { ConceptStorage } from '../runtime/types.js';

// ============================================================
// Mock DynamoDB Document Client
// ============================================================

function createMockDynamoDBClient(): DynamoDBDocumentClient {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();

  function getTable(name: string): Map<string, Record<string, unknown>> {
    let table = tables.get(name);
    if (!table) {
      table = new Map();
      tables.set(name, table);
    }
    return table;
  }

  function itemKey(key: Record<string, unknown>): string {
    return `${key.pk}|${key.sk ?? ''}`;
  }

  return {
    async put(params) {
      const table = getTable(params.TableName);
      const key = itemKey(params.Item as Record<string, unknown>);
      table.set(key, { ...params.Item });
    },

    async get(params) {
      const table = getTable(params.TableName);
      const key = itemKey(params.Key);
      const item = table.get(key);
      if (!item) return {};

      // Handle ProjectionExpression
      if (params.ProjectionExpression && params.ExpressionAttributeNames) {
        const projected: Record<string, unknown> = {};
        for (const [alias, realName] of Object.entries(params.ExpressionAttributeNames)) {
          if (item[realName] !== undefined) {
            projected[realName] = item[realName];
          }
        }
        return { Item: projected };
      }

      return { Item: { ...item } };
    },

    async query(params) {
      const table = getTable(params.TableName);
      const items: Record<string, unknown>[] = [];

      // Extract pk value from expression
      const pkValue = params.ExpressionAttributeValues?.[':pk'];

      for (const [key, item] of table.entries()) {
        if (pkValue !== undefined && item.pk !== pkValue) continue;

        // Apply FilterExpression (simplified: only supports field = value)
        if (params.FilterExpression && params.ExpressionAttributeNames && params.ExpressionAttributeValues) {
          let passes = true;
          const filterParts = params.FilterExpression.split(' AND ');
          for (const part of filterParts) {
            const match = part.trim().match(/^(#\w+)\s*=\s*(:[\w]+)$/);
            if (match) {
              const fieldName = params.ExpressionAttributeNames[match[1]];
              const expectedValue = params.ExpressionAttributeValues[match[2]];
              if (fieldName && item[fieldName] !== expectedValue) {
                passes = false;
                break;
              }
            }
          }
          if (!passes) continue;
        }

        items.push({ ...item });
      }

      return { Items: items };
    },

    async delete(params) {
      const table = getTable(params.TableName);
      const key = itemKey(params.Key);
      table.delete(key);
    },

    async batchWrite(params) {
      for (const [tableName, requests] of Object.entries(params.RequestItems)) {
        const table = getTable(tableName);
        for (const req of requests) {
          const key = itemKey(req.DeleteRequest.Key);
          table.delete(key);
        }
      }
    },
  };
}

// ============================================================
// Mock Firestore Client
// ============================================================

function createMockFirestoreClient(): FirestoreClient {
  const store = new Map<string, Record<string, unknown>>();

  function docPath(collectionPath: string, docId: string): string {
    return `${collectionPath}/${docId}`;
  }

  function makeDoc(data: Record<string, unknown> | undefined): FirestoreDocument {
    return {
      exists: data !== undefined,
      data() { return data ? { ...data } : undefined; },
    };
  }

  const client: FirestoreClient = {
    collection(path: string) {
      return {
        doc(id: string) {
          const fullPath = docPath(path, id);
          return {
            async set(data: Record<string, unknown>) {
              store.set(fullPath, { ...data });
            },
            async get(): Promise<FirestoreDocument> {
              const data = store.get(fullPath);
              return makeDoc(data);
            },
            async delete() {
              store.delete(fullPath);
            },
            async update(data: Record<string, unknown>) {
              const existing = store.get(fullPath);
              if (existing) {
                store.set(fullPath, { ...existing, ...data });
              }
            },
          };
        },
        where(field: string, op: string, value: unknown) {
          return createFilteredQuery(path, [{ field, op, value }]);
        },
        async get(): Promise<FirestoreQuerySnapshot> {
          const docs: FirestoreDocument[] = [];
          const prefix = path + '/';
          for (const [key, data] of store.entries()) {
            if (key.startsWith(prefix)) {
              docs.push(makeDoc(data));
            }
          }
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      };

      function createFilteredQuery(
        collPath: string,
        filters: { field: string; op: string; value: unknown }[],
      ) {
        return {
          where(field: string, op: string, value: unknown) {
            return createFilteredQuery(collPath, [...filters, { field, op, value }]);
          },
          async get(): Promise<FirestoreQuerySnapshot> {
            const docs: FirestoreDocument[] = [];
            const prefix = collPath + '/';
            for (const [key, data] of store.entries()) {
              if (!key.startsWith(prefix)) continue;
              let matches = true;
              for (const filter of filters) {
                if (filter.op === '==' && data[filter.field] !== filter.value) {
                  matches = false;
                  break;
                }
              }
              if (matches) {
                docs.push(makeDoc(data));
              }
            }
            return { docs, empty: docs.length === 0, size: docs.length };
          },
        };
      }
    },

    async runTransaction<T>(fn: (txn: any) => Promise<T>): Promise<T> {
      // Simplified: no real transaction isolation
      return fn({
        async get(ref: any) { return ref.get(); },
        set(ref: any, data: any) { ref.set(data); },
        delete(ref: any) { ref.delete(); },
      });
    },
  };

  return client;
}

// ============================================================
// Mock Redis Client
// ============================================================

function createMockRedisClient(): RedisClient {
  const hashes = new Map<string, Record<string, string>>();
  const strings = new Map<string, string>();
  const sets = new Map<string, Set<string>>();

  return {
    async hset(key: string, fields: Record<string, string>) {
      const existing = hashes.get(key) || {};
      hashes.set(key, { ...existing, ...fields });
      return Object.keys(fields).length;
    },

    async hgetall(key: string) {
      return hashes.get(key) || null;
    },

    async del(key: string) {
      const existed = hashes.has(key) || strings.has(key) || sets.has(key);
      hashes.delete(key);
      strings.delete(key);
      sets.delete(key);
      return existed ? 1 : 0;
    },

    async sadd(key: string, ...members: string[]) {
      let set = sets.get(key);
      if (!set) {
        set = new Set();
        sets.set(key, set);
      }
      let added = 0;
      for (const m of members) {
        if (!set.has(m)) {
          set.add(m);
          added++;
        }
      }
      return added;
    },

    async srem(key: string, ...members: string[]) {
      const set = sets.get(key);
      if (!set) return 0;
      let removed = 0;
      for (const m of members) {
        if (set.delete(m)) removed++;
      }
      return removed;
    },

    async smembers(key: string) {
      const set = sets.get(key);
      return set ? [...set] : [];
    },

    async set(key: string, value: string) {
      strings.set(key, value);
      return 'OK';
    },

    async get(key: string) {
      return strings.get(key) ?? null;
    },
  };
}

// ============================================================
// Shared ConceptStorage Contract Tests
// ============================================================

function runStorageContractTests(name: string, createStorage: () => ConceptStorage) {
  describe(`${name} — ConceptStorage Contract`, () => {
    let storage: ConceptStorage;

    beforeEach(() => {
      storage = createStorage();
    });

    it('put and get a value', async () => {
      await storage.put('users', 'alice', { name: 'Alice', age: 30 });
      const result = await storage.get('users', 'alice');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Alice');
      expect(result!.age).toBe(30);
    });

    it('get returns null for missing key', async () => {
      const result = await storage.get('users', 'nonexistent');
      expect(result).toBeNull();
    });

    it('put overwrites existing value', async () => {
      await storage.put('users', 'alice', { name: 'Alice', age: 30 });
      await storage.put('users', 'alice', { name: 'Alice', age: 31 });
      const result = await storage.get('users', 'alice');
      expect(result!.age).toBe(31);
    });

    it('del removes a value', async () => {
      await storage.put('users', 'alice', { name: 'Alice' });
      await storage.del('users', 'alice');
      const result = await storage.get('users', 'alice');
      expect(result).toBeNull();
    });

    it('find returns all entries in a relation', async () => {
      await storage.put('users', 'alice', { name: 'Alice', role: 'admin' });
      await storage.put('users', 'bob', { name: 'Bob', role: 'user' });
      const results = await storage.find('users');
      expect(results).toHaveLength(2);
    });

    it('find with criteria filters results', async () => {
      await storage.put('users', 'alice', { name: 'Alice', role: 'admin' });
      await storage.put('users', 'bob', { name: 'Bob', role: 'user' });
      const admins = await storage.find('users', { role: 'admin' });
      expect(admins).toHaveLength(1);
      expect(admins[0].name).toBe('Alice');
    });

    it('find returns empty array for empty relation', async () => {
      const results = await storage.find('empty');
      expect(results).toEqual([]);
    });

    it('getMeta returns metadata with lastWrittenAt', async () => {
      await storage.put('users', 'alice', { name: 'Alice' });
      if (storage.getMeta) {
        const meta = await storage.getMeta('users', 'alice');
        expect(meta).not.toBeNull();
        expect(meta!.lastWrittenAt).toBeDefined();
        expect(typeof meta!.lastWrittenAt).toBe('string');
      }
    });

    it('getMeta returns null for missing key', async () => {
      if (storage.getMeta) {
        const meta = await storage.getMeta('users', 'nonexistent');
        expect(meta).toBeNull();
      }
    });

    it('isolates data across relations', async () => {
      await storage.put('users', 'key1', { type: 'user' });
      await storage.put('posts', 'key1', { type: 'post' });
      const users = await storage.find('users');
      const posts = await storage.find('posts');
      expect(users).toHaveLength(1);
      expect(users[0].type).toBe('user');
      expect(posts).toHaveLength(1);
      expect(posts[0].type).toBe('post');
    });

    it('delMany removes matching entries and returns count', async () => {
      await storage.put('items', 'a', { id: 'a', category: 'x', label: 'one' });
      await storage.put('items', 'b', { id: 'b', category: 'y', label: 'two' });
      await storage.put('items', 'c', { id: 'c', category: 'x', label: 'three' });

      if (storage.delMany) {
        const deleted = await storage.delMany('items', { category: 'x' });
        expect(deleted).toBe(2);

        const remaining = await storage.find('items');
        expect(remaining).toHaveLength(1);
        expect(remaining[0].label).toBe('two');
      }
    });

    it('delMany returns 0 when no entries match', async () => {
      await storage.put('items', 'a', { id: 'a', category: 'x' });

      if (storage.delMany) {
        const deleted = await storage.delMany('items', { category: 'nonexistent' });
        expect(deleted).toBe(0);

        const remaining = await storage.find('items');
        expect(remaining).toHaveLength(1);
      }
    });
  });
}

// ============================================================
// Conflict Detection Tests
// ============================================================

function runConflictTests(name: string, createStorage: () => ConceptStorage) {
  describe(`${name} — Conflict Detection`, () => {
    it('onConflict keep-existing prevents overwrite', async () => {
      const storage = createStorage();
      storage.onConflict = () => ({ action: 'keep-existing' });

      await storage.put('data', 'key1', { value: 'original' });
      await storage.put('data', 'key1', { value: 'overwrite' });

      const result = await storage.get('data', 'key1');
      expect(result!.value).toBe('original');
    });

    it('onConflict accept-incoming allows overwrite', async () => {
      const storage = createStorage();
      storage.onConflict = () => ({ action: 'accept-incoming' });

      await storage.put('data', 'key1', { value: 'original' });
      await storage.put('data', 'key1', { value: 'overwrite' });

      const result = await storage.get('data', 'key1');
      expect(result!.value).toBe('overwrite');
    });

    it('onConflict merge stores merged value', async () => {
      const storage = createStorage();
      storage.onConflict = (info) => ({
        action: 'merge',
        merged: { ...info.existing.fields, ...info.incoming.fields, merged: true },
      });

      await storage.put('data', 'key1', { a: 1 });
      await storage.put('data', 'key1', { b: 2 });

      const result = await storage.get('data', 'key1');
      expect(result!.a).toBe(1);
      expect(result!.b).toBe(2);
      expect(result!.merged).toBe(true);
    });

    it('onConflict receives correct conflict info', async () => {
      const storage = createStorage();
      let capturedInfo: any = null;
      storage.onConflict = (info) => {
        capturedInfo = info;
        return { action: 'accept-incoming' };
      };

      await storage.put('rel', 'k', { v: 'first' });
      await storage.put('rel', 'k', { v: 'second' });

      expect(capturedInfo).not.toBeNull();
      expect(capturedInfo.relation).toBe('rel');
      expect(capturedInfo.key).toBe('k');
      expect(capturedInfo.existing.fields.v).toBe('first');
      expect(capturedInfo.incoming.fields.v).toBe('second');
    });
  });
}

// ============================================================
// Connection Pool Tests
// ============================================================

describe('Connection Pool — Lazy Singleton Cache', () => {
  beforeEach(() => {
    clearStorageCache();
  });

  it('getDynamoDBStorage returns same instance for same config', () => {
    const client = createMockDynamoDBClient();
    const config = { region: 'us-east-1', tablePrefix: 'test-' };

    const s1 = getDynamoDBStorage(client, config);
    const s2 = getDynamoDBStorage(client, config);

    expect(s1).toBe(s2);
  });

  it('getDynamoDBStorage returns different instance for different config', () => {
    const client = createMockDynamoDBClient();
    const config1 = { region: 'us-east-1', tablePrefix: 'test-' };
    const config2 = { region: 'eu-west-1', tablePrefix: 'test-' };

    const s1 = getDynamoDBStorage(client, config1);
    const s2 = getDynamoDBStorage(client, config2);

    expect(s1).not.toBe(s2);
  });

  it('getFirestoreStorage returns same instance for same config', () => {
    const client = createMockFirestoreClient();
    const config = { projectId: 'test-project', collectionPrefix: 'test' };

    const s1 = getFirestoreStorage(client, config);
    const s2 = getFirestoreStorage(client, config);

    expect(s1).toBe(s2);
  });

  it('getRedisStorage returns same instance for same config', () => {
    const client = createMockRedisClient();
    const config = { url: 'redis://localhost:6379', keyPrefix: 'test' };

    const s1 = getRedisStorage(client, config);
    const s2 = getRedisStorage(client, config);

    expect(s1).toBe(s2);
  });

  it('clearStorageCache clears all cached instances', () => {
    const dynamoClient = createMockDynamoDBClient();
    const dynamoConfig = { region: 'us-east-1', tablePrefix: 'test-' };
    const s1 = getDynamoDBStorage(dynamoClient, dynamoConfig);

    clearStorageCache();

    const s2 = getDynamoDBStorage(dynamoClient, dynamoConfig);
    expect(s1).not.toBe(s2);
  });
});

// ============================================================
// Run all adapter test suites
// ============================================================

runStorageContractTests('DynamoDB', () =>
  createDynamoDBStorage(createMockDynamoDBClient(), {
    region: 'us-east-1',
    tablePrefix: 'test-',
    singleTable: true,
  }),
);
runConflictTests('DynamoDB', () =>
  createDynamoDBStorage(createMockDynamoDBClient(), {
    region: 'us-east-1',
    tablePrefix: 'test-',
    singleTable: true,
  }),
);

runStorageContractTests('Firestore', () =>
  createFirestoreStorage(createMockFirestoreClient(), {
    projectId: 'test-project',
    collectionPrefix: 'test',
  }),
);
runConflictTests('Firestore', () =>
  createFirestoreStorage(createMockFirestoreClient(), {
    projectId: 'test-project',
    collectionPrefix: 'test',
  }),
);

runStorageContractTests('Redis', () =>
  createRedisStorage(createMockRedisClient(), {
    url: 'redis://localhost:6379',
    keyPrefix: 'test',
  }),
);
runConflictTests('Redis', () =>
  createRedisStorage(createMockRedisClient(), {
    url: 'redis://localhost:6379',
    keyPrefix: 'test',
  }),
);
