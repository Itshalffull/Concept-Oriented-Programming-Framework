// StructuralPattern — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { structuralPatternHandler } from './handler.js';
import type { StructuralPatternStorage } from './types.js';

const createTestStorage = (): StructuralPatternStorage => {
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

const createFailingStorage = (): StructuralPatternStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = structuralPatternHandler;

describe('StructuralPattern handler', () => {
  describe('create', () => {
    it('should create a valid pattern', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { syntax: 'class $name { constructor($args) {} }', source: 'test.ts', language: 'typescript' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.pattern).toContain('pat_typescript_');
        }
      }
    });

    it('should return invalidSyntax for empty pattern', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { syntax: '', source: 'test.ts', language: 'typescript' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidSyntax');
        if (result.right.variant === 'invalidSyntax') {
          expect(result.right.message).toContain('Empty');
        }
      }
    });

    it('should return invalidSyntax for unbalanced brackets', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { syntax: 'function test( {', source: 'test.ts', language: 'typescript' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidSyntax');
        if (result.right.variant === 'invalidSyntax') {
          expect(result.right.message).toContain('Unmatched');
        }
      }
    });

    it('should return invalidSyntax for unexpected closing bracket', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { syntax: ')function test()', source: 'test.ts', language: 'typescript' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidSyntax');
      }
    });

    it('should persist pattern in storage', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { syntax: 'observer', source: 'pattern.ts', language: 'typescript' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const record = await storage.get('pattern', result.right.pattern);
        expect(record).not.toBeNull();
        expect(record!['language']).toBe('typescript');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.create(
        { syntax: 'valid', source: 'test.ts', language: 'typescript' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('match', () => {
    it('should return noMatches for nonexistent pattern', async () => {
      const storage = createTestStorage();
      const result = await handler.match(
        { pattern: 'nonexistent', tree: 'tree-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noMatches');
      }
    });

    it('should return incompatibleLanguage when languages differ', async () => {
      const storage = createTestStorage();
      await storage.put('pattern', 'ts-pat', {
        id: 'ts-pat',
        syntax: 'class',
        language: 'typescript',
      });
      await storage.put('tree', 'py-tree', {
        id: 'py-tree',
        language: 'python',
      });
      const result = await handler.match(
        { pattern: 'ts-pat', tree: 'py-tree' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompatibleLanguage');
        if (result.right.variant === 'incompatibleLanguage') {
          expect(result.right.patternLang).toBe('typescript');
          expect(result.right.treeLang).toBe('python');
        }
      }
    });

    it('should return matches when tree nodes contain pattern syntax', async () => {
      const storage = createTestStorage();
      await storage.put('pattern', 'cls-pat', {
        id: 'cls-pat',
        syntax: 'class',
        language: 'typescript',
      });
      await storage.put('tree', 'ts-tree', {
        id: 'ts-tree',
        language: 'typescript',
      });
      await storage.put('tree_node', 'node-1', {
        id: 'node-1',
        tree: 'ts-tree',
        text: 'class MyComponent extends React.Component',
        type: 'class_declaration',
        startByte: 0,
        endByte: 100,
      });
      const result = await handler.match(
        { pattern: 'cls-pat', tree: 'ts-tree' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const matches = JSON.parse(result.right.matches);
          expect(matches.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return noMatches when no tree nodes match', async () => {
      const storage = createTestStorage();
      await storage.put('pattern', 'rare-pat', {
        id: 'rare-pat',
        syntax: 'xyzabc123unique',
        language: 'typescript',
      });
      await storage.put('tree', 'empty-tree', {
        id: 'empty-tree',
        language: 'typescript',
      });
      const result = await handler.match(
        { pattern: 'rare-pat', tree: 'empty-tree' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noMatches');
      }
    });
  });

  describe('matchProject', () => {
    it('should return noMatches for nonexistent pattern', async () => {
      const storage = createTestStorage();
      const result = await handler.matchProject(
        { pattern: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noMatches');
      }
    });

    it('should return noMatches when no trees match', async () => {
      const storage = createTestStorage();
      await storage.put('pattern', 'proj-pat', {
        id: 'proj-pat',
        syntax: 'uniqueNonExistentPattern',
        language: 'typescript',
      });
      const result = await handler.matchProject(
        { pattern: 'proj-pat' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noMatches');
      }
    });
  });
});
