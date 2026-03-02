// DAGHistory — handler.test.ts
// Unit tests for dAGHistory handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { dAGHistoryHandler } from './handler.js';
import type { DAGHistoryStorage } from './types.js';

const createTestStorage = (): DAGHistoryStorage => {
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

const createFailingStorage = (): DAGHistoryStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DAGHistory handler', () => {
  describe('append', () => {
    it('returns ok with nodeId when parents is empty (root node)', async () => {
      const storage = createTestStorage();
      const result = await dAGHistoryHandler.append(
        { parents: new Set(), contentRef: 'ref-1', metadata: Buffer.from('test') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.nodeId).toBeTruthy();
        }
      }
    });

    it('returns unknownParent when parent does not exist', async () => {
      const storage = createTestStorage();
      const result = await dAGHistoryHandler.append(
        { parents: new Set(['nonexistent']), contentRef: 'ref-1', metadata: Buffer.from('test') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unknownParent');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dAGHistoryHandler.append(
        { parents: new Set(), contentRef: 'ref-1', metadata: Buffer.from('test') },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('ancestors', () => {
    it('returns notFound when node does not exist', async () => {
      const storage = createTestStorage();
      const result = await dAGHistoryHandler.ancestors({ nodeId: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dAGHistoryHandler.ancestors({ nodeId: 'test' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('commonAncestor', () => {
    it('returns notFound when node does not exist', async () => {
      const storage = createTestStorage();
      const result = await dAGHistoryHandler.commonAncestor({ a: 'missing-a', b: 'missing-b' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dAGHistoryHandler.commonAncestor({ a: 'a', b: 'b' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('descendants', () => {
    it('returns notFound when node does not exist', async () => {
      const storage = createTestStorage();
      const result = await dAGHistoryHandler.descendants({ nodeId: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dAGHistoryHandler.descendants({ nodeId: 'test' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('between', () => {
    it('returns notFound when node does not exist', async () => {
      const storage = createTestStorage();
      const result = await dAGHistoryHandler.between({ from: 'missing-a', to: 'missing-b' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dAGHistoryHandler.between({ from: 'a', to: 'b' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getNode', () => {
    it('returns ok when node exists', async () => {
      const storage = createTestStorage();
      const appendResult = await dAGHistoryHandler.append(
        { parents: new Set(), contentRef: 'ref-1', metadata: Buffer.from('hello') },
        storage,
      )();
      expect(E.isRight(appendResult)).toBe(true);
      if (E.isRight(appendResult) && appendResult.right.variant === 'ok') {
        const nodeId = appendResult.right.nodeId;
        const result = await dAGHistoryHandler.getNode({ nodeId }, storage)();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.contentRef).toBe('ref-1');
          }
        }
      }
    });

    it('returns notFound when node does not exist', async () => {
      const storage = createTestStorage();
      const result = await dAGHistoryHandler.getNode({ nodeId: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dAGHistoryHandler.getNode({ nodeId: 'test' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
