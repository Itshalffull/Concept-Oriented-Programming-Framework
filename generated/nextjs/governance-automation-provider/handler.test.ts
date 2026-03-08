// GovernanceAutomationProvider — handler.test.ts
// Unit tests for governance automation provider register and execute actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { governanceAutomationProviderHandler } from './handler.js';
import type { GovernanceAutomationProviderStorage } from './types.js';

const createTestStorage = (): GovernanceAutomationProviderStorage => {
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

const createFailingStorage = (): GovernanceAutomationProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('GovernanceAutomationProvider handler', () => {
  describe('register', () => {
    it('registers the governance provider with ok variant', async () => {
      const storage = createTestStorage();
      const result = await governanceAutomationProviderHandler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).provider_name).toBe('governance');
      }
    });

    it('returns already_registered on duplicate registration', async () => {
      const storage = createTestStorage();
      await governanceAutomationProviderHandler.register({}, storage)();
      const result = await governanceAutomationProviderHandler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('already_registered');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await governanceAutomationProviderHandler.register({}, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('execute', () => {
    it('executes with timelock gate returning ok', async () => {
      const storage = createTestStorage();
      const result = await governanceAutomationProviderHandler.execute(
        {
          action_payload: '{"action":"transfer"}',
          gate_config: '{"gate":"timelock","delay":3600}',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).result).toBeDefined();
      }
    });

    it('returns blocked when guard condition is deny', async () => {
      const storage = createTestStorage();
      const result = await governanceAutomationProviderHandler.execute(
        {
          action_payload: '{"action":"transfer"}',
          gate_config: '{"gate":"guard","condition":"deny"}',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('blocked');
      }
    });

    it('returns blocked when quorum is not met', async () => {
      const storage = createTestStorage();
      const result = await governanceAutomationProviderHandler.execute(
        {
          action_payload: '{"action":"upgrade"}',
          gate_config: '{"gate":"quorum","required":3,"current":1}',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('blocked');
      }
    });

    it('returns blocked when action_payload is empty', async () => {
      const storage = createTestStorage();
      const result = await governanceAutomationProviderHandler.execute(
        { action_payload: '', gate_config: '{"gate":"timelock"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('blocked');
      }
    });

    it('returns blocked when gate_config is empty', async () => {
      const storage = createTestStorage();
      const result = await governanceAutomationProviderHandler.execute(
        { action_payload: '{"action":"test"}', gate_config: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('blocked');
      }
    });
  });

  describe('multi-step sequence: register -> execute approved', () => {
    it('registers then executes with quorum met', async () => {
      const storage = createTestStorage();

      const regResult = await governanceAutomationProviderHandler.register({}, storage)();
      expect(E.isRight(regResult)).toBe(true);

      const execResult = await governanceAutomationProviderHandler.execute(
        {
          action_payload: '{"action":"deploy"}',
          gate_config: '{"gate":"quorum","required":2,"current":3}',
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
      const result = await governanceAutomationProviderHandler.execute(
        {
          action_payload: '{"action":"test"}',
          gate_config: '{"gate":"timelock"}',
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
