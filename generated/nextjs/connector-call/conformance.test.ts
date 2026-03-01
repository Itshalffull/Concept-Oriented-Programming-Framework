// ConnectorCall — conformance.test.ts
// Conformance tests for idempotent connector invocation with success/failure tracking.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { connectorCallHandler } from './handler.js';
import type { ConnectorCallStorage } from './types.js';

// In-memory storage for conformance tests
const createTestStorage = (): ConnectorCallStorage => {
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

describe('ConnectorCall conformance', () => {
  it('invoke creates a call in invoking status', async () => {
    const storage = createTestStorage();
    const result = await connectorCallHandler.invoke({
      run_ref: 'run-1',
      step_ref: 'api-call',
      connector_id: 'stripe-connector',
      idempotency_key: 'idem-001',
      request_payload: { amount: 1000, currency: 'USD' },
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('invoking');
        expect(result.right.idempotency_key).toBe('idem-001');
      }
    }
  });

  it('invoke detects duplicate idempotency key', async () => {
    const storage = createTestStorage();
    await connectorCallHandler.invoke({
      run_ref: 'run-1',
      step_ref: 'api-call',
      connector_id: 'stripe-connector',
      idempotency_key: 'idem-dup',
      request_payload: { amount: 500 },
    }, storage)();

    const result = await connectorCallHandler.invoke({
      run_ref: 'run-2',
      step_ref: 'api-call-2',
      connector_id: 'stripe-connector',
      idempotency_key: 'idem-dup',
      request_payload: { amount: 700 },
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('duplicate');
    }
  });

  it('mark_success transitions invoking -> succeeded', async () => {
    const storage = createTestStorage();
    await connectorCallHandler.invoke({
      run_ref: 'run-1',
      step_ref: 'call-1',
      connector_id: 'http-connector',
      idempotency_key: 'idem-s1',
      request_payload: { url: 'https://api.example.com' },
    }, storage)();

    const result = await connectorCallHandler.mark_success({
      run_ref: 'run-1',
      step_ref: 'call-1',
      response_payload: { data: 'ok', id: 42 },
      response_code: 200,
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('succeeded');
        expect(result.right.response_code).toBe(200);
      }
    }
  });

  it('mark_failure transitions invoking -> failed', async () => {
    const storage = createTestStorage();
    await connectorCallHandler.invoke({
      run_ref: 'run-1',
      step_ref: 'call-2',
      connector_id: 'http-connector',
      idempotency_key: 'idem-f1',
      request_payload: {},
    }, storage)();

    const result = await connectorCallHandler.mark_failure({
      run_ref: 'run-1',
      step_ref: 'call-2',
      error_code: 'TIMEOUT',
      error_message: 'Request timed out after 30000ms',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('failed');
        expect(result.right.error_code).toBe('TIMEOUT');
      }
    }
  });

  it('mark_success rejects when not in invoking status', async () => {
    const storage = createTestStorage();
    await connectorCallHandler.invoke({
      run_ref: 'run-1',
      step_ref: 'call-3',
      connector_id: 'connector',
      idempotency_key: 'idem-x1',
      request_payload: {},
    }, storage)();
    await connectorCallHandler.mark_failure({
      run_ref: 'run-1',
      step_ref: 'call-3',
      error_code: 'ERR',
      error_message: 'fail',
    }, storage)();

    const result = await connectorCallHandler.mark_success({
      run_ref: 'run-1',
      step_ref: 'call-3',
      response_payload: {},
      response_code: 200,
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('get_result returns current call state', async () => {
    const storage = createTestStorage();
    await connectorCallHandler.invoke({
      run_ref: 'run-1',
      step_ref: 'call-4',
      connector_id: 'connector',
      idempotency_key: 'idem-g1',
      request_payload: { query: 'test' },
    }, storage)();
    await connectorCallHandler.mark_success({
      run_ref: 'run-1',
      step_ref: 'call-4',
      response_payload: { results: [1, 2, 3] },
      response_code: 200,
    }, storage)();

    const result = await connectorCallHandler.get_result({
      run_ref: 'run-1',
      step_ref: 'call-4',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('succeeded');
        expect(result.right.response_payload).toEqual({ results: [1, 2, 3] });
        expect(result.right.error_code).toBeNull();
      }
    }
  });

  it('get_result returns not_found for missing call', async () => {
    const storage = createTestStorage();
    const result = await connectorCallHandler.get_result({
      run_ref: 'run-999',
      step_ref: 'missing',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });
});
