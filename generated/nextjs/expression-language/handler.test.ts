// ExpressionLanguage — handler.test.ts
// Unit tests for expressionLanguage handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { expressionLanguageHandler } from './handler.js';
import type { ExpressionLanguageStorage } from './types.js';

const createTestStorage = (): ExpressionLanguageStorage => {
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

const createFailingStorage = (): ExpressionLanguageStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ExpressionLanguage handler', () => {
  describe('registerLanguage', () => {
    it('should register a new language', async () => {
      const storage = createTestStorage();
      const result = await expressionLanguageHandler.registerLanguage(
        { name: 'math', grammar: 'expr := number | expr op expr' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists for duplicate language', async () => {
      const storage = createTestStorage();
      await expressionLanguageHandler.registerLanguage(
        { name: 'math', grammar: 'expr := number' },
        storage,
      )();
      const result = await expressionLanguageHandler.registerLanguage(
        { name: 'math', grammar: 'expr := number' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await expressionLanguageHandler.registerLanguage(
        { name: 'math', grammar: 'expr' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('registerFunction', () => {
    it('should register a new function', async () => {
      const storage = createTestStorage();
      const result = await expressionLanguageHandler.registerFunction(
        { name: 'double', implementation: 'x => x * 2' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists for duplicate function', async () => {
      const storage = createTestStorage();
      await expressionLanguageHandler.registerFunction(
        { name: 'double', implementation: 'x => x * 2' },
        storage,
      )();
      const result = await expressionLanguageHandler.registerFunction(
        { name: 'double', implementation: 'x => x * 2' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });
  });

  describe('registerOperator', () => {
    it('should register a new operator', async () => {
      const storage = createTestStorage();
      const result = await expressionLanguageHandler.registerOperator(
        { name: '**', implementation: 'pow' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists for duplicate operator', async () => {
      const storage = createTestStorage();
      await expressionLanguageHandler.registerOperator(
        { name: '**', implementation: 'pow' },
        storage,
      )();
      const result = await expressionLanguageHandler.registerOperator(
        { name: '**', implementation: 'pow' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });
  });

  describe('parse', () => {
    it('should parse a valid expression and return AST', async () => {
      const storage = createTestStorage();
      await expressionLanguageHandler.registerLanguage(
        { name: 'math', grammar: 'standard' },
        storage,
      )();
      const result = await expressionLanguageHandler.parse(
        { expression: 'expr-1', text: '1 + 2 * 3', language: 'math' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.ast).toBeTruthy();
        }
      }
    });

    it('should return error for unregistered language', async () => {
      const storage = createTestStorage();
      const result = await expressionLanguageHandler.parse(
        { expression: 'expr-1', text: '1 + 2', language: 'unregistered' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for malformed expression', async () => {
      const storage = createTestStorage();
      await expressionLanguageHandler.registerLanguage(
        { name: 'math', grammar: 'standard' },
        storage,
      )();
      const result = await expressionLanguageHandler.parse(
        { expression: 'expr-1', text: '1 +', language: 'math' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await expressionLanguageHandler.parse(
        { expression: 'expr-1', text: '1 + 2', language: 'math' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('evaluate', () => {
    it('should evaluate a parsed expression', async () => {
      const storage = createTestStorage();
      await expressionLanguageHandler.registerLanguage(
        { name: 'math', grammar: 'standard' },
        storage,
      )();
      await expressionLanguageHandler.parse(
        { expression: 'expr-1', text: '1 + 2 * 3', language: 'math' },
        storage,
      )();
      const result = await expressionLanguageHandler.evaluate(
        { expression: 'expr-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.result).toBe('7');
        }
      }
    });

    it('should return notfound for unparsed expression', async () => {
      const storage = createTestStorage();
      const result = await expressionLanguageHandler.evaluate(
        { expression: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await expressionLanguageHandler.evaluate(
        { expression: 'expr-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('typeCheck', () => {
    it('should type check a parsed expression', async () => {
      const storage = createTestStorage();
      await expressionLanguageHandler.registerLanguage(
        { name: 'math', grammar: 'standard' },
        storage,
      )();
      await expressionLanguageHandler.parse(
        { expression: 'expr-1', text: '1 + 2', language: 'math' },
        storage,
      )();
      const result = await expressionLanguageHandler.typeCheck(
        { expression: 'expr-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.valid).toBe(true);
        }
      }
    });

    it('should return notfound for unparsed expression', async () => {
      const storage = createTestStorage();
      const result = await expressionLanguageHandler.typeCheck(
        { expression: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('getCompletions', () => {
    it('should return completions for a parsed expression', async () => {
      const storage = createTestStorage();
      await expressionLanguageHandler.registerLanguage(
        { name: 'math', grammar: 'standard' },
        storage,
      )();
      await expressionLanguageHandler.parse(
        { expression: 'expr-1', text: '1 + 2', language: 'math' },
        storage,
      )();
      const result = await expressionLanguageHandler.getCompletions(
        { expression: 'expr-1', cursor: 42 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const completions = JSON.parse(result.right.completions);
          expect(Array.isArray(completions)).toBe(true);
          expect(completions.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return notfound for unparsed expression', async () => {
      const storage = createTestStorage();
      const result = await expressionLanguageHandler.getCompletions(
        { expression: 'nonexistent', cursor: 0 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
