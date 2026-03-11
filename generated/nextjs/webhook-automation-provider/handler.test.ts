// WebhookAutomationProvider — handler.test.ts
// Unit tests for webhook automation provider register and execute actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { webhookAutomationProviderHandler } from './handler.js';
import type { WebhookAutomationProviderStorage } from './types.js';

const createTestStorage = (): WebhookAutomationProviderStorage => {
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

const createFailingStorage = (): WebhookAutomationProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('WebhookAutomationProvider handler', () => {
  describe('register', () => {
    it('registers the webhook provider with ok variant', async () => {
      const storage = createTestStorage();
      const result = await webhookAutomationProviderHandler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).provider_name).toBe('webhook');
      }
    });

    it('returns already_registered on duplicate registration', async () => {
      const storage = createTestStorage();
      await webhookAutomationProviderHandler.register({}, storage)();
      const result = await webhookAutomationProviderHandler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('already_registered');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await webhookAutomationProviderHandler.register({}, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('execute', () => {
    it('executes webhook with valid inputs returning ok', async () => {
      const storage = createTestStorage();
      const result = await webhookAutomationProviderHandler.execute(
        {
          action_payload: '{"event":"deploy"}',
          webhook_url: 'https://example.com/hooks/deploy',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).response).toBeDefined();
      }
    });

    it('returns error when action_payload is empty', async () => {
      const storage = createTestStorage();
      const result = await webhookAutomationProviderHandler.execute(
        { action_payload: '', webhook_url: 'https://example.com/hook' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns error when webhook_url is empty', async () => {
      const storage = createTestStorage();
      const result = await webhookAutomationProviderHandler.execute(
        { action_payload: '{"event":"test"}', webhook_url: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns error for invalid URL', async () => {
      const storage = createTestStorage();
      const result = await webhookAutomationProviderHandler.execute(
        { action_payload: '{"event":"test"}', webhook_url: 'not-a-url' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns error for invalid HTTP method', async () => {
      const storage = createTestStorage();
      const result = await webhookAutomationProviderHandler.execute(
        {
          action_payload: '{"event":"test"}',
          webhook_url: 'https://example.com/hook',
          method: 'INVALID',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });
  });

  describe('multi-step sequence: register -> execute', () => {
    it('registers then executes webhook successfully', async () => {
      const storage = createTestStorage();

      const regResult = await webhookAutomationProviderHandler.register({}, storage)();
      expect(E.isRight(regResult)).toBe(true);

      const execResult = await webhookAutomationProviderHandler.execute(
        {
          action_payload: '{"event":"notify"}',
          webhook_url: 'https://example.com/hooks/notify',
          method: 'POST',
        },
        storage,
      )();
      expect(E.isRight(execResult)).toBe(true);
      if (E.isRight(execResult)) {
        expect(execResult.right.variant).toBe('ok');
        const response = JSON.parse((execResult.right as any).response);
        expect(response.method).toBe('POST');
      }
    });
  });

  describe('storage failure', () => {
    it('propagates storage errors on execute', async () => {
      const storage = createFailingStorage();
      const result = await webhookAutomationProviderHandler.execute(
        {
          action_payload: '{"event":"test"}',
          webhook_url: 'https://example.com/hook',
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
