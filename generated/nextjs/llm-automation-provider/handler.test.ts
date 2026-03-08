// LLMAutomationProvider — handler.test.ts
// Unit tests for LLM automation provider register and execute actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { llmAutomationProviderHandler } from './handler.js';
import type { LLMAutomationProviderStorage } from './types.js';

const createTestStorage = (): LLMAutomationProviderStorage => {
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

const createFailingStorage = (): LLMAutomationProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('LLMAutomationProvider handler', () => {
  describe('register', () => {
    it('registers the LLM provider with ok variant', async () => {
      const storage = createTestStorage();
      const result = await llmAutomationProviderHandler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).provider_name).toBe('llm');
      }
    });

    it('returns already_registered on duplicate registration', async () => {
      const storage = createTestStorage();
      await llmAutomationProviderHandler.register({}, storage)();
      const result = await llmAutomationProviderHandler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('already_registered');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await llmAutomationProviderHandler.register({}, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('execute', () => {
    it('executes with valid payload and config returning ok', async () => {
      const storage = createTestStorage();
      const result = await llmAutomationProviderHandler.execute(
        {
          action_payload: '{"action":"summarize","text":"hello"}',
          model_config: '{"model":"gpt-4"}',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).result).toBeDefined();
      }
    });

    it('returns error when action_payload is empty', async () => {
      const storage = createTestStorage();
      const result = await llmAutomationProviderHandler.execute(
        { action_payload: '', model_config: '{"model":"gpt-4"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns error when model_config is missing', async () => {
      const storage = createTestStorage();
      const result = await llmAutomationProviderHandler.execute(
        { action_payload: '{"action":"test"}', model_config: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns error for invalid model_config JSON', async () => {
      const storage = createTestStorage();
      const result = await llmAutomationProviderHandler.execute(
        { action_payload: '{"action":"test"}', model_config: 'not-json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns error when model_config lacks model field', async () => {
      const storage = createTestStorage();
      const result = await llmAutomationProviderHandler.execute(
        { action_payload: '{"action":"test"}', model_config: '{"temperature":0.5}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });
  });

  describe('multi-step sequence: register -> execute', () => {
    it('registers then executes successfully', async () => {
      const storage = createTestStorage();

      const regResult = await llmAutomationProviderHandler.register({}, storage)();
      expect(E.isRight(regResult)).toBe(true);

      const execResult = await llmAutomationProviderHandler.execute(
        {
          action_payload: '{"action":"classify"}',
          model_config: '{"model":"claude-3"}',
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
      const result = await llmAutomationProviderHandler.execute(
        {
          action_payload: '{"action":"test"}',
          model_config: '{"model":"gpt-4"}',
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
