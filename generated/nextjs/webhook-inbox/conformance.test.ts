// WebhookInbox — conformance.test.ts
// Conformance tests for webhook correlation with event-type matching and TTL-based expiry.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { webhookInboxHandler } from './handler.js';
import type { WebhookInboxStorage } from './types.js';

// In-memory storage for conformance tests
const createTestStorage = (): WebhookInboxStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
};

describe('WebhookInbox conformance', () => {
  it('register creates a waiting inbox', async () => {
    const storage = createTestStorage();
    const result = await webhookInboxHandler.register({
      run_ref: 'run-1',
      step_ref: 'wait-payment',
      correlation_key: 'order-123',
      event_type: 'payment.completed',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      expect(result.right.status).toBe('waiting');
      expect(result.right.correlation_key).toBe('order-123');
    }
  });

  it('receive matches by correlation_key + event_type and delivers payload', async () => {
    const storage = createTestStorage();
    await webhookInboxHandler.register({
      run_ref: 'run-1',
      step_ref: 'wait-payment',
      correlation_key: 'order-456',
      event_type: 'payment.completed',
    }, storage)();

    const result = await webhookInboxHandler.receive({
      correlation_key: 'order-456',
      event_type: 'payment.completed',
      payload: { amount: 99.99, transaction_id: 'txn-abc' },
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('received');
        expect(result.right.payload).toEqual({ amount: 99.99, transaction_id: 'txn-abc' });
      }
    }
  });

  it('receive returns no_match when no inbox registered', async () => {
    const storage = createTestStorage();
    const result = await webhookInboxHandler.receive({
      correlation_key: 'no-such-order',
      event_type: 'payment.completed',
      payload: {},
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('no_match');
    }
  });

  it('receive rejects when inbox is not in waiting status', async () => {
    const storage = createTestStorage();
    await webhookInboxHandler.register({
      run_ref: 'run-1',
      step_ref: 'wait-cb',
      correlation_key: 'cb-001',
      event_type: 'callback',
    }, storage)();

    // First receive succeeds
    await webhookInboxHandler.receive({
      correlation_key: 'cb-001',
      event_type: 'callback',
      payload: { first: true },
    }, storage)();

    // Second receive should fail (already received)
    const result = await webhookInboxHandler.receive({
      correlation_key: 'cb-001',
      event_type: 'callback',
      payload: { second: true },
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('expire transitions waiting -> expired', async () => {
    const storage = createTestStorage();
    await webhookInboxHandler.register({
      run_ref: 'run-1',
      step_ref: 'wait-timeout',
      correlation_key: 'ord-789',
      event_type: 'confirmation',
      ttl_ms: 5000,
    }, storage)();

    const result = await webhookInboxHandler.expire({
      run_ref: 'run-1',
      step_ref: 'wait-timeout',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('expired');
      }
    }
  });

  it('expire rejects when inbox is not in waiting status', async () => {
    const storage = createTestStorage();
    await webhookInboxHandler.register({
      run_ref: 'run-1',
      step_ref: 'wait-done',
      correlation_key: 'done-001',
      event_type: 'done',
    }, storage)();
    await webhookInboxHandler.receive({
      correlation_key: 'done-001',
      event_type: 'done',
      payload: {},
    }, storage)();

    const result = await webhookInboxHandler.expire({
      run_ref: 'run-1',
      step_ref: 'wait-done',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('ack transitions received -> acknowledged', async () => {
    const storage = createTestStorage();
    await webhookInboxHandler.register({
      run_ref: 'run-1',
      step_ref: 'wait-ack',
      correlation_key: 'ack-001',
      event_type: 'event',
    }, storage)();
    await webhookInboxHandler.receive({
      correlation_key: 'ack-001',
      event_type: 'event',
      payload: { data: 'test' },
    }, storage)();

    const result = await webhookInboxHandler.ack({
      run_ref: 'run-1',
      step_ref: 'wait-ack',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('acknowledged');
      }
    }
  });

  it('full lifecycle: register -> receive -> ack', async () => {
    const storage = createTestStorage();

    const r1 = await webhookInboxHandler.register({
      run_ref: 'run-2',
      step_ref: 'hook',
      correlation_key: 'deploy-abc',
      event_type: 'deploy.complete',
    }, storage)();
    expect(E.isRight(r1)).toBe(true);

    const r2 = await webhookInboxHandler.receive({
      correlation_key: 'deploy-abc',
      event_type: 'deploy.complete',
      payload: { environment: 'production', success: true },
      headers: { 'x-webhook-id': 'wh-123' },
    }, storage)();
    expect(E.isRight(r2)).toBe(true);
    if (E.isRight(r2)) expect(r2.right.variant).toBe('ok');

    const r3 = await webhookInboxHandler.ack({
      run_ref: 'run-2',
      step_ref: 'hook',
    }, storage)();
    expect(E.isRight(r3)).toBe(true);
    if (E.isRight(r3)) {
      expect(r3.right.variant).toBe('ok');
      if (r3.right.variant === 'ok') {
        expect(r3.right.status).toBe('acknowledged');
      }
    }
  });
});
