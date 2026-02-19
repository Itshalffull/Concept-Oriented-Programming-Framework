// ============================================================
// Distributed Firing Guard — Extended Tests
//
// Tests for:
//   - Multi-completion ID guard keys
//   - Completion ID ordering invariance
//   - Different completion sets for same sync name
//   - Firestore guard edge cases
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createDynamoDBFiringGuard,
  createFirestoreFiringGuard,
} from '../infrastructure/serverless/distributed-lock.js';
import type { DynamoDBDocumentClient } from '../infrastructure/storage/dynamodb-storage.js';
import type { FirestoreClient, FirestoreDocument, FirestoreQuerySnapshot } from '../infrastructure/storage/firestore-storage.js';

// ============================================================
// Mock DynamoDB Client
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
      if (params.ConditionExpression === 'attribute_not_exists(pk)') {
        const table = getTable(params.TableName);
        const key = itemKey(params.Item as Record<string, unknown>);
        if (table.has(key)) {
          const err = new Error('ConditionalCheckFailed');
          err.name = 'ConditionalCheckFailedException';
          throw err;
        }
      }
      const table = getTable(params.TableName);
      const key = itemKey(params.Item as Record<string, unknown>);
      table.set(key, { ...params.Item });
    },

    async get(params) {
      const table = getTable(params.TableName);
      const key = itemKey(params.Key);
      const item = table.get(key);
      if (!item) return {};
      return { Item: { ...item } };
    },

    async query(params) {
      const table = getTable(params.TableName);
      const items: Record<string, unknown>[] = [];
      for (const [_key, item] of table.entries()) items.push({ ...item });
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
          const fullPath = `${path}/${id}`;
          return {
            async set(data: Record<string, unknown>) { store.set(fullPath, { ...data }); },
            async get(): Promise<FirestoreDocument> { return makeDoc(store.get(fullPath)); },
            async delete() { store.delete(fullPath); },
            async update(data: Record<string, unknown>) {
              const existing = store.get(fullPath);
              if (existing) store.set(fullPath, { ...existing, ...data });
            },
          };
        },
        where() { return this as any; },
        async get(): Promise<FirestoreQuerySnapshot> {
          return { docs: [], empty: true, size: 0 };
        },
      };
    },

    async runTransaction<T>(fn: (txn: any) => Promise<T>): Promise<T> {
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
// DynamoDB Guard — Extended Tests
// ============================================================

describe('DynamoDB Firing Guard — Multi-Completion', () => {
  it('acquires guard with multiple completion IDs', async () => {
    const client = createMockDynamoDBClient();
    const guard = createDynamoDBFiringGuard(client, { tableName: 'guards' });

    const acquired = await guard.tryAcquire(['comp-1', 'comp-2'], 'JoinSync');
    expect(acquired).toBe(true);
  });

  it('rejects second acquisition with same multi-completion set', async () => {
    const client = createMockDynamoDBClient();
    const guard = createDynamoDBFiringGuard(client, { tableName: 'guards' });

    const first = await guard.tryAcquire(['comp-1', 'comp-2'], 'JoinSync');
    const second = await guard.tryAcquire(['comp-1', 'comp-2'], 'JoinSync');

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('completion ID ordering does not matter (sorted internally)', async () => {
    const client = createMockDynamoDBClient();
    const guard = createDynamoDBFiringGuard(client, { tableName: 'guards' });

    const first = await guard.tryAcquire(['comp-b', 'comp-a'], 'JoinSync');
    // Same IDs in different order should hit the same guard
    const second = await guard.tryAcquire(['comp-a', 'comp-b'], 'JoinSync');

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('different completion sets can acquire same sync', async () => {
    const client = createMockDynamoDBClient();
    const guard = createDynamoDBFiringGuard(client, { tableName: 'guards' });

    const a = await guard.tryAcquire(['comp-1', 'comp-2'], 'SyncX');
    const b = await guard.tryAcquire(['comp-3', 'comp-4'], 'SyncX');

    expect(a).toBe(true);
    expect(b).toBe(true);
  });

  it('same completions, different syncs can both acquire', async () => {
    const client = createMockDynamoDBClient();
    const guard = createDynamoDBFiringGuard(client, { tableName: 'guards' });

    const a = await guard.tryAcquire(['comp-1'], 'SyncA');
    const b = await guard.tryAcquire(['comp-1'], 'SyncB');

    expect(a).toBe(true);
    expect(b).toBe(true);
  });

  it('stores TTL in guard entry', async () => {
    const client = createMockDynamoDBClient();
    const guard = createDynamoDBFiringGuard(client, {
      tableName: 'guards',
      ttlSeconds: 600,
    });

    await guard.tryAcquire(['comp-ttl'], 'TTLSync');

    // Verify TTL was set by checking the stored item
    const result = await client.get({
      TableName: 'guards',
      Key: { pk: 'guard#comp-ttl#TTLSync', sk: 'guard' },
    });

    expect(result.Item).toBeDefined();
    expect(result.Item!._ttl).toBeDefined();
    expect(typeof result.Item!._ttl).toBe('number');
  });
});

// ============================================================
// Firestore Guard — Extended Tests
// ============================================================

describe('Firestore Firing Guard — Multi-Completion', () => {
  it('acquires guard with multiple completion IDs', async () => {
    const client = createMockFirestoreClient();
    const guard = createFirestoreFiringGuard(client, { collectionPath: 'guards' });

    const acquired = await guard.tryAcquire(['comp-1', 'comp-2'], 'JoinSync');
    expect(acquired).toBe(true);
  });

  it('rejects second acquisition with same multi-completion set', async () => {
    const client = createMockFirestoreClient();
    const guard = createFirestoreFiringGuard(client, { collectionPath: 'guards' });

    const first = await guard.tryAcquire(['comp-1', 'comp-2'], 'JoinSync');
    const second = await guard.tryAcquire(['comp-1', 'comp-2'], 'JoinSync');

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('completion ID ordering does not matter (sorted internally)', async () => {
    const client = createMockFirestoreClient();
    const guard = createFirestoreFiringGuard(client, { collectionPath: 'guards' });

    const first = await guard.tryAcquire(['comp-b', 'comp-a'], 'JoinSync');
    const second = await guard.tryAcquire(['comp-a', 'comp-b'], 'JoinSync');

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('different completion sets can acquire same sync', async () => {
    const client = createMockFirestoreClient();
    const guard = createFirestoreFiringGuard(client, { collectionPath: 'guards' });

    const a = await guard.tryAcquire(['comp-1'], 'SyncX');
    const b = await guard.tryAcquire(['comp-2'], 'SyncX');

    expect(a).toBe(true);
    expect(b).toBe(true);
  });

  it('stores guard metadata in document', async () => {
    const client = createMockFirestoreClient();
    const guard = createFirestoreFiringGuard(client, { collectionPath: 'guards' });

    await guard.tryAcquire(['comp-meta'], 'MetaSync');

    // Verify the guard doc was stored
    const doc = await client.collection('guards').doc('guard#comp-meta#MetaSync').get();
    expect(doc.exists).toBe(true);
    const data = doc.data()!;
    expect(data.syncName).toBe('MetaSync');
    expect(data.acquiredAt).toBeDefined();
  });
});
