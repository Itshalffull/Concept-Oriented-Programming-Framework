// ============================================================
// Serverless Infrastructure Tests
//
// Tests for:
//   - Lambda/GCF handler scaffolds
//   - Cold start optimization
//   - Durable action log (DynamoDB + Firestore)
//   - Distributed firing guard
//   - Per-request engine bootstrap
//   - SQS/Pub/Sub transport adapters
//   - Serverless engine evaluator
//   - Blob storage adapter
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  ActionInvocation,
  ActionCompletion,
  ConceptHandler,
  CompiledSync,
} from '../runtime/types.js';
import { generateId, timestamp } from '../runtime/types.js';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { createConceptRegistry } from '../runtime/adapters/transport.js';

// Lambda/GCF handlers
import { createHttpLambdaHandler, createSqsLambdaHandler } from '../runtime/adapters/serverless/lambda-handler.js';
import { createHttpGCFHandler } from '../runtime/adapters/serverless/gcf-handler.js';
import type { APIGatewayEvent, SQSEvent } from '../runtime/adapters/serverless/lambda-handler.js';
import type { GCFHttpRequest, GCFHttpResponse } from '../runtime/adapters/serverless/gcf-handler.js';

// Cold start
import {
  loadCompiledSyncs,
  getSyncIndex,
  lazyLoadHandler,
  invalidateSyncCache,
  clearHandlerCache,
  createModuleInitializer,
} from '../runtime/adapters/serverless/cold-start.js';

// Durable action log
import type { DurableActionLog } from '../runtime/action-log/durable-action-log.js';
import { createDynamoDBActionLog } from '../runtime/action-log/durable-action-log-dynamodb.js';
import { createFirestoreActionLog } from '../runtime/action-log/durable-action-log-firestore.js';

// Distributed firing guard
import {
  createDynamoDBFiringGuard,
  createFirestoreFiringGuard,
} from '../runtime/adapters/serverless/distributed-lock.js';

// Per-request engine
import { createPerRequestEngine, invalidatePerRequestCache } from '../runtime/sync-engine/per-request-engine.js';

// SQS/Pub/Sub transports
import { createSQSTransport, createSQSCompletionPublisher } from '../runtime/adapters/sqs-transport.js';
import { createPubSubTransport, createPubSubCompletionPublisher } from '../runtime/adapters/pubsub-transport.js';

// Serverless evaluator
import { createSQSEvaluatorHandler } from '../runtime/sync-engine/serverless-evaluator.js';

// Blob storage
import { createBlobStorage, getPresignedUrl } from '../runtime/adapters/blob-storage.js';

// Re-use mock factories from serverless-storage.test.ts patterns
import type { DynamoDBDocumentClient } from '../runtime/adapters/dynamodb-storage.js';
import type { FirestoreClient, FirestoreDocument, FirestoreQuerySnapshot } from '../runtime/adapters/firestore-storage.js';

// ============================================================
// Test Fixtures
// ============================================================

function createTestHandler(): ConceptHandler {
  return {
    async greet(input, _storage) {
      return { variant: 'ok', message: `Hello, ${input.name}!` };
    },
    async store(input, storage) {
      await storage.put('items', input.key as string, { value: input.value });
      return { variant: 'ok', key: input.key };
    },
  };
}

function createTestCompletion(overrides?: Partial<ActionCompletion>): ActionCompletion {
  return {
    id: generateId(),
    concept: 'TestConcept',
    action: 'greet',
    input: { name: 'Alice' },
    variant: 'ok',
    output: { message: 'Hello, Alice!' },
    flow: 'test-flow-1',
    timestamp: timestamp(),
    ...overrides,
  };
}

function createTestSync(): CompiledSync {
  return {
    name: 'TestSync',
    annotations: ['eager'],
    when: [{
      concept: 'TestConcept',
      action: 'greet',
      inputFields: [],
      outputFields: [{
        name: 'message',
        match: { type: 'variable', name: 'msg' },
      }],
    }],
    where: [],
    then: [{
      concept: 'LogConcept',
      action: 'log',
      fields: [{
        name: 'message',
        value: { type: 'variable', name: 'msg' },
      }],
    }],
  };
}

// ============================================================
// Mock DynamoDB Client (simplified for action log)
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
      // Support conditional expressions for firing guard
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
// Lambda Handler Tests
// ============================================================

describe('Lambda HTTP Handler', () => {
  it('handles invoke requests', async () => {
    const handler = createHttpLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const invocation: ActionInvocation = {
      id: generateId(),
      concept: 'TestConcept',
      action: 'greet',
      input: { name: 'World' },
      flow: 'test-flow',
      timestamp: timestamp(),
    };

    const event: APIGatewayEvent = {
      httpMethod: 'POST',
      path: '/invoke',
      body: JSON.stringify(invocation),
      headers: {},
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);

    const completion: ActionCompletion = JSON.parse(response.body);
    expect(completion.variant).toBe('ok');
    expect(completion.output.message).toBe('Hello, World!');
  });

  it('handles health check', async () => {
    const handler = createHttpLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const event: APIGatewayEvent = {
      httpMethod: 'GET',
      path: '/health',
      body: null,
      headers: {},
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.available).toBe(true);
  });

  it('returns error for unknown action', async () => {
    const handler = createHttpLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const invocation: ActionInvocation = {
      id: generateId(),
      concept: 'TestConcept',
      action: 'unknown',
      input: {},
      flow: 'test-flow',
      timestamp: timestamp(),
    };

    const event: APIGatewayEvent = {
      httpMethod: 'POST',
      path: '/invoke',
      body: JSON.stringify(invocation),
      headers: {},
    };

    const response = await handler(event);
    const completion = JSON.parse(response.body);
    expect(completion.variant).toBe('error');
  });
});

describe('Lambda SQS Handler', () => {
  it('processes SQS records and publishes completions', async () => {
    const published: ActionCompletion[] = [];
    const handler = createSqsLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
      completionPublisher: {
        async publish(completion) { published.push(completion); },
      },
    });

    const invocation: ActionInvocation = {
      id: generateId(),
      concept: 'TestConcept',
      action: 'greet',
      input: { name: 'SQS' },
      flow: 'sqs-flow',
      timestamp: timestamp(),
    };

    const event: SQSEvent = {
      Records: [{
        messageId: 'msg-1',
        body: JSON.stringify(invocation),
        attributes: {},
        eventSourceARN: 'arn:aws:sqs:us-east-1:123:test-queue',
      }],
    };

    const result = await handler(event);
    expect(result.batchItemFailures).toHaveLength(0);
    expect(published).toHaveLength(1);
    expect(published[0].variant).toBe('ok');
    expect(published[0].output.message).toBe('Hello, SQS!');
  });
});

// ============================================================
// GCF Handler Tests
// ============================================================

describe('GCF HTTP Handler', () => {
  it('handles invoke requests', async () => {
    const handler = createHttpGCFHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const invocation: ActionInvocation = {
      id: generateId(),
      concept: 'TestConcept',
      action: 'greet',
      input: { name: 'GCF' },
      flow: 'test-flow',
      timestamp: timestamp(),
    };

    let responseCode = 0;
    let responseBody: any = null;

    const req: GCFHttpRequest = {
      method: 'POST',
      path: '/invoke',
      body: invocation,
      headers: {},
    };

    const res: GCFHttpResponse = {
      status(code) { responseCode = code; return res; },
      json(data) { responseBody = data; },
      send(_body) {},
      set(_header, _value) { return res; },
    };

    await handler(req, res);
    expect(responseCode).toBe(200);
    expect(responseBody.variant).toBe('ok');
    expect(responseBody.output.message).toBe('Hello, GCF!');
  });
});

// ============================================================
// Cold Start Optimization Tests
// ============================================================

describe('Cold Start Optimization', () => {
  beforeEach(() => {
    invalidateSyncCache();
    clearHandlerCache();
  });

  it('loadCompiledSyncs caches across calls', () => {
    const syncs = [createTestSync()];
    const r1 = loadCompiledSyncs(syncs);
    const r2 = loadCompiledSyncs(syncs);
    expect(r1).toBe(r2);
  });

  it('getSyncIndex builds and caches sync index', () => {
    const syncs = [createTestSync()];
    const i1 = getSyncIndex(syncs);
    const i2 = getSyncIndex(syncs);
    expect(i1).toBe(i2);
    expect(i1.size).toBeGreaterThan(0);
  });

  it('lazyLoadHandler caches handler by concept name', () => {
    let callCount = 0;
    const loader = () => {
      callCount++;
      return createTestHandler();
    };

    const h1 = lazyLoadHandler('Test', loader);
    const h2 = lazyLoadHandler('Test', loader);
    expect(h1).toBe(h2);
    expect(callCount).toBe(1);
  });

  it('createModuleInitializer runs factory once', async () => {
    let callCount = 0;
    const init = createModuleInitializer(() => {
      callCount++;
      return { value: 42 };
    });

    const r1 = await init();
    const r2 = await init();
    expect(r1).toBe(r2);
    expect(r1.value).toBe(42);
    expect(callCount).toBe(1);
  });
});

// ============================================================
// Durable Action Log Tests
// ============================================================

describe('DynamoDB Durable Action Log', () => {
  it('appends and loads flow records', async () => {
    const client = createMockDynamoDBClient();
    const log = createDynamoDBActionLog(client, {
      region: 'us-east-1',
      tableName: 'test-action-log',
    });

    const record = {
      id: generateId(),
      type: 'completion' as const,
      concept: 'TestConcept',
      action: 'greet',
      input: { name: 'Alice' },
      variant: 'ok',
      output: { message: 'Hello, Alice!' },
      flow: 'flow-1',
      timestamp: timestamp(),
    };

    await log.append(record);
    const loaded = await log.loadFlow('flow-1');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(record.id);
    expect(loaded[0].concept).toBe('TestConcept');
  });

  it('tracks sync edges', async () => {
    const client = createMockDynamoDBClient();
    const log = createDynamoDBActionLog(client, {
      region: 'us-east-1',
      tableName: 'test-action-log',
    });

    const completionId = generateId();
    const invocationId = generateId();

    await log.addSyncEdge(completionId, invocationId, 'TestSync');
    // The edge key format differs — addSyncEdge uses a different key pattern
    // Direct hasSyncEdge check with addSyncEdgeForMatch
    await log.addSyncEdgeForMatch([completionId], 'TestSync');
    const has = await log.hasSyncEdge([completionId], 'TestSync');
    expect(has).toBe(true);
  });

  it('hasSyncEdge returns false for non-existent edges', async () => {
    const client = createMockDynamoDBClient();
    const log = createDynamoDBActionLog(client, {
      region: 'us-east-1',
      tableName: 'test-action-log',
    });

    const has = await log.hasSyncEdge(['nonexistent'], 'TestSync');
    expect(has).toBe(false);
  });
});

describe('Firestore Durable Action Log', () => {
  it('appends and loads flow records', async () => {
    const client = createMockFirestoreClient();
    const log = createFirestoreActionLog(client, {
      projectId: 'test-project',
      collectionPrefix: 'test-logs',
    });

    const record = {
      id: generateId(),
      type: 'completion' as const,
      concept: 'TestConcept',
      action: 'greet',
      input: { name: 'Bob' },
      variant: 'ok',
      output: { message: 'Hello, Bob!' },
      flow: 'flow-2',
      timestamp: timestamp(),
    };

    await log.append(record);
    const loaded = await log.loadFlow('flow-2');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(record.id);
  });

  it('tracks sync edges', async () => {
    const client = createMockFirestoreClient();
    const log = createFirestoreActionLog(client, {
      projectId: 'test-project',
      collectionPrefix: 'test-logs',
    });

    const completionId = generateId();
    await log.addSyncEdgeForMatch([completionId], 'TestSync');
    const has = await log.hasSyncEdge([completionId], 'TestSync');
    expect(has).toBe(true);
  });
});

// ============================================================
// Distributed Firing Guard Tests
// ============================================================

describe('DynamoDB Distributed Firing Guard', () => {
  it('acquires guard on first attempt', async () => {
    const client = createMockDynamoDBClient();
    const guard = createDynamoDBFiringGuard(client, {
      tableName: 'test-guards',
    });

    const acquired = await guard.tryAcquire(['comp-1'], 'SyncA');
    expect(acquired).toBe(true);
  });

  it('rejects second acquisition for same edge', async () => {
    const client = createMockDynamoDBClient();
    const guard = createDynamoDBFiringGuard(client, {
      tableName: 'test-guards',
    });

    const first = await guard.tryAcquire(['comp-1'], 'SyncA');
    const second = await guard.tryAcquire(['comp-1'], 'SyncA');
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('allows different syncs for same completion', async () => {
    const client = createMockDynamoDBClient();
    const guard = createDynamoDBFiringGuard(client, {
      tableName: 'test-guards',
    });

    const a = await guard.tryAcquire(['comp-1'], 'SyncA');
    const b = await guard.tryAcquire(['comp-1'], 'SyncB');
    expect(a).toBe(true);
    expect(b).toBe(true);
  });
});

describe('Firestore Distributed Firing Guard', () => {
  it('acquires guard on first attempt', async () => {
    const client = createMockFirestoreClient();
    const guard = createFirestoreFiringGuard(client, {
      collectionPath: 'test-guards',
    });

    const acquired = await guard.tryAcquire(['comp-1'], 'SyncA');
    expect(acquired).toBe(true);
  });

  it('rejects second acquisition for same edge', async () => {
    const client = createMockFirestoreClient();
    const guard = createFirestoreFiringGuard(client, {
      collectionPath: 'test-guards',
    });

    const first = await guard.tryAcquire(['comp-1'], 'SyncA');
    const second = await guard.tryAcquire(['comp-1'], 'SyncA');
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});

// ============================================================
// Per-Request Engine Tests
// ============================================================

describe('Per-Request Engine', () => {
  beforeEach(() => {
    invalidatePerRequestCache();
  });

  it('processes a completion and produces invocations', async () => {
    const client = createMockDynamoDBClient();
    const durableLog = createDynamoDBActionLog(client, {
      region: 'us-east-1',
      tableName: 'test-action-log',
    });

    const registry = createConceptRegistry();
    const engine = createPerRequestEngine({
      compiledSyncs: [createTestSync()],
      registry,
      durableLog,
    });

    const completion = createTestCompletion();
    const invocations = await engine.onCompletion(completion);

    expect(invocations.length).toBeGreaterThan(0);
    expect(invocations[0].concept).toBe('LogConcept');
    expect(invocations[0].action).toBe('log');
  });

  it('caches sync index across calls', async () => {
    const client = createMockDynamoDBClient();
    const durableLog = createDynamoDBActionLog(client, {
      region: 'us-east-1',
      tableName: 'test-action-log',
    });

    const registry = createConceptRegistry();
    const syncs = [createTestSync()];

    const e1 = createPerRequestEngine({
      compiledSyncs: syncs,
      registry,
      durableLog,
    });

    const e2 = createPerRequestEngine({
      compiledSyncs: syncs,
      registry,
      durableLog,
    });

    // Both engines share the cached sync index
    expect(e1.getSyncIndex()).toBe(e2.getSyncIndex());
  });
});

// ============================================================
// SQS Transport Adapter Tests
// ============================================================

describe('SQS Transport Adapter', () => {
  it('sends invocations to queue and receives completions', async () => {
    const messages: Record<string, { body: string; receiptHandle: string }[]> = {};

    const mockSQSClient = {
      async sendMessage(params: any) {
        const queue = params.QueueUrl;
        if (!messages[queue]) messages[queue] = [];
        const msgId = generateId();
        messages[queue].push({
          body: params.MessageBody,
          receiptHandle: `receipt-${msgId}`,
        });

        // Simulate concept processing: parse the invocation, create completion
        const invocation: ActionInvocation = JSON.parse(params.MessageBody);
        if (queue.includes('-invocations')) {
          const compQueue = queue.replace('-invocations', '-completions');
          if (!messages[compQueue]) messages[compQueue] = [];
          const completion: ActionCompletion = {
            id: invocation.id,
            concept: invocation.concept,
            action: invocation.action,
            input: invocation.input,
            variant: 'ok',
            output: { result: 'done' },
            flow: invocation.flow,
            timestamp: new Date().toISOString(),
          };
          messages[compQueue].push({
            body: JSON.stringify(completion),
            receiptHandle: `receipt-comp-${msgId}`,
          });
        }

        return { MessageId: msgId };
      },

      async receiveMessage(params: any) {
        const queue = params.QueueUrl;
        const msgs = messages[queue] || [];
        const batch = msgs.splice(0, params.MaxNumberOfMessages || 1);
        return {
          Messages: batch.map((m, i) => ({
            MessageId: `msg-${i}`,
            Body: m.body,
            ReceiptHandle: m.receiptHandle,
          })),
        };
      },

      async deleteMessage(_params: any) {},
    };

    const transport = createSQSTransport(mockSQSClient, {
      region: 'us-east-1',
      queuePrefix: 'test-',
      visibilityTimeout: 30,
    }, 'TestConcept');

    const invocation: ActionInvocation = {
      id: generateId(),
      concept: 'TestConcept',
      action: 'greet',
      input: { name: 'SQS' },
      flow: 'test-flow',
      timestamp: timestamp(),
    };

    const completion = await transport.invoke(invocation);
    expect(completion.variant).toBe('ok');
    expect(completion.id).toBe(invocation.id);
  });

  it('completion publisher sends to correct queue', async () => {
    const sent: any[] = [];

    const mockSQSClient = {
      async sendMessage(params: any) {
        sent.push(params);
        return { MessageId: generateId() };
      },
      async receiveMessage() { return {}; },
      async deleteMessage() {},
    };

    const publisher = createSQSCompletionPublisher(mockSQSClient, {
      region: 'us-east-1',
      queuePrefix: 'test-',
      visibilityTimeout: 30,
    }, 'TestConcept');

    const completion = createTestCompletion();
    await publisher.publish(completion);

    expect(sent).toHaveLength(1);
    expect(sent[0].QueueUrl).toContain('TestConcept-completions');
  });
});

// ============================================================
// Pub/Sub Transport Adapter Tests
// ============================================================

describe('Pub/Sub Transport Adapter', () => {
  it('completion publisher sends to correct topic', async () => {
    const published: any[] = [];

    const mockPubSubClient = {
      async publish(params: any) {
        published.push(params);
        return { messageId: generateId() };
      },
      async pull() { return {}; },
      async acknowledge() {},
    };

    const publisher = createPubSubCompletionPublisher(mockPubSubClient, {
      projectId: 'test-project',
      topicPrefix: 'test-',
      ackDeadlineSeconds: 60,
    }, 'TestConcept');

    const completion = createTestCompletion();
    await publisher.publish(completion);

    expect(published).toHaveLength(1);
    expect(published[0].topic).toContain('TestConcept-completions');
  });
});

// ============================================================
// Serverless Engine Evaluator Tests
// ============================================================

describe('SQS Engine Evaluator', () => {
  beforeEach(() => {
    invalidatePerRequestCache();
  });

  it('processes completion and dispatches invocations', async () => {
    const dispatched: ActionInvocation[] = [];
    const client = createMockDynamoDBClient();
    const durableLog = createDynamoDBActionLog(client, {
      region: 'us-east-1',
      tableName: 'test-action-log',
    });

    const registry = createConceptRegistry();
    const handler = createSQSEvaluatorHandler({
      compiledSyncs: [createTestSync()],
      registry,
      durableLog,
      dispatcher: {
        async dispatch(invocations) { dispatched.push(...invocations); },
      },
    });

    const completion = createTestCompletion();
    const event = {
      Records: [{
        messageId: 'msg-1',
        body: JSON.stringify(completion),
        attributes: {},
        eventSourceARN: 'arn:aws:sqs:us-east-1:123:test-completions',
      }],
    };

    const result = await handler(event);
    expect(result.batchItemFailures).toHaveLength(0);
    expect(dispatched.length).toBeGreaterThan(0);
    expect(dispatched[0].concept).toBe('LogConcept');
  });
});

// ============================================================
// Blob Storage Adapter Tests
// ============================================================

describe('Blob Storage Adapter', () => {
  function createMockBlobClient() {
    const objects = new Map<string, { body: string; contentType?: string }>();

    return {
      objects,
      async putObject(params: any) {
        objects.set(`${params.bucket}/${params.key}`, {
          body: params.body,
          contentType: params.contentType,
        });
      },
      async getObject(params: any) {
        return objects.get(`${params.bucket}/${params.key}`) || null;
      },
      async deleteObject(params: any) {
        objects.delete(`${params.bucket}/${params.key}`);
      },
      async getPresignedUrl(params: any) {
        return `https://${params.bucket}.s3.amazonaws.com/${params.key}?expires=${params.expiresIn}`;
      },
    };
  }

  it('stores and retrieves objects', async () => {
    const blobClient = createMockBlobClient();
    const indexStorage = createInMemoryStorage();
    const storage = createBlobStorage(blobClient, {
      provider: 's3',
      bucket: 'test-bucket',
      indexStorage,
    });

    await storage.put('documents', 'doc1', { title: 'Test', body: 'Content' });
    const result = await storage.get('documents', 'doc1');
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Test');
    expect(result!.body).toBe('Content');
  });

  it('deletes objects', async () => {
    const blobClient = createMockBlobClient();
    const indexStorage = createInMemoryStorage();
    const storage = createBlobStorage(blobClient, {
      provider: 's3',
      bucket: 'test-bucket',
      indexStorage,
    });

    await storage.put('documents', 'doc1', { title: 'Test' });
    await storage.del('documents', 'doc1');
    const result = await storage.get('documents', 'doc1');
    expect(result).toBeNull();
  });

  it('finds objects via index', async () => {
    const blobClient = createMockBlobClient();
    const indexStorage = createInMemoryStorage();
    const storage = createBlobStorage(blobClient, {
      provider: 's3',
      bucket: 'test-bucket',
      indexStorage,
    });

    await storage.put('documents', 'doc1', { title: 'Alpha', type: 'report' });
    await storage.put('documents', 'doc2', { title: 'Beta', type: 'memo' });
    await storage.put('documents', 'doc3', { title: 'Gamma', type: 'report' });

    const reports = await storage.find('documents', { type: 'report' });
    expect(reports).toHaveLength(2);
  });

  it('generates presigned URLs', async () => {
    const blobClient = createMockBlobClient();
    const indexStorage = createInMemoryStorage();
    const config = {
      provider: 's3' as const,
      bucket: 'test-bucket',
      indexStorage,
      presignedUrlTtl: 3600,
    };

    const url = await getPresignedUrl(blobClient, config, 'documents', 'doc1');
    expect(url).toContain('test-bucket');
    expect(url).toContain('documents/doc1');
  });

  it('getMeta returns lastWrittenAt from index', async () => {
    const blobClient = createMockBlobClient();
    const indexStorage = createInMemoryStorage();
    const storage = createBlobStorage(blobClient, {
      provider: 's3',
      bucket: 'test-bucket',
      indexStorage,
    });

    await storage.put('documents', 'doc1', { title: 'Test' });
    if (storage.getMeta) {
      const meta = await storage.getMeta('documents', 'doc1');
      expect(meta).not.toBeNull();
      expect(meta!.lastWrittenAt).toBeDefined();
    }
  });
});
