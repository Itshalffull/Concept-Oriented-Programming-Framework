// ConnectorCall — business.test.ts
// Business logic tests for idempotent connector invocation with success/failure tracking.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { connectorCallHandler } from './handler.js';
import type { ConnectorCallStorage } from './types.js';

const createTestStorage = (): ConnectorCallStorage => {
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

describe('ConnectorCall business logic', () => {
  it('invoke then mark_success records response and transitions to succeeded', async () => {
    const storage = createTestStorage();

    await connectorCallHandler.invoke({
      run_ref: 'run-1',
      step_ref: 'send-email',
      connector_id: 'sendgrid',
      idempotency_key: 'email-001',
      request_payload: { to: 'user@example.com', subject: 'Hello' },
      timeout_ms: 5000,
    }, storage)();

    const result = await connectorCallHandler.mark_success({
      run_ref: 'run-1',
      step_ref: 'send-email',
      response_payload: { message_id: 'msg-abc', status: 'delivered' },
      response_code: 200,
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.status).toBe('succeeded');
      expect(result.right.response_code).toBe(200);
    }

    const getResult = await connectorCallHandler.get_result({
      run_ref: 'run-1',
      step_ref: 'send-email',
    }, storage)();

    if (E.isRight(getResult) && getResult.right.variant === 'ok') {
      expect(getResult.right.status).toBe('succeeded');
      expect(getResult.right.response_payload).toEqual({ message_id: 'msg-abc', status: 'delivered' });
    }
  });

  it('invoke then mark_failure records error details', async () => {
    const storage = createTestStorage();

    await connectorCallHandler.invoke({
      run_ref: 'run-2',
      step_ref: 'charge',
      connector_id: 'stripe',
      idempotency_key: 'charge-001',
      request_payload: { amount: 9999 },
    }, storage)();

    const result = await connectorCallHandler.mark_failure({
      run_ref: 'run-2',
      step_ref: 'charge',
      error_code: 'INSUFFICIENT_FUNDS',
      error_message: 'Card declined due to insufficient funds',
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.status).toBe('failed');
      expect(result.right.error_code).toBe('INSUFFICIENT_FUNDS');
    }

    const getResult = await connectorCallHandler.get_result({
      run_ref: 'run-2',
      step_ref: 'charge',
    }, storage)();

    if (E.isRight(getResult) && getResult.right.variant === 'ok') {
      expect(getResult.right.error_code).toBe('INSUFFICIENT_FUNDS');
      expect(getResult.right.error_message).toBe('Card declined due to insufficient funds');
    }
  });

  it('duplicate idempotency key returns duplicate variant', async () => {
    const storage = createTestStorage();

    await connectorCallHandler.invoke({
      run_ref: 'run-3',
      step_ref: 'webhook',
      connector_id: 'slack',
      idempotency_key: 'notify-unique-123',
      request_payload: { message: 'hello' },
    }, storage)();

    const result = await connectorCallHandler.invoke({
      run_ref: 'run-3',
      step_ref: 'webhook-retry',
      connector_id: 'slack',
      idempotency_key: 'notify-unique-123',
      request_payload: { message: 'hello again' },
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('duplicate');
    }
  });

  it('mark_success rejects non-invoking status', async () => {
    const storage = createTestStorage();

    await connectorCallHandler.invoke({
      run_ref: 'run-4',
      step_ref: 'api-call',
      connector_id: 'rest-api',
      idempotency_key: 'api-001',
      request_payload: {},
    }, storage)();

    await connectorCallHandler.mark_success({
      run_ref: 'run-4',
      step_ref: 'api-call',
      response_payload: { ok: true },
      response_code: 200,
    }, storage)();

    // Try to mark success again on succeeded call
    const result = await connectorCallHandler.mark_success({
      run_ref: 'run-4',
      step_ref: 'api-call',
      response_payload: { ok: true },
      response_code: 200,
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('mark_failure rejects non-invoking status', async () => {
    const storage = createTestStorage();

    await connectorCallHandler.invoke({
      run_ref: 'run-5',
      step_ref: 'call',
      connector_id: 'svc',
      idempotency_key: 'call-005',
      request_payload: {},
    }, storage)();

    await connectorCallHandler.mark_failure({
      run_ref: 'run-5',
      step_ref: 'call',
      error_code: 'TIMEOUT',
      error_message: 'Connection timed out',
    }, storage)();

    // Try to mark failure again on already-failed call
    const result = await connectorCallHandler.mark_failure({
      run_ref: 'run-5',
      step_ref: 'call',
      error_code: 'RETRY',
      error_message: 'Retry attempt',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('get_result returns not_found for non-existent call', async () => {
    const storage = createTestStorage();

    const result = await connectorCallHandler.get_result({
      run_ref: 'no-run',
      step_ref: 'no-step',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('mark_success not_found for non-existent call', async () => {
    const storage = createTestStorage();

    const result = await connectorCallHandler.mark_success({
      run_ref: 'ghost',
      step_ref: 'ghost',
      response_payload: {},
      response_code: 200,
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('cannot mark_success after mark_failure', async () => {
    const storage = createTestStorage();

    await connectorCallHandler.invoke({
      run_ref: 'run-7',
      step_ref: 'op',
      connector_id: 'svc',
      idempotency_key: 'op-007',
      request_payload: {},
    }, storage)();

    await connectorCallHandler.mark_failure({
      run_ref: 'run-7',
      step_ref: 'op',
      error_code: 'ERR',
      error_message: 'Failed',
    }, storage)();

    const result = await connectorCallHandler.mark_success({
      run_ref: 'run-7',
      step_ref: 'op',
      response_payload: { recovered: true },
      response_code: 200,
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('different step_refs use independent call records', async () => {
    const storage = createTestStorage();

    await connectorCallHandler.invoke({
      run_ref: 'run-8',
      step_ref: 'step-a',
      connector_id: 'svc-a',
      idempotency_key: 'key-a',
      request_payload: { a: true },
    }, storage)();

    await connectorCallHandler.invoke({
      run_ref: 'run-8',
      step_ref: 'step-b',
      connector_id: 'svc-b',
      idempotency_key: 'key-b',
      request_payload: { b: true },
    }, storage)();

    await connectorCallHandler.mark_success({
      run_ref: 'run-8',
      step_ref: 'step-a',
      response_payload: { result: 'a-ok' },
      response_code: 200,
    }, storage)();

    const getA = await connectorCallHandler.get_result({ run_ref: 'run-8', step_ref: 'step-a' }, storage)();
    const getB = await connectorCallHandler.get_result({ run_ref: 'run-8', step_ref: 'step-b' }, storage)();

    if (E.isRight(getA) && getA.right.variant === 'ok') expect(getA.right.status).toBe('succeeded');
    if (E.isRight(getB) && getB.right.variant === 'ok') expect(getB.right.status).toBe('invoking');
  });
});
