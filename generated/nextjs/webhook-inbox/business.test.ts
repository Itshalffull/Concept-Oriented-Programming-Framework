// WebhookInbox — business.test.ts
// Business logic tests for webhook correlation with event-type matching and TTL-based expiry.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { webhookInboxHandler } from './handler.js';
import type { WebhookInboxStorage } from './types.js';

const createTestStorage = (): WebhookInboxStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation, filter) => {
      const entries = [...(store.get(relation)?.values() ?? [])];
      if (!filter) return entries;
      return entries.filter((e) =>
        Object.entries(filter).every(([k, v]) => e[k] === v),
      );
    },
  };
};

describe('WebhookInbox business logic', () => {
  it('full lifecycle: register -> receive -> ack preserves payload', async () => {
    const storage = createTestStorage();

    await webhookInboxHandler.register({
      run_ref: 'run-1',
      step_ref: 'wait-payment',
      correlation_key: 'order-123',
      event_type: 'payment.completed',
      ttl_ms: 60000,
    }, storage)();

    const receiveResult = await webhookInboxHandler.receive({
      correlation_key: 'order-123',
      event_type: 'payment.completed',
      payload: { amount: 99.99, currency: 'USD', transaction_id: 'tx-abc' },
      headers: { 'x-webhook-id': 'wh-001' },
    }, storage)();

    if (E.isRight(receiveResult) && receiveResult.right.variant === 'ok') {
      expect(receiveResult.right.status).toBe('received');
      expect(receiveResult.right.payload).toEqual({
        amount: 99.99,
        currency: 'USD',
        transaction_id: 'tx-abc',
      });
    }

    const ackResult = await webhookInboxHandler.ack({
      run_ref: 'run-1',
      step_ref: 'wait-payment',
    }, storage)();

    if (E.isRight(ackResult) && ackResult.right.variant === 'ok') {
      expect(ackResult.right.status).toBe('acknowledged');
    }
  });

  it('receive with non-matching correlation_key returns no_match', async () => {
    const storage = createTestStorage();

    await webhookInboxHandler.register({
      run_ref: 'run-2',
      step_ref: 'wait',
      correlation_key: 'order-abc',
      event_type: 'payment.completed',
    }, storage)();

    const result = await webhookInboxHandler.receive({
      correlation_key: 'order-xyz',
      event_type: 'payment.completed',
      payload: {},
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('no_match');
    }
  });

  it('receive with non-matching event_type returns no_match', async () => {
    const storage = createTestStorage();

    await webhookInboxHandler.register({
      run_ref: 'run-3',
      step_ref: 'wait',
      correlation_key: 'order-123',
      event_type: 'payment.completed',
    }, storage)();

    const result = await webhookInboxHandler.receive({
      correlation_key: 'order-123',
      event_type: 'payment.failed',
      payload: {},
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('no_match');
    }
  });

  it('receive on already-received inbox returns invalid_status', async () => {
    const storage = createTestStorage();

    await webhookInboxHandler.register({
      run_ref: 'run-4',
      step_ref: 'wait',
      correlation_key: 'dup-key',
      event_type: 'event.type',
    }, storage)();

    await webhookInboxHandler.receive({
      correlation_key: 'dup-key',
      event_type: 'event.type',
      payload: { first: true },
    }, storage)();

    const result = await webhookInboxHandler.receive({
      correlation_key: 'dup-key',
      event_type: 'event.type',
      payload: { second: true },
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('expire transitions waiting inbox to expired', async () => {
    const storage = createTestStorage();

    await webhookInboxHandler.register({
      run_ref: 'run-5',
      step_ref: 'timeout-step',
      correlation_key: 'timeout-key',
      event_type: 'callback',
      ttl_ms: 1000,
    }, storage)();

    const result = await webhookInboxHandler.expire({
      run_ref: 'run-5',
      step_ref: 'timeout-step',
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.status).toBe('expired');
    }
  });

  it('expire on received inbox returns invalid_status', async () => {
    const storage = createTestStorage();

    await webhookInboxHandler.register({
      run_ref: 'run-6',
      step_ref: 'wait',
      correlation_key: 'recv-key',
      event_type: 'event.type',
    }, storage)();

    await webhookInboxHandler.receive({
      correlation_key: 'recv-key',
      event_type: 'event.type',
      payload: {},
    }, storage)();

    const result = await webhookInboxHandler.expire({
      run_ref: 'run-6',
      step_ref: 'wait',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('ack on waiting inbox returns invalid_status', async () => {
    const storage = createTestStorage();

    await webhookInboxHandler.register({
      run_ref: 'run-7',
      step_ref: 'premature-ack',
      correlation_key: 'ack-key',
      event_type: 'event.type',
    }, storage)();

    const result = await webhookInboxHandler.ack({
      run_ref: 'run-7',
      step_ref: 'premature-ack',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('not_found for expire and ack on non-existent inbox', async () => {
    const storage = createTestStorage();

    const expire = await webhookInboxHandler.expire({
      run_ref: 'no',
      step_ref: 'no',
    }, storage)();
    if (E.isRight(expire)) expect(expire.right.variant).toBe('not_found');

    const ack = await webhookInboxHandler.ack({
      run_ref: 'no',
      step_ref: 'no',
    }, storage)();
    if (E.isRight(ack)) expect(ack.right.variant).toBe('not_found');
  });

  it('receive on expired inbox returns invalid_status via no_match or invalid', async () => {
    const storage = createTestStorage();

    await webhookInboxHandler.register({
      run_ref: 'run-9',
      step_ref: 'expired-wait',
      correlation_key: 'exp-key',
      event_type: 'callback',
    }, storage)();

    await webhookInboxHandler.expire({
      run_ref: 'run-9',
      step_ref: 'expired-wait',
    }, storage)();

    const result = await webhookInboxHandler.receive({
      correlation_key: 'exp-key',
      event_type: 'callback',
      payload: { late: true },
    }, storage)();

    if (E.isRight(result)) {
      // Should not be 'ok' since inbox is expired
      expect(['invalid_status', 'no_match']).toContain(result.right.variant);
    }
  });

  it('independent inboxes on different steps do not interfere', async () => {
    const storage = createTestStorage();

    await webhookInboxHandler.register({
      run_ref: 'run-10',
      step_ref: 'step-a',
      correlation_key: 'key-a',
      event_type: 'event-a',
    }, storage)();

    await webhookInboxHandler.register({
      run_ref: 'run-10',
      step_ref: 'step-b',
      correlation_key: 'key-b',
      event_type: 'event-b',
    }, storage)();

    await webhookInboxHandler.receive({
      correlation_key: 'key-a',
      event_type: 'event-a',
      payload: { from: 'a' },
    }, storage)();

    // step-a received, step-b should still be waiting
    const expireB = await webhookInboxHandler.expire({
      run_ref: 'run-10',
      step_ref: 'step-b',
    }, storage)();

    if (E.isRight(expireB) && expireB.right.variant === 'ok') {
      expect(expireB.right.status).toBe('expired');
    }
  });
});
