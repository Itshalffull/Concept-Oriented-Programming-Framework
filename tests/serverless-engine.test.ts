// ============================================================
// Serverless Engine & Evaluator Tests
//
// Tests for:
//   - Per-request engine: flow recovery from durable log
//   - Per-request engine: firing guard integration
//   - Per-request engine: persists completions + invocations
//   - Cold start: concurrent initialization
//   - Cold start: async factory in createModuleInitializer
//   - Pub/Sub evaluator handler
//   - SQS evaluator: batch failure reporting
//   - SQS evaluator: no dispatch when no sync matches
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  ActionInvocation,
  ActionCompletion,
  CompiledSync,
} from '../kernel/src/types.js';
import { generateId, timestamp } from '../kernel/src/types.js';
import { createConceptRegistry } from '../kernel/src/transport.js';

import { createPerRequestEngine, invalidatePerRequestCache } from '../engine/per-request-engine.js';
import { createDynamoDBActionLog } from '../engine/durable-action-log-dynamodb.js';
import {
  createSQSEvaluatorHandler,
  createPubSubEvaluatorHandler,
} from '../engine/serverless-evaluator.js';
import {
  createModuleInitializer,
  invalidateSyncCache,
  clearHandlerCache,
} from '../infrastructure/serverless/cold-start.js';
import type { DurableActionLog } from '../engine/durable-action-log.js';
import type { DynamoDBDocumentClient } from '../infrastructure/storage/dynamodb-storage.js';
import type { DistributedFiringGuard } from '../infrastructure/serverless/distributed-lock.js';

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
          if (item[realName] !== undefined) projected[realName] = item[realName];
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
// Test Fixtures
// ============================================================

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

function createDurableLog() {
  const client = createMockDynamoDBClient();
  return {
    log: createDynamoDBActionLog(client, {
      region: 'us-east-1',
      tableName: 'test-action-log',
    }),
    client,
  };
}

// ============================================================
// Per-Request Engine — Flow Recovery
// ============================================================

describe('Per-Request Engine — Flow Recovery', () => {
  beforeEach(() => {
    invalidatePerRequestCache();
  });

  it('recovers existing flow state from durable log', async () => {
    const { log: durableLog } = createDurableLog();
    const registry = createConceptRegistry();

    // Pre-populate durable log with a prior completion in the same flow
    await durableLog.append({
      id: 'prior-comp',
      type: 'completion',
      concept: 'SetupConcept',
      action: 'init',
      input: {},
      variant: 'ok',
      output: { ready: true },
      flow: 'recovery-flow',
      timestamp: '2025-01-15T10:00:00.000Z',
    });

    const engine = createPerRequestEngine({
      compiledSyncs: [createTestSync()],
      registry,
      durableLog,
    });

    // Process a new completion in the same flow
    const completion = createTestCompletion({ flow: 'recovery-flow' });
    const invocations = await engine.onCompletion(completion);

    // Engine should still produce invocations (the sync matches the new completion)
    expect(invocations.length).toBeGreaterThan(0);
    expect(invocations[0].concept).toBe('LogConcept');

    // The flow should now have 3+ records: prior comp + new comp + new invocation
    const flowRecords = await durableLog.loadFlow('recovery-flow');
    expect(flowRecords.length).toBeGreaterThanOrEqual(3);
  });

  it('persists completion and invocations to durable log', async () => {
    const { log: durableLog } = createDurableLog();
    const registry = createConceptRegistry();

    const engine = createPerRequestEngine({
      compiledSyncs: [createTestSync()],
      registry,
      durableLog,
    });

    const completion = createTestCompletion({ flow: 'persist-flow' });
    const invocations = await engine.onCompletion(completion);

    expect(invocations.length).toBeGreaterThan(0);

    // Verify the completion was persisted
    const flowRecords = await durableLog.loadFlow('persist-flow');
    const completions = flowRecords.filter(r => r.type === 'completion');
    const invocationRecords = flowRecords.filter(r => r.type === 'invocation');

    expect(completions).toHaveLength(1);
    expect(completions[0].id).toBe(completion.id);
    expect(invocationRecords.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Per-Request Engine — Firing Guard
// ============================================================

describe('Per-Request Engine — Firing Guard', () => {
  beforeEach(() => {
    invalidatePerRequestCache();
  });

  it('allows invocations when guard grants acquisition', async () => {
    const { log: durableLog } = createDurableLog();
    const registry = createConceptRegistry();

    const guard: DistributedFiringGuard = {
      async tryAcquire() { return true; },
    };

    const engine = createPerRequestEngine({
      compiledSyncs: [createTestSync()],
      registry,
      durableLog,
      firingGuard: guard,
    });

    const completion = createTestCompletion();
    const invocations = await engine.onCompletion(completion);
    expect(invocations.length).toBeGreaterThan(0);
  });

  it('blocks invocations when guard denies acquisition', async () => {
    const { log: durableLog } = createDurableLog();
    const registry = createConceptRegistry();

    const guard: DistributedFiringGuard = {
      async tryAcquire() { return false; },
    };

    const engine = createPerRequestEngine({
      compiledSyncs: [createTestSync()],
      registry,
      durableLog,
      firingGuard: guard,
    });

    const completion = createTestCompletion();
    const invocations = await engine.onCompletion(completion);
    expect(invocations).toHaveLength(0);
  });

  it('guard receives completion ID and sync info', async () => {
    const { log: durableLog } = createDurableLog();
    const registry = createConceptRegistry();
    const acquireCalls: { completionIds: string[]; syncName: string }[] = [];

    const guard: DistributedFiringGuard = {
      async tryAcquire(completionIds, syncName) {
        acquireCalls.push({ completionIds: [...completionIds], syncName });
        return true;
      },
    };

    const engine = createPerRequestEngine({
      compiledSyncs: [createTestSync()],
      registry,
      durableLog,
      firingGuard: guard,
    });

    const completion = createTestCompletion();
    await engine.onCompletion(completion);

    expect(acquireCalls.length).toBeGreaterThan(0);
    expect(acquireCalls[0].completionIds).toContain(completion.id);
    expect(acquireCalls[0].syncName).toContain('TestSync');
  });
});

// ============================================================
// Cold Start — Concurrent Initialization
// ============================================================

describe('Cold Start — Module Initializer Edge Cases', () => {
  beforeEach(() => {
    invalidateSyncCache();
    clearHandlerCache();
  });

  it('handles concurrent calls to createModuleInitializer', async () => {
    let callCount = 0;
    const init = createModuleInitializer(async () => {
      callCount++;
      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, 10));
      return { value: 42 };
    });

    // Fire multiple concurrent calls
    const [r1, r2, r3] = await Promise.all([init(), init(), init()]);

    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    expect(r1.value).toBe(42);
    expect(callCount).toBe(1); // factory only called once
  });

  it('handles async factory that returns a promise', async () => {
    const init = createModuleInitializer(async () => {
      return { initialized: true, ts: Date.now() };
    });

    const result = await init();
    expect(result.initialized).toBe(true);
    expect(typeof result.ts).toBe('number');
  });

  it('handles synchronous factory', async () => {
    const init = createModuleInitializer(() => {
      return { sync: true };
    });

    const result = await init();
    expect(result.sync).toBe(true);
  });
});

// ============================================================
// Pub/Sub Evaluator Handler
// ============================================================

describe('Pub/Sub Evaluator Handler', () => {
  beforeEach(() => {
    invalidatePerRequestCache();
  });

  it('processes completion and dispatches invocations', async () => {
    const dispatched: ActionInvocation[] = [];
    const { log: durableLog } = createDurableLog();
    const registry = createConceptRegistry();

    const handler = createPubSubEvaluatorHandler({
      compiledSyncs: [createTestSync()],
      registry,
      durableLog,
      dispatcher: {
        async dispatch(invocations) { dispatched.push(...invocations); },
      },
    });

    const completion = createTestCompletion();
    const message = {
      data: Buffer.from(JSON.stringify(completion)).toString('base64'),
      messageId: 'msg-ps-1',
      publishTime: new Date().toISOString(),
    };

    const context = {
      eventId: 'evt-1',
      timestamp: new Date().toISOString(),
      eventType: 'google.pubsub.topic.publish',
      resource: { service: 'pubsub.googleapis.com', name: 'test' },
    };

    await handler(message, context);

    expect(dispatched.length).toBeGreaterThan(0);
    expect(dispatched[0].concept).toBe('LogConcept');
    expect(dispatched[0].action).toBe('log');
  });

  it('does not dispatch when no sync matches', async () => {
    const dispatched: ActionInvocation[] = [];
    const { log: durableLog } = createDurableLog();
    const registry = createConceptRegistry();

    const handler = createPubSubEvaluatorHandler({
      compiledSyncs: [createTestSync()],
      registry,
      durableLog,
      dispatcher: {
        async dispatch(invocations) { dispatched.push(...invocations); },
      },
    });

    // Non-matching completion
    const completion = createTestCompletion({
      concept: 'UnrelatedConcept',
      action: 'something',
    });

    const message = {
      data: Buffer.from(JSON.stringify(completion)).toString('base64'),
      messageId: 'msg-ps-2',
      publishTime: new Date().toISOString(),
    };

    const context = {
      eventId: 'evt-2',
      timestamp: new Date().toISOString(),
      eventType: 'google.pubsub.topic.publish',
      resource: { service: 'pubsub.googleapis.com', name: 'test' },
    };

    await handler(message, context);
    expect(dispatched).toHaveLength(0);
  });
});

// ============================================================
// SQS Evaluator Handler — Edge Cases
// ============================================================

describe('SQS Evaluator Handler — Edge Cases', () => {
  beforeEach(() => {
    invalidatePerRequestCache();
  });

  it('reports batch failure for malformed message', async () => {
    const dispatched: ActionInvocation[] = [];
    const { log: durableLog } = createDurableLog();
    const registry = createConceptRegistry();

    const handler = createSQSEvaluatorHandler({
      compiledSyncs: [createTestSync()],
      registry,
      durableLog,
      dispatcher: {
        async dispatch(invocations) { dispatched.push(...invocations); },
      },
    });

    const event = {
      Records: [{
        messageId: 'bad-eval-msg',
        body: '{{not-json',
        attributes: {},
        eventSourceARN: 'arn:aws:sqs:us-east-1:123:test',
      }],
    };

    const result = await handler(event);
    expect(result.batchItemFailures).toHaveLength(1);
    expect(result.batchItemFailures[0].itemIdentifier).toBe('bad-eval-msg');
    expect(dispatched).toHaveLength(0);
  });

  it('does not dispatch when no sync matches', async () => {
    const dispatched: ActionInvocation[] = [];
    const { log: durableLog } = createDurableLog();
    const registry = createConceptRegistry();

    const handler = createSQSEvaluatorHandler({
      compiledSyncs: [createTestSync()],
      registry,
      durableLog,
      dispatcher: {
        async dispatch(invocations) { dispatched.push(...invocations); },
      },
    });

    const completion = createTestCompletion({
      concept: 'Unrelated',
      action: 'nope',
    });

    const event = {
      Records: [{
        messageId: 'no-match',
        body: JSON.stringify(completion),
        attributes: {},
        eventSourceARN: 'arn:aws:sqs:us-east-1:123:test',
      }],
    };

    const result = await handler(event);
    expect(result.batchItemFailures).toHaveLength(0);
    expect(dispatched).toHaveLength(0);
  });

  it('processes multiple records with mixed results', async () => {
    const dispatched: ActionInvocation[] = [];
    const { log: durableLog } = createDurableLog();
    const registry = createConceptRegistry();

    const handler = createSQSEvaluatorHandler({
      compiledSyncs: [createTestSync()],
      registry,
      durableLog,
      dispatcher: {
        async dispatch(invocations) { dispatched.push(...invocations); },
      },
    });

    const goodCompletion = createTestCompletion();
    const event = {
      Records: [
        {
          messageId: 'good-msg',
          body: JSON.stringify(goodCompletion),
          attributes: {},
          eventSourceARN: 'arn:aws:sqs:us-east-1:123:test',
        },
        {
          messageId: 'bad-msg',
          body: 'broken-json',
          attributes: {},
          eventSourceARN: 'arn:aws:sqs:us-east-1:123:test',
        },
      ],
    };

    const result = await handler(event);
    expect(result.batchItemFailures).toHaveLength(1);
    expect(result.batchItemFailures[0].itemIdentifier).toBe('bad-msg');
    expect(dispatched.length).toBeGreaterThan(0);
  });
});
