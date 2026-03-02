// AutomationRule — handler.test.ts
// Unit tests for automationRule handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { automationRuleHandler } from './handler.js';
import type { AutomationRuleStorage } from './types.js';

const createTestStorage = (): AutomationRuleStorage => {
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

const createFailingStorage = (): AutomationRuleStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('AutomationRule handler', () => {
  describe('define', () => {
    it('defines successfully with valid input', async () => {
      const storage = createTestStorage();
      const result = await automationRuleHandler.define(
        { rule: 'auto-deploy', trigger: 'push', conditions: 'branch=main', actions: 'deploy' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns exists when defining same rule twice', async () => {
      const storage = createTestStorage();
      await automationRuleHandler.define(
        { rule: 'auto-deploy', trigger: 'push', conditions: 'branch=main', actions: 'deploy' },
        storage,
      )();
      const result = await automationRuleHandler.define(
        { rule: 'auto-deploy', trigger: 'push', conditions: 'branch=main', actions: 'deploy' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await automationRuleHandler.define(
        { rule: 'test', trigger: 'push', conditions: '', actions: 'deploy' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('enable', () => {
    it('returns notfound for missing rule', async () => {
      const storage = createTestStorage();
      const result = await automationRuleHandler.enable(
        { rule: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('enables successfully after define', async () => {
      const storage = createTestStorage();
      await automationRuleHandler.define(
        { rule: 'auto-deploy', trigger: 'push', conditions: '', actions: 'deploy' },
        storage,
      )();
      const result = await automationRuleHandler.enable(
        { rule: 'auto-deploy' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await automationRuleHandler.enable(
        { rule: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('disable', () => {
    it('returns notfound for missing rule', async () => {
      const storage = createTestStorage();
      const result = await automationRuleHandler.disable(
        { rule: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('disables successfully after define and enable', async () => {
      const storage = createTestStorage();
      await automationRuleHandler.define(
        { rule: 'auto-deploy', trigger: 'push', conditions: '', actions: 'deploy' },
        storage,
      )();
      await automationRuleHandler.enable(
        { rule: 'auto-deploy' },
        storage,
      )();
      const result = await automationRuleHandler.disable(
        { rule: 'auto-deploy' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await automationRuleHandler.disable(
        { rule: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('execute', () => {
    it('returns notfound for missing rule', async () => {
      const storage = createTestStorage();
      const result = await automationRuleHandler.execute(
        { rule: 'nonexistent', context: '{"event":"push"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns notfound when rule is disabled', async () => {
      const storage = createTestStorage();
      await automationRuleHandler.define(
        { rule: 'auto-deploy', trigger: 'push', conditions: '', actions: 'deploy' },
        storage,
      )();
      // Rule is disabled by default after define
      const result = await automationRuleHandler.execute(
        { rule: 'auto-deploy', context: '{"event":"push"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('executes successfully when rule is enabled and trigger matches', async () => {
      const storage = createTestStorage();
      await automationRuleHandler.define(
        { rule: 'auto-deploy', trigger: 'push', conditions: '', actions: 'deploy' },
        storage,
      )();
      await automationRuleHandler.enable(
        { rule: 'auto-deploy' },
        storage,
      )();
      const result = await automationRuleHandler.execute(
        { rule: 'auto-deploy', context: '{"event":"push","branch":"main"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const parsed = JSON.parse(result.right.result);
          expect(parsed.matched).toBe(true);
          expect(parsed.rule).toBe('auto-deploy');
        }
      }
    });

    it('returns ok with matched=false when trigger does not match context', async () => {
      const storage = createTestStorage();
      await automationRuleHandler.define(
        { rule: 'auto-deploy', trigger: 'push', conditions: '', actions: 'deploy' },
        storage,
      )();
      await automationRuleHandler.enable(
        { rule: 'auto-deploy' },
        storage,
      )();
      const result = await automationRuleHandler.execute(
        { rule: 'auto-deploy', context: '{"event":"pull_request"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const parsed = JSON.parse(result.right.result);
          expect(parsed.matched).toBe(false);
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await automationRuleHandler.execute(
        { rule: 'test', context: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
