// ============================================================
// Durable Action Log Tests
//
// Tests for:
//   - Helper functions (toPersistenceKey, syncEdgeKey)
//   - DynamoDB/Firestore: multi-record flow loading
//   - DynamoDB/Firestore: addSyncEdge → hasSyncEdge roundtrip
//   - DynamoDB/Firestore: gc() garbage collection
// ============================================================

import { describe, it, expect } from 'vitest';
import { generateId, timestamp } from '../kernel/src/types.js';
import type { ActionRecord } from '../kernel/src/types.js';
import { toPersistenceKey, syncEdgeKey } from '../engine/durable-action-log.js';
import { createDynamoDBActionLog } from '../engine/durable-action-log-dynamodb.js';
import { createFirestoreActionLog } from '../engine/durable-action-log-firestore.js';
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
      if (params.ProjectionExpression && params.ExpressionAttributeNames) {
        const projected: Record<string, unknown> = {};
        for (const [_alias, realName] of Object.entries(params.ExpressionAttributeNames)) {
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
      const pkValue = params.ExpressionAttributeValues?.[':pk'];

      for (const [_key, item] of table.entries()) {
        if (pkValue !== undefined && item.pk !== pkValue) continue;

        if (params.FilterExpression && params.ExpressionAttributeNames && params.ExpressionAttributeValues) {
          let passes = true;
          const filterParts = params.FilterExpression.split(' AND ');
          for (const part of filterParts) {
            const match = part.trim().match(/^(#\w+)\s*<\s*(:[\w]+)$/);
            if (match) {
              const fieldName = params.ExpressionAttributeNames[match[1]];
              const compareValue = params.ExpressionAttributeValues[match[2]];
              if (fieldName && typeof item[fieldName] === 'string' && typeof compareValue === 'string') {
                if (item[fieldName] as string >= compareValue) {
                  passes = false;
                }
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
        where(field: string, op: string, value: unknown) {
          return createFilteredQuery(path, [{ field, op, value }]);
        },
        async get(): Promise<FirestoreQuerySnapshot> {
          const docs: FirestoreDocument[] = [];
          const prefix = path + '/';
          for (const [key, data] of store.entries()) {
            if (key.startsWith(prefix) && !key.slice(prefix.length).includes('/')) {
              docs.push(makeDoc(data));
            }
          }
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      };

      function createFilteredQuery(
        collPath: string,
        filters: { field: string; op: string; value: unknown }[],
      ): any {
        return {
          where(field: string, op: string, value: unknown) {
            return createFilteredQuery(collPath, [...filters, { field, op, value }]);
          },
          async get(): Promise<FirestoreQuerySnapshot> {
            const docs: FirestoreDocument[] = [];
            const prefix = collPath + '/';
            for (const [key, data] of store.entries()) {
              if (!key.startsWith(prefix)) continue;
              if (key.slice(prefix.length).includes('/')) continue;
              let matches = true;
              for (const filter of filters) {
                if (filter.op === '==' && data[filter.field] !== filter.value) {
                  matches = false;
                  break;
                }
                if (filter.op === '<' && typeof data[filter.field] === 'string') {
                  if (data[filter.field] as string >= (filter.value as string)) {
                    matches = false;
                    break;
                  }
                }
              }
              if (matches) docs.push(makeDoc(data));
            }
            return { docs, empty: docs.length === 0, size: docs.length };
          },
        };
      }
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
// Helper Tests
// ============================================================

describe('Durable Action Log Helpers', () => {
  it('toPersistenceKey creates correct pk and sk', () => {
    const record: ActionRecord = {
      id: 'rec-123',
      type: 'completion',
      concept: 'UserConcept',
      action: 'register',
      input: { name: 'Alice' },
      variant: 'ok',
      output: { userId: 'u1' },
      flow: 'flow-abc',
      timestamp: '2025-01-15T10:00:00.000Z',
    };

    const persisted = toPersistenceKey(record);
    expect(persisted.pk).toBe('flow#flow-abc');
    expect(persisted.sk).toBe('2025-01-15T10:00:00.000Z#rec-123');
    expect(persisted.concept).toBe('UserConcept');
  });

  it('syncEdgeKey creates sorted edge key', () => {
    const key = syncEdgeKey(['comp-1'], 'SyncA');
    expect(key).toBe('edge#comp-1#SyncA');
  });

  it('syncEdgeKey sorts multiple completion IDs', () => {
    const key1 = syncEdgeKey(['comp-b', 'comp-a'], 'SyncX');
    const key2 = syncEdgeKey(['comp-a', 'comp-b'], 'SyncX');
    expect(key1).toBe(key2);
    expect(key1).toBe('edge#comp-a|comp-b#SyncX');
  });

  it('syncEdgeKey produces different keys for different syncs', () => {
    const key1 = syncEdgeKey(['comp-1'], 'SyncA');
    const key2 = syncEdgeKey(['comp-1'], 'SyncB');
    expect(key1).not.toBe(key2);
  });
});

// ============================================================
// DynamoDB Action Log Tests
// ============================================================

describe('DynamoDB Durable Action Log — Extended', () => {
  function createLog() {
    const client = createMockDynamoDBClient();
    return createDynamoDBActionLog(client, {
      region: 'us-east-1',
      tableName: 'test-action-log',
    });
  }

  it('appends multiple records and loads entire flow', async () => {
    const log = createLog();

    const records: ActionRecord[] = [
      {
        id: generateId(), type: 'completion',
        concept: 'Auth', action: 'login',
        input: { user: 'alice' }, variant: 'ok', output: { token: 'abc' },
        flow: 'flow-1', timestamp: '2025-01-15T10:00:00.000Z',
      },
      {
        id: generateId(), type: 'invocation',
        concept: 'Session', action: 'create',
        input: { token: 'abc' }, sync: 'LoginSync',
        flow: 'flow-1', timestamp: '2025-01-15T10:00:01.000Z',
      },
      {
        id: generateId(), type: 'completion',
        concept: 'Session', action: 'create',
        input: { token: 'abc' }, variant: 'ok', output: { sessionId: 's1' },
        flow: 'flow-1', timestamp: '2025-01-15T10:00:02.000Z',
      },
    ];

    for (const record of records) {
      await log.append(record);
    }

    const loaded = await log.loadFlow('flow-1');
    expect(loaded).toHaveLength(3);
    expect(loaded[0].concept).toBe('Auth');
    expect(loaded[1].concept).toBe('Session');
    expect(loaded[2].concept).toBe('Session');
  });

  it('loadFlow returns empty array for nonexistent flow', async () => {
    const log = createLog();
    const loaded = await log.loadFlow('nonexistent-flow');
    expect(loaded).toEqual([]);
  });

  it('addSyncEdge creates edge verifiable by hasSyncEdge', async () => {
    const log = createLog();
    const compId = generateId();
    const invId = generateId();

    await log.addSyncEdge(compId, invId, 'TestSync');

    // addSyncEdge uses syncEdgeKey([compId], `${syncName}:${invId}`)
    const has = await log.hasSyncEdge([compId], `TestSync:${invId}`);
    expect(has).toBe(true);
  });

  it('hasSyncEdge returns false for non-matching sync name', async () => {
    const log = createLog();
    const compId = generateId();
    const invId = generateId();

    await log.addSyncEdge(compId, invId, 'SyncA');
    const has = await log.hasSyncEdge([compId], 'SyncB');
    expect(has).toBe(false);
  });

  it('addSyncEdgeForMatch with multiple IDs is verifiable', async () => {
    const log = createLog();
    const ids = [generateId(), generateId()];

    await log.addSyncEdgeForMatch(ids, 'MultiSync');
    const has = await log.hasSyncEdge(ids, 'MultiSync');
    expect(has).toBe(true);
  });

  it('gc removes old records', async () => {
    const log = createLog();

    // Add an old record with a past timestamp
    await log.append({
      id: generateId(), type: 'completion',
      concept: 'Old', action: 'task',
      input: {}, variant: 'ok', output: {},
      flow: 'old-flow', timestamp: '2024-01-01T00:00:00.000Z',
    });

    // Add a recent record
    await log.append({
      id: generateId(), type: 'completion',
      concept: 'New', action: 'task',
      input: {}, variant: 'ok', output: {},
      flow: 'new-flow', timestamp: '2025-12-01T00:00:00.000Z',
    });

    const deleted = await log.gc(new Date('2025-06-01T00:00:00.000Z'));
    expect(deleted).toBeGreaterThanOrEqual(1);
  });

  it('gc returns 0 when no records are old enough', async () => {
    const log = createLog();

    await log.append({
      id: generateId(), type: 'completion',
      concept: 'Recent', action: 'task',
      input: {}, variant: 'ok', output: {},
      flow: 'recent-flow', timestamp: '2025-12-01T00:00:00.000Z',
    });

    const deleted = await log.gc(new Date('2025-01-01T00:00:00.000Z'));
    expect(deleted).toBe(0);
  });

  it('isolates records across different flows', async () => {
    const log = createLog();

    await log.append({
      id: generateId(), type: 'completion',
      concept: 'A', action: 'run', input: {},
      variant: 'ok', output: {},
      flow: 'flow-a', timestamp: timestamp(),
    });

    await log.append({
      id: generateId(), type: 'completion',
      concept: 'B', action: 'run', input: {},
      variant: 'ok', output: {},
      flow: 'flow-b', timestamp: timestamp(),
    });

    const flowA = await log.loadFlow('flow-a');
    const flowB = await log.loadFlow('flow-b');
    expect(flowA).toHaveLength(1);
    expect(flowA[0].concept).toBe('A');
    expect(flowB).toHaveLength(1);
    expect(flowB[0].concept).toBe('B');
  });
});

// ============================================================
// Firestore Action Log Tests
// ============================================================

describe('Firestore Durable Action Log — Extended', () => {
  function createLog() {
    const client = createMockFirestoreClient();
    return createFirestoreActionLog(client, {
      projectId: 'test-project',
      collectionPrefix: 'test-logs',
    });
  }

  it('appends multiple records and loads entire flow', async () => {
    const log = createLog();

    await log.append({
      id: 'r1', type: 'completion',
      concept: 'Auth', action: 'login',
      input: { user: 'bob' }, variant: 'ok', output: { token: 'xyz' },
      flow: 'flow-2', timestamp: '2025-01-15T10:00:00.000Z',
    });

    await log.append({
      id: 'r2', type: 'invocation',
      concept: 'Session', action: 'create',
      input: { token: 'xyz' }, sync: 'LoginSync',
      flow: 'flow-2', timestamp: '2025-01-15T10:00:01.000Z',
    });

    const loaded = await log.loadFlow('flow-2');
    expect(loaded).toHaveLength(2);
    // Should be sorted by timestamp
    expect(loaded[0].id).toBe('r1');
    expect(loaded[1].id).toBe('r2');
  });

  it('loadFlow returns empty array for nonexistent flow', async () => {
    const log = createLog();
    const loaded = await log.loadFlow('nonexistent');
    expect(loaded).toEqual([]);
  });

  it('addSyncEdge creates edge verifiable by hasSyncEdge', async () => {
    const log = createLog();
    const compId = 'comp-fs-1';
    const invId = 'inv-fs-1';

    await log.addSyncEdge(compId, invId, 'TestSync');
    const has = await log.hasSyncEdge([compId], `TestSync:${invId}`);
    expect(has).toBe(true);
  });

  it('addSyncEdgeForMatch with multiple IDs is verifiable', async () => {
    const log = createLog();
    const ids = ['id-a', 'id-b'];

    await log.addSyncEdgeForMatch(ids, 'MultiSync');
    const has = await log.hasSyncEdge(ids, 'MultiSync');
    expect(has).toBe(true);
  });

  it('gc removes old sync edges', async () => {
    const log = createLog();

    // Add an old edge with past timestamp
    await log.addSyncEdgeForMatch(['old-comp'], 'OldSync');

    // Manually verify the edge exists
    const hasBefore = await log.hasSyncEdge(['old-comp'], 'OldSync');
    expect(hasBefore).toBe(true);

    // gc with a future cutoff should remove it
    const deleted = await log.gc(new Date('2030-01-01T00:00:00.000Z'));
    expect(deleted).toBeGreaterThanOrEqual(1);
  });

  it('isolates records across different flows', async () => {
    const log = createLog();

    await log.append({
      id: 'fa1', type: 'completion',
      concept: 'X', action: 'run', input: {},
      variant: 'ok', output: {},
      flow: 'flow-x', timestamp: timestamp(),
    });

    await log.append({
      id: 'fb1', type: 'completion',
      concept: 'Y', action: 'run', input: {},
      variant: 'ok', output: {},
      flow: 'flow-y', timestamp: timestamp(),
    });

    const flowX = await log.loadFlow('flow-x');
    const flowY = await log.loadFlow('flow-y');
    expect(flowX).toHaveLength(1);
    expect(flowX[0].concept).toBe('X');
    expect(flowY).toHaveLength(1);
    expect(flowY[0].concept).toBe('Y');
  });
});
