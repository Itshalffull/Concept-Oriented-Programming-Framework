// ============================================================
// Serverless Transport Adapter Tests
//
// Tests for:
//   - Pub/Sub transport invoke (send + receive completion)
//   - Pub/Sub transport timeout behavior
//   - Pub/Sub transport ordering, query, health
//   - SQS transport FIFO mode
//   - SQS transport query (unsupported), health
//   - SQS/Pub/Sub completion publisher with FIFO/ordering
// ============================================================

import { describe, it, expect } from 'vitest';
import type { ActionInvocation, ActionCompletion } from '../kernel/src/types.js';
import { generateId, timestamp } from '../kernel/src/types.js';

import { createSQSTransport, createSQSCompletionPublisher } from '../infrastructure/transports/sqs-transport.js';
import { createPubSubTransport, createPubSubCompletionPublisher } from '../infrastructure/transports/pubsub-transport.js';

// ============================================================
// Mock SQS Client
// ============================================================

function createMockSQSClient() {
  const queues: Record<string, { body: string; receiptHandle: string }[]> = {};
  const sent: any[] = [];
  const deleted: any[] = [];

  return {
    sent,
    deleted,
    queues,

    client: {
      async sendMessage(params: any) {
        sent.push(params);
        const queue = params.QueueUrl;
        if (!queues[queue]) queues[queue] = [];
        const msgId = generateId();
        queues[queue].push({
          body: params.MessageBody,
          receiptHandle: `receipt-${msgId}`,
        });

        // Auto-generate completion when sending to invocations queue
        const invocation: ActionInvocation = JSON.parse(params.MessageBody);
        if (queue.includes('-invocations')) {
          const compQueue = queue.replace('-invocations', '-completions');
          if (!queues[compQueue]) queues[compQueue] = [];
          const completion: ActionCompletion = {
            id: invocation.id,
            concept: invocation.concept,
            action: invocation.action,
            input: invocation.input,
            variant: 'ok',
            output: { result: 'processed' },
            flow: invocation.flow,
            timestamp: new Date().toISOString(),
          };
          queues[compQueue].push({
            body: JSON.stringify(completion),
            receiptHandle: `receipt-comp-${msgId}`,
          });
        }

        return { MessageId: msgId };
      },

      async receiveMessage(params: any) {
        const queue = params.QueueUrl;
        const msgs = queues[queue] || [];
        const batch = msgs.splice(0, params.MaxNumberOfMessages || 1);
        return {
          Messages: batch.map((m, i) => ({
            MessageId: `msg-${i}`,
            Body: m.body,
            ReceiptHandle: m.receiptHandle,
          })),
        };
      },

      async deleteMessage(params: any) {
        deleted.push(params);
      },
    },
  };
}

// ============================================================
// Mock Pub/Sub Client
// ============================================================

function createMockPubSubClient() {
  const subscriptions: Record<string, { ackId: string; data: string; attributes?: Record<string, string> }[]> = {};
  const published: any[] = [];
  const acknowledged: any[] = [];

  return {
    published,
    acknowledged,
    subscriptions,

    client: {
      async publish(params: any) {
        published.push(params);

        // Auto-create completion message when publishing to invocations topic
        if (params.topic.includes('-invocations')) {
          const decoded = Buffer.from(params.data, 'base64').toString('utf-8');
          const invocation: ActionInvocation = JSON.parse(decoded);

          const compTopic = params.topic.replace('-invocations', '-completions');
          const compSub = compTopic.replace('/topics/', '/subscriptions/') + '-sub';

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

          if (!subscriptions[compSub]) subscriptions[compSub] = [];
          subscriptions[compSub].push({
            ackId: `ack-${generateId()}`,
            data: Buffer.from(JSON.stringify(completion)).toString('base64'),
            attributes: { concept: invocation.concept },
          });
        }

        return { messageId: generateId() };
      },

      async pull(params: any) {
        const sub = params.subscription;
        const msgs = subscriptions[sub] || [];
        const batch = msgs.splice(0, params.maxMessages || 1);
        return {
          receivedMessages: batch.map(m => ({
            ackId: m.ackId,
            message: {
              messageId: generateId(),
              data: m.data,
              attributes: m.attributes,
              publishTime: new Date().toISOString(),
            },
          })),
        };
      },

      async acknowledge(params: any) {
        acknowledged.push(params);
      },
    },
  };
}

// ============================================================
// Pub/Sub Transport Tests
// ============================================================

describe('Pub/Sub Transport — Invoke', () => {
  it('sends invocation and receives matching completion', async () => {
    const mock = createMockPubSubClient();
    const transport = createPubSubTransport(mock.client, {
      projectId: 'test-project',
      topicPrefix: 'test-',
      ackDeadlineSeconds: 30,
    }, 'MyConcept');

    const invocation: ActionInvocation = {
      id: generateId(),
      concept: 'MyConcept',
      action: 'doStuff',
      input: { key: 'value' },
      flow: 'flow-1',
      timestamp: timestamp(),
    };

    const completion = await transport.invoke(invocation);

    expect(completion.id).toBe(invocation.id);
    expect(completion.variant).toBe('ok');
    expect(completion.concept).toBe('MyConcept');
    expect(mock.published).toHaveLength(1);
    expect(mock.acknowledged).toHaveLength(1);
  });

  it('sends invocation with ordering key when enabled', async () => {
    const mock = createMockPubSubClient();
    const transport = createPubSubTransport(mock.client, {
      projectId: 'test-project',
      topicPrefix: 'test-',
      ackDeadlineSeconds: 30,
      enableOrdering: true,
    }, 'MyConcept');

    const invocation: ActionInvocation = {
      id: generateId(),
      concept: 'MyConcept',
      action: 'doStuff',
      input: {},
      flow: 'ordered-flow',
      timestamp: timestamp(),
    };

    await transport.invoke(invocation);

    expect(mock.published[0].orderingKey).toBe('ordered-flow');
  });

  it('returns error completion on timeout', async () => {
    // Create a client that never has completion messages
    const emptyClient = {
      async publish() { return { messageId: 'x' }; },
      async pull() { return { receivedMessages: [] }; },
      async acknowledge() {},
    };

    const transport = createPubSubTransport(emptyClient, {
      projectId: 'test-project',
      topicPrefix: 'test-',
      ackDeadlineSeconds: 0, // immediate timeout
    }, 'SlowConcept');

    const invocation: ActionInvocation = {
      id: generateId(),
      concept: 'SlowConcept',
      action: 'slow',
      input: {},
      flow: 'flow-timeout',
      timestamp: timestamp(),
    };

    const completion = await transport.invoke(invocation);
    expect(completion.variant).toBe('error');
    expect(completion.output.message).toContain('timeout');
  });

  it('query returns empty array (not supported over Pub/Sub)', async () => {
    const mock = createMockPubSubClient();
    const transport = createPubSubTransport(mock.client, {
      projectId: 'test-project',
      topicPrefix: 'test-',
      ackDeadlineSeconds: 30,
    }, 'MyConcept');

    const results = await transport.query({ relation: 'items' });
    expect(results).toEqual([]);
  });

  it('health check succeeds', async () => {
    const mock = createMockPubSubClient();
    const transport = createPubSubTransport(mock.client, {
      projectId: 'test-project',
      topicPrefix: 'test-',
      ackDeadlineSeconds: 30,
    }, 'MyConcept');

    const health = await transport.health();
    expect(health.available).toBe(true);
    expect(health.latency).toBeGreaterThanOrEqual(0);
  });

  it('health check returns unavailable on error', async () => {
    const failClient = {
      async publish() { return { messageId: 'x' }; },
      async pull() { throw new Error('Connection refused'); },
      async acknowledge() {},
    };

    const transport = createPubSubTransport(failClient, {
      projectId: 'test-project',
      topicPrefix: 'test-',
      ackDeadlineSeconds: 30,
    }, 'MyConcept');

    const health = await transport.health();
    expect(health.available).toBe(false);
  });
});

describe('Pub/Sub Completion Publisher', () => {
  it('publishes completion with ordering key when enabled', async () => {
    const mock = createMockPubSubClient();
    const publisher = createPubSubCompletionPublisher(mock.client, {
      projectId: 'test-project',
      topicPrefix: 'test-',
      ackDeadlineSeconds: 30,
      enableOrdering: true,
    }, 'MyConcept');

    const completion: ActionCompletion = {
      id: generateId(),
      concept: 'MyConcept',
      action: 'doStuff',
      input: {},
      variant: 'ok',
      output: {},
      flow: 'ordered-flow',
      timestamp: timestamp(),
    };

    await publisher.publish(completion);

    expect(mock.published).toHaveLength(1);
    expect(mock.published[0].orderingKey).toBe('ordered-flow');
    expect(mock.published[0].topic).toContain('MyConcept-completions');
  });
});

// ============================================================
// SQS Transport Tests
// ============================================================

describe('SQS Transport — FIFO Mode', () => {
  it('sends invocation with FIFO parameters', async () => {
    const mock = createMockSQSClient();
    const transport = createSQSTransport(mock.client, {
      region: 'us-east-1',
      queuePrefix: 'app-',
      visibilityTimeout: 30,
      fifo: true,
    }, 'OrderConcept');

    const invocation: ActionInvocation = {
      id: 'inv-fifo-1',
      concept: 'OrderConcept',
      action: 'place',
      input: { item: 'widget' },
      flow: 'order-flow-1',
      timestamp: timestamp(),
    };

    const completion = await transport.invoke(invocation);

    expect(completion.variant).toBe('ok');
    expect(mock.sent[0].MessageGroupId).toBe('order-flow-1');
    expect(mock.sent[0].MessageDeduplicationId).toBe('inv-fifo-1');
    expect(mock.sent[0].QueueUrl).toContain('.fifo');
  });
});

describe('SQS Transport — Query & Health', () => {
  it('query returns empty array (not supported over SQS)', async () => {
    const mock = createMockSQSClient();
    const transport = createSQSTransport(mock.client, {
      region: 'us-east-1',
      queuePrefix: 'app-',
      visibilityTimeout: 30,
    }, 'TestConcept');

    const results = await transport.query({ relation: 'items' });
    expect(results).toEqual([]);
  });

  it('health check succeeds', async () => {
    const mock = createMockSQSClient();
    const transport = createSQSTransport(mock.client, {
      region: 'us-east-1',
      queuePrefix: 'app-',
      visibilityTimeout: 30,
    }, 'TestConcept');

    const health = await transport.health();
    expect(health.available).toBe(true);
    expect(health.latency).toBeGreaterThanOrEqual(0);
  });

  it('health check returns unavailable on error', async () => {
    const failClient = {
      async sendMessage() { return { MessageId: 'x' }; },
      async receiveMessage() { throw new Error('Queue not found'); },
      async deleteMessage() {},
    };

    const transport = createSQSTransport(failClient, {
      region: 'us-east-1',
      queuePrefix: 'app-',
      visibilityTimeout: 30,
    }, 'TestConcept');

    const health = await transport.health();
    expect(health.available).toBe(false);
  });

  it('returns error completion on timeout', async () => {
    const emptyClient = {
      async sendMessage() { return { MessageId: 'x' }; },
      async receiveMessage() { return {}; },
      async deleteMessage() {},
    };

    const transport = createSQSTransport(emptyClient, {
      region: 'us-east-1',
      queuePrefix: 'app-',
      visibilityTimeout: 0, // immediate timeout
    }, 'SlowConcept');

    const invocation: ActionInvocation = {
      id: generateId(),
      concept: 'SlowConcept',
      action: 'slow',
      input: {},
      flow: 'flow-timeout',
      timestamp: timestamp(),
    };

    const completion = await transport.invoke(invocation);
    expect(completion.variant).toBe('error');
    expect(completion.output.message).toContain('timeout');
  });
});

describe('SQS Completion Publisher — FIFO Mode', () => {
  it('publishes completion with FIFO parameters', async () => {
    const mock = createMockSQSClient();
    const publisher = createSQSCompletionPublisher(mock.client, {
      region: 'us-east-1',
      queuePrefix: 'app-',
      visibilityTimeout: 30,
      fifo: true,
    }, 'OrderConcept');

    const completion: ActionCompletion = {
      id: 'comp-fifo-1',
      concept: 'OrderConcept',
      action: 'place',
      input: {},
      variant: 'ok',
      output: {},
      flow: 'order-flow-1',
      timestamp: timestamp(),
    };

    await publisher.publish(completion);

    expect(mock.sent).toHaveLength(1);
    expect(mock.sent[0].MessageGroupId).toBe('order-flow-1');
    expect(mock.sent[0].MessageDeduplicationId).toBe('comp-fifo-1');
    expect(mock.sent[0].QueueUrl).toContain('.fifo');
  });
});
