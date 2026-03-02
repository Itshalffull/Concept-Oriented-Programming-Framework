// SpecParser — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { specParserHandler } from './handler.js';
import type { SpecParserStorage } from './types.js';

const createTestStorage = (): SpecParserStorage => {
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

const createFailingStorage = (): SpecParserStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = specParserHandler;

describe('SpecParser handler', () => {
  describe('parse', () => {
    it('should parse a valid concept spec', async () => {
      const storage = createTestStorage();
      const source = [
        'concept session',
        'state token: string',
        'action create',
        'action validate',
        'output ok',
        'output error',
      ].join('\n');
      const result = await handler.parse({ source }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.spec).toContain('spec-session');
          const ast = result.right.ast as Record<string, unknown>;
          expect(ast.type).toBe('concept');
          expect(ast.name).toBe('session');
        }
      }
    });

    it('should return error for empty source', async () => {
      const storage = createTestStorage();
      const result = await handler.parse({ source: '' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('empty');
        }
      }
    });

    it('should return error for whitespace-only source', async () => {
      const storage = createTestStorage();
      const result = await handler.parse({ source: '   \n   ' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for source missing concept declaration', async () => {
      const storage = createTestStorage();
      const source = 'action create\naction validate';
      const result = await handler.parse({ source }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('concept');
          expect(result.right.line).toBe(1);
        }
      }
    });

    it('should skip comment lines', async () => {
      const storage = createTestStorage();
      const source = [
        '// This is a comment',
        'concept my-concept',
        '// Another comment',
        'action doSomething',
      ].join('\n');
      const result = await handler.parse({ source }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const ast = result.right.ast as Record<string, unknown>;
          expect(ast.name).toBe('my-concept');
        }
      }
    });

    it('should parse annotations', async () => {
      const storage = createTestStorage();
      const source = [
        'concept annotated',
        '@gate',
        'action fire',
      ].join('\n');
      const result = await handler.parse({ source }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const ast = result.right.ast as Record<string, unknown>;
        const children = ast.children as readonly Record<string, unknown>[];
        const annotations = children.filter(c => c.type === 'annotation');
        expect(annotations.length).toBe(1);
        expect(annotations[0].value).toBe('@gate');
      }
    });

    it('should parse field declarations with types', async () => {
      const storage = createTestStorage();
      const source = [
        'concept typed',
        'name: string',
        'count: number',
      ].join('\n');
      const result = await handler.parse({ source }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const ast = result.right.ast as Record<string, unknown>;
        const children = ast.children as readonly Record<string, unknown>[];
        const fields = children.filter(c => c.type === 'field');
        expect(fields.length).toBe(2);
      }
    });

    it('should persist parsed AST in storage', async () => {
      const storage = createTestStorage();
      const source = 'concept persisted\naction run';
      const result = await handler.parse({ source }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const records = await storage.find('parsed_specs');
        expect(records.length).toBe(1);
        expect(records[0]['conceptName']).toBe('persisted');
      }
    });

    it('should return left on storage failure for valid spec', async () => {
      const storage = createFailingStorage();
      const source = 'concept test\naction run';
      const result = await handler.parse({ source }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
