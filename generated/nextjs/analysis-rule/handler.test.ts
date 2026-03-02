// AnalysisRule — handler.test.ts
// Unit tests for analysisRule handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { analysisRuleHandler } from './handler.js';
import type { AnalysisRuleStorage } from './types.js';

const createTestStorage = (): AnalysisRuleStorage => {
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

const createFailingStorage = (): AnalysisRuleStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('AnalysisRule handler', () => {
  describe('create', () => {
    it('creates successfully with valid input', async () => {
      const storage = createTestStorage();
      const result = await analysisRuleHandler.create(
        { name: 'no-console', engine: 'regex', source: 'console\\.log', severity: 'warning', category: 'quality' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.rule).toBe('rule::no-console');
        }
      }
    });

    it('returns invalidSyntax for invalid regex pattern', async () => {
      const storage = createTestStorage();
      const result = await analysisRuleHandler.create(
        { name: 'bad-regex', engine: 'regex', source: '(unclosed', severity: 'error', category: 'quality' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidSyntax');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await analysisRuleHandler.create(
        { name: 'test', engine: 'regex', source: 'test', severity: 'info', category: 'quality' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('evaluate', () => {
    it('returns evaluationError for missing rule', async () => {
      const storage = createTestStorage();
      const result = await analysisRuleHandler.evaluate(
        { rule: 'rule::nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('evaluationError');
      }
    });

    it('returns noFindings when no files match', async () => {
      const storage = createTestStorage();
      await analysisRuleHandler.create(
        { name: 'no-console', engine: 'regex', source: 'console\\.log', severity: 'warning', category: 'quality' },
        storage,
      )();
      const result = await analysisRuleHandler.evaluate(
        { rule: 'rule::no-console' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noFindings');
      }
    });

    it('returns findings when files match the regex', async () => {
      const storage = createTestStorage();
      await analysisRuleHandler.create(
        { name: 'no-console', engine: 'regex', source: 'console\\.log', severity: 'warning', category: 'quality' },
        storage,
      )();
      await storage.put('file', 'test.ts', { path: 'test.ts', content: 'const x = 1;\nconsole.log(x);\n' });
      const result = await analysisRuleHandler.evaluate(
        { rule: 'rule::no-console' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const findings = JSON.parse(result.right.findings);
          expect(findings.length).toBeGreaterThan(0);
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await analysisRuleHandler.evaluate(
        { rule: 'rule::test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('evaluateAll', () => {
    it('produces ok with valid input', async () => {
      const storage = createTestStorage();
      const result = await analysisRuleHandler.evaluateAll(
        { category: 'quality' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await analysisRuleHandler.evaluateAll(
        { category: 'quality' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('returns notfound for missing rule', async () => {
      const storage = createTestStorage();
      const result = await analysisRuleHandler.get(
        { rule: 'rule::nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns rule after create', async () => {
      const storage = createTestStorage();
      await analysisRuleHandler.create(
        { name: 'no-console', engine: 'regex', source: 'console\\.log', severity: 'warning', category: 'quality' },
        storage,
      )();
      const result = await analysisRuleHandler.get(
        { rule: 'rule::no-console' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.name).toBe('no-console');
          expect(result.right.engine).toBe('regex');
          expect(result.right.category).toBe('quality');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await analysisRuleHandler.get(
        { rule: 'rule::test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
