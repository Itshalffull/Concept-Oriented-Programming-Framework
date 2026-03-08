// ProcessAutomationProvider — handler.test.ts
// Unit tests for process automation provider register and execute actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { processAutomationProviderHandler } from './handler.js';
import type { ProcessAutomationProviderStorage } from './types.js';

const createTestStorage = (): ProcessAutomationProviderStorage => {
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

const createFailingStorage = (): ProcessAutomationProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ProcessAutomationProvider handler', () => {
  describe('register', () => {
    it('registers the process provider with ok variant', async () => {
      const storage = createTestStorage();
      const result = await processAutomationProviderHandler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).provider_name).toBe('process');
      }
    });

    it('returns already_registered on duplicate registration', async () => {
      const storage = createTestStorage();
      await processAutomationProviderHandler.register({}, storage)();
      const result = await processAutomationProviderHandler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('already_registered');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await processAutomationProviderHandler.register({}, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('execute', () => {
    it('executes with valid payload and spec returning ok with run_id', async () => {
      const storage = createTestStorage();
      const result = await processAutomationProviderHandler.execute(
        {
          action_payload: '{"step":"approve"}',
          process_spec_id: 'spec-onboarding',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).run_id).toBeDefined();
      }
    });

    it('returns error when action_payload is empty', async () => {
      const storage = createTestStorage();
      const result = await processAutomationProviderHandler.execute(
        { action_payload: '', process_spec_id: 'spec-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns error when process_spec_id is empty', async () => {
      const storage = createTestStorage();
      const result = await processAutomationProviderHandler.execute(
        { action_payload: '{"step":"start"}', process_spec_id: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns error for invalid action_payload JSON', async () => {
      const storage = createTestStorage();
      const result = await processAutomationProviderHandler.execute(
        { action_payload: 'not-json', process_spec_id: 'spec-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });
  });

  describe('multi-step sequence: register -> execute', () => {
    it('registers then executes process successfully', async () => {
      const storage = createTestStorage();

      const regResult = await processAutomationProviderHandler.register({}, storage)();
      expect(E.isRight(regResult)).toBe(true);

      const execResult = await processAutomationProviderHandler.execute(
        {
          action_payload: '{"step":"init"}',
          process_spec_id: 'spec-deploy',
        },
        storage,
      )();
      expect(E.isRight(execResult)).toBe(true);
      if (E.isRight(execResult)) {
        expect(execResult.right.variant).toBe('ok');
      }
    });
  });

  describe('storage failure', () => {
    it('propagates storage errors on execute', async () => {
      const storage = createFailingStorage();
      const result = await processAutomationProviderHandler.execute(
        {
          action_payload: '{"step":"test"}',
          process_spec_id: 'spec-1',
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
