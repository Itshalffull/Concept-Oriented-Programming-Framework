// ============================================================
// Serverless Handler Edge Case Tests
//
// Tests for:
//   - GCF Pub/Sub handler (createPubSubGCFHandler)
//   - GCF HTTP handler: /query, unknown route, missing body, errors
//   - Lambda HTTP handler: /query, missing body, 404, 500
//   - Lambda SQS handler: malformed messages, missing publisher
// ============================================================

import { describe, it, expect } from 'vitest';
import type {
  ActionInvocation,
  ActionCompletion,
  ConceptHandler,
} from '../kernel/src/types.js';
import { generateId, timestamp } from '../kernel/src/types.js';
import { createInMemoryStorage } from '../kernel/src/storage.js';

import {
  createHttpLambdaHandler,
  createSqsLambdaHandler,
} from '../infrastructure/serverless/lambda-handler.js';
import type { APIGatewayEvent, SQSEvent } from '../infrastructure/serverless/lambda-handler.js';

import {
  createHttpGCFHandler,
  createPubSubGCFHandler,
} from '../infrastructure/serverless/gcf-handler.js';
import type {
  GCFHttpRequest,
  GCFHttpResponse,
  PubSubMessage,
  PubSubContext,
} from '../infrastructure/serverless/gcf-handler.js';

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
    async fail(_input, _storage) {
      throw new Error('Handler exploded');
    },
  };
}

function createInvocation(overrides?: Partial<ActionInvocation>): ActionInvocation {
  return {
    id: generateId(),
    concept: 'TestConcept',
    action: 'greet',
    input: { name: 'World' },
    flow: 'test-flow',
    timestamp: timestamp(),
    ...overrides,
  };
}

function createMockGCFResponse() {
  let responseCode = 0;
  let responseBody: any = null;

  const res: GCFHttpResponse = {
    status(code) { responseCode = code; return res; },
    json(data) { responseBody = data; },
    send(_body) {},
    set(_header, _value) { return res; },
  };

  return { res, getCode: () => responseCode, getBody: () => responseBody };
}

function createPubSubContext(): PubSubContext {
  return {
    eventId: 'evt-1',
    timestamp: new Date().toISOString(),
    eventType: 'google.pubsub.topic.publish',
    resource: { service: 'pubsub.googleapis.com', name: 'test-topic' },
  };
}

// ============================================================
// GCF Pub/Sub Handler Tests
// ============================================================

describe('GCF Pub/Sub Handler', () => {
  it('processes invocation and publishes completion', async () => {
    const published: ActionCompletion[] = [];
    const handler = createPubSubGCFHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
      completionPublisher: {
        async publish(completion) { published.push(completion); },
      },
    });

    const invocation = createInvocation();
    const message: PubSubMessage = {
      data: Buffer.from(JSON.stringify(invocation)).toString('base64'),
      messageId: 'msg-1',
      publishTime: new Date().toISOString(),
    };

    await handler(message, createPubSubContext());

    expect(published).toHaveLength(1);
    expect(published[0].variant).toBe('ok');
    expect(published[0].output.message).toBe('Hello, World!');
    expect(published[0].id).toBe(invocation.id);
  });

  it('publishes error completion for unknown action', async () => {
    const published: ActionCompletion[] = [];
    const handler = createPubSubGCFHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
      completionPublisher: {
        async publish(completion) { published.push(completion); },
      },
    });

    const invocation = createInvocation({ action: 'nonexistent' });
    const message: PubSubMessage = {
      data: Buffer.from(JSON.stringify(invocation)).toString('base64'),
      messageId: 'msg-2',
      publishTime: new Date().toISOString(),
    };

    await handler(message, createPubSubContext());

    expect(published).toHaveLength(1);
    expect(published[0].variant).toBe('error');
    expect(published[0].output.message).toContain('Unknown action');
  });

  it('throws when created without completionPublisher', () => {
    expect(() => createPubSubGCFHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    })).toThrow('completionPublisher');
  });
});

// ============================================================
// GCF HTTP Handler — Additional Tests
// ============================================================

describe('GCF HTTP Handler — Edge Cases', () => {
  it('handles /query endpoint', async () => {
    const storage = createInMemoryStorage();
    await storage.put('items', 'a', { name: 'Alpha', type: 'report' });
    await storage.put('items', 'b', { name: 'Beta', type: 'memo' });

    const handler = createHttpGCFHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage,
    });

    const { res, getCode, getBody } = createMockGCFResponse();
    const req: GCFHttpRequest = {
      method: 'POST',
      path: '/query',
      body: { relation: 'items', args: { type: 'report' } },
      headers: {},
    };

    await handler(req, res);
    expect(getCode()).toBe(200);
    expect(getBody()).toHaveLength(1);
    expect(getBody()[0].name).toBe('Alpha');
  });

  it('returns 404 for unknown route', async () => {
    const handler = createHttpGCFHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const { res, getCode, getBody } = createMockGCFResponse();
    const req: GCFHttpRequest = {
      method: 'GET',
      path: '/unknown',
      body: null,
      headers: {},
    };

    await handler(req, res);
    expect(getCode()).toBe(404);
    expect(getBody().error).toBe('Not found');
  });

  it('returns 400 for missing invocation body', async () => {
    const handler = createHttpGCFHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const { res, getCode, getBody } = createMockGCFResponse();
    const req: GCFHttpRequest = {
      method: 'POST',
      path: '/invoke',
      body: null,
      headers: {},
    };

    await handler(req, res);
    expect(getCode()).toBe(400);
    expect(getBody().error).toContain('Missing');
  });

  it('returns 500 when handler throws', async () => {
    const handler = createHttpGCFHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const invocation = createInvocation({ action: 'fail' });
    const { res, getCode, getBody } = createMockGCFResponse();
    const req: GCFHttpRequest = {
      method: 'POST',
      path: '/invoke',
      body: invocation,
      headers: {},
    };

    await handler(req, res);
    expect(getCode()).toBe(500);
    expect(getBody().error).toContain('exploded');
  });

  it('handles health check', async () => {
    const handler = createHttpGCFHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const { res, getCode, getBody } = createMockGCFResponse();
    const req: GCFHttpRequest = {
      method: 'GET',
      path: '/health',
      body: null,
      headers: {},
    };

    await handler(req, res);
    expect(getCode()).toBe(200);
    expect(getBody().available).toBe(true);
    expect(getBody().concept).toBe('TestConcept');
  });

  it('returns error completion for unknown action', async () => {
    const handler = createHttpGCFHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const invocation = createInvocation({ action: 'nonexistent' });
    const { res, getCode, getBody } = createMockGCFResponse();
    const req: GCFHttpRequest = {
      method: 'POST',
      path: '/invoke',
      body: invocation,
      headers: {},
    };

    await handler(req, res);
    expect(getCode()).toBe(200);
    expect(getBody().variant).toBe('error');
  });
});

// ============================================================
// Lambda HTTP Handler — Additional Tests
// ============================================================

describe('Lambda HTTP Handler — Edge Cases', () => {
  it('handles /query endpoint', async () => {
    const storage = createInMemoryStorage();
    await storage.put('items', 'a', { name: 'Alpha', type: 'report' });
    await storage.put('items', 'b', { name: 'Beta', type: 'memo' });

    const handler = createHttpLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage,
    });

    const event: APIGatewayEvent = {
      httpMethod: 'POST',
      path: '/query',
      body: JSON.stringify({ relation: 'items', args: { type: 'report' } }),
      headers: {},
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    const results = JSON.parse(response.body);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Alpha');
  });

  it('returns 400 for missing body on /invoke', async () => {
    const handler = createHttpLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const event: APIGatewayEvent = {
      httpMethod: 'POST',
      path: '/invoke',
      body: null,
      headers: {},
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain('Missing');
  });

  it('returns 400 for missing body on /query', async () => {
    const handler = createHttpLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const event: APIGatewayEvent = {
      httpMethod: 'POST',
      path: '/query',
      body: null,
      headers: {},
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 for unknown route', async () => {
    const handler = createHttpLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const event: APIGatewayEvent = {
      httpMethod: 'PUT',
      path: '/unknown',
      body: null,
      headers: {},
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(404);
  });

  it('returns 500 when handler throws', async () => {
    const handler = createHttpLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    });

    const invocation = createInvocation({ action: 'fail' });
    const event: APIGatewayEvent = {
      httpMethod: 'POST',
      path: '/invoke',
      body: JSON.stringify(invocation),
      headers: {},
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error).toContain('exploded');
  });

  it('includes CORS headers in responses', async () => {
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
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
  });
});

// ============================================================
// Lambda SQS Handler — Additional Tests
// ============================================================

describe('Lambda SQS Handler — Edge Cases', () => {
  it('reports failure for malformed message body', async () => {
    const published: ActionCompletion[] = [];
    const handler = createSqsLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
      completionPublisher: {
        async publish(completion) { published.push(completion); },
      },
    });

    const event: SQSEvent = {
      Records: [{
        messageId: 'bad-msg-1',
        body: 'not-valid-json{{',
        attributes: {},
        eventSourceARN: 'arn:aws:sqs:us-east-1:123:test-queue',
      }],
    };

    const result = await handler(event);
    expect(result.batchItemFailures).toHaveLength(1);
    expect(result.batchItemFailures[0].itemIdentifier).toBe('bad-msg-1');
    expect(published).toHaveLength(0);
  });

  it('processes mixed valid and invalid records', async () => {
    const published: ActionCompletion[] = [];
    const handler = createSqsLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
      completionPublisher: {
        async publish(completion) { published.push(completion); },
      },
    });

    const validInvocation = createInvocation();
    const event: SQSEvent = {
      Records: [
        {
          messageId: 'good-msg',
          body: JSON.stringify(validInvocation),
          attributes: {},
          eventSourceARN: 'arn:aws:sqs:us-east-1:123:test-queue',
        },
        {
          messageId: 'bad-msg',
          body: 'broken',
          attributes: {},
          eventSourceARN: 'arn:aws:sqs:us-east-1:123:test-queue',
        },
      ],
    };

    const result = await handler(event);
    expect(result.batchItemFailures).toHaveLength(1);
    expect(result.batchItemFailures[0].itemIdentifier).toBe('bad-msg');
    expect(published).toHaveLength(1);
    expect(published[0].variant).toBe('ok');
  });

  it('publishes error completion for unknown action (not a failure)', async () => {
    const published: ActionCompletion[] = [];
    const handler = createSqsLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
      completionPublisher: {
        async publish(completion) { published.push(completion); },
      },
    });

    const invocation = createInvocation({ action: 'nonexistent' });
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
    expect(published[0].variant).toBe('error');
  });

  it('throws when created without completionPublisher', () => {
    expect(() => createSqsLambdaHandler({
      conceptName: 'TestConcept',
      handler: createTestHandler(),
      storage: createInMemoryStorage(),
    })).toThrow('completionPublisher');
  });
});
