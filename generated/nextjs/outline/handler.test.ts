// Outline — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { outlineHandler } from './handler.js';
import type { OutlineStorage } from './types.js';

const createTestStorage = (): OutlineStorage => {
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

const createFailingStorage = (): OutlineStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Outline handler', () => {
  describe('create', () => {
    it('should create a root-level node', async () => {
      const storage = createTestStorage();

      const result = await outlineHandler.create(
        { node: 'chapter1', parent: O.none },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.node).toBe('chapter1');
        }
      }
    });

    it('should create a child node under a parent', async () => {
      const storage = createTestStorage();
      await outlineHandler.create({ node: 'parent', parent: O.none }, storage)();

      const result = await outlineHandler.create(
        { node: 'child', parent: O.some('parent') },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists for duplicate node', async () => {
      const storage = createTestStorage();
      await outlineHandler.create({ node: 'dup', parent: O.none }, storage)();

      const result = await outlineHandler.create(
        { node: 'dup', parent: O.none },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });
  });

  describe('indent', () => {
    it('should indent a node under its previous sibling', async () => {
      const storage = createTestStorage();
      await outlineHandler.create({ node: 'a', parent: O.none }, storage)();
      await outlineHandler.create({ node: 'b', parent: O.none }, storage)();

      const result = await outlineHandler.indent({ node: 'b' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid if no previous sibling', async () => {
      const storage = createTestStorage();
      await outlineHandler.create({ node: 'first', parent: O.none }, storage)();

      const result = await outlineHandler.indent({ node: 'first' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return notfound for nonexistent node', async () => {
      const storage = createTestStorage();

      const result = await outlineHandler.indent({ node: 'ghost' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('outdent', () => {
    it('should outdent a child node to its grandparent level', async () => {
      const storage = createTestStorage();
      await outlineHandler.create({ node: 'a', parent: O.none }, storage)();
      await outlineHandler.create({ node: 'b', parent: O.none }, storage)();
      await outlineHandler.indent({ node: 'b' }, storage)();

      const result = await outlineHandler.outdent({ node: 'b' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid for root-level node', async () => {
      const storage = createTestStorage();
      await outlineHandler.create({ node: 'root', parent: O.none }, storage)();

      const result = await outlineHandler.outdent({ node: 'root' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return notfound for nonexistent node', async () => {
      const storage = createTestStorage();

      const result = await outlineHandler.outdent({ node: 'missing' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('moveUp', () => {
    it('should swap node with its previous sibling', async () => {
      const storage = createTestStorage();
      await outlineHandler.create({ node: 'x', parent: O.none }, storage)();
      await outlineHandler.create({ node: 'y', parent: O.none }, storage)();

      const result = await outlineHandler.moveUp({ node: 'y' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent node', async () => {
      const storage = createTestStorage();

      const result = await outlineHandler.moveUp({ node: 'nope' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('moveDown', () => {
    it('should swap node with its next sibling', async () => {
      const storage = createTestStorage();
      await outlineHandler.create({ node: 'p', parent: O.none }, storage)();
      await outlineHandler.create({ node: 'q', parent: O.none }, storage)();

      const result = await outlineHandler.moveDown({ node: 'p' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent node', async () => {
      const storage = createTestStorage();

      const result = await outlineHandler.moveDown({ node: 'nope' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('collapse and expand', () => {
    it('should collapse a node', async () => {
      const storage = createTestStorage();
      await outlineHandler.create({ node: 'sec1', parent: O.none }, storage)();

      const result = await outlineHandler.collapse({ node: 'sec1' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should expand a collapsed node', async () => {
      const storage = createTestStorage();
      await outlineHandler.create({ node: 'sec2', parent: O.none }, storage)();
      await outlineHandler.collapse({ node: 'sec2' }, storage)();

      const result = await outlineHandler.expand({ node: 'sec2' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for collapse on nonexistent node', async () => {
      const storage = createTestStorage();

      const result = await outlineHandler.collapse({ node: 'ghost' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('reparent', () => {
    it('should move a node under a new parent', async () => {
      const storage = createTestStorage();
      await outlineHandler.create({ node: 'n1', parent: O.none }, storage)();
      await outlineHandler.create({ node: 'n2', parent: O.none }, storage)();

      const result = await outlineHandler.reparent(
        { node: 'n1', newParent: 'n2' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when node does not exist', async () => {
      const storage = createTestStorage();
      await outlineHandler.create({ node: 'target', parent: O.none }, storage)();

      const result = await outlineHandler.reparent(
        { node: 'ghost', newParent: 'target' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return notfound when new parent does not exist', async () => {
      const storage = createTestStorage();
      await outlineHandler.create({ node: 'orphan', parent: O.none }, storage)();

      const result = await outlineHandler.reparent(
        { node: 'orphan', newParent: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('getChildren', () => {
    it('should return children of a node as JSON', async () => {
      const storage = createTestStorage();
      await outlineHandler.create({ node: 'parent', parent: O.none }, storage)();
      await outlineHandler.create({ node: 'c1', parent: O.some('parent') }, storage)();
      await outlineHandler.create({ node: 'c2', parent: O.some('parent') }, storage)();

      const result = await outlineHandler.getChildren(
        { node: 'parent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const children = JSON.parse(result.right.children);
        expect(children).toContain('c1');
        expect(children).toContain('c2');
      }
    });

    it('should return notfound for nonexistent node', async () => {
      const storage = createTestStorage();

      const result = await outlineHandler.getChildren(
        { node: 'missing' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('storage errors', () => {
    it('should return left on storage failure in create', async () => {
      const storage = createFailingStorage();

      const result = await outlineHandler.create(
        { node: 'fail', parent: O.none },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
