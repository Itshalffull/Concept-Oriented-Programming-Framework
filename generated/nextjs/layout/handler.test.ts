// Layout — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { layoutHandler } from './handler.js';
import type { LayoutStorage } from './types.js';

const createTestStorage = (): LayoutStorage => {
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

const createFailingStorage = (): LayoutStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = layoutHandler;

describe('Layout handler', () => {
  describe('create', () => {
    it('should create a layout with valid kind', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { layout: 'main-grid', name: 'Main Grid', kind: 'grid' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.layout).toBe('main-grid');
        }
      }
    });

    it('should return invalid for unknown layout kind', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { layout: 'bad', name: 'Bad', kind: 'unknown' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for empty name', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { layout: 'no-name', name: '   ', kind: 'flex' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should accept all valid kinds', async () => {
      const storage = createTestStorage();
      for (const kind of ['flex', 'grid', 'stack', 'absolute', 'flow']) {
        const result = await handler.create(
          { layout: `layout-${kind}`, name: `Layout ${kind}`, kind },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });
  });

  describe('configure', () => {
    it('should configure an existing layout', async () => {
      const storage = createTestStorage();
      await handler.create({ layout: 'cfg-test', name: 'Cfg', kind: 'flex' }, storage)();
      const result = await handler.configure(
        { layout: 'cfg-test', config: JSON.stringify({ gap: 16 }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for non-existent layout', async () => {
      const storage = createTestStorage();
      const result = await handler.configure(
        { layout: 'missing', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left for invalid JSON config', async () => {
      const storage = createTestStorage();
      await handler.create({ layout: 'bad-json', name: 'BadJSON', kind: 'flex' }, storage)();
      const result = await handler.configure(
        { layout: 'bad-json', config: 'not json' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('nest', () => {
    it('should nest a child layout under a parent', async () => {
      const storage = createTestStorage();
      await handler.create({ layout: 'parent', name: 'Parent', kind: 'flex' }, storage)();
      await handler.create({ layout: 'child', name: 'Child', kind: 'grid' }, storage)();
      const result = await handler.nest({ parent: 'parent', child: 'child' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should detect self-nesting cycle', async () => {
      const storage = createTestStorage();
      await handler.create({ layout: 'self', name: 'Self', kind: 'flex' }, storage)();
      const result = await handler.nest({ parent: 'self', child: 'self' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cycle');
      }
    });

    it('should return cycle when parent not found', async () => {
      const storage = createTestStorage();
      await handler.create({ layout: 'child-only', name: 'Child', kind: 'flex' }, storage)();
      const result = await handler.nest({ parent: 'missing-parent', child: 'child-only' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cycle');
      }
    });
  });

  describe('setResponsive', () => {
    it('should set breakpoints on an existing layout', async () => {
      const storage = createTestStorage();
      await handler.create({ layout: 'resp', name: 'Resp', kind: 'grid' }, storage)();
      const result = await handler.setResponsive(
        { layout: 'resp', breakpoints: JSON.stringify({ sm: 640, md: 768 }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing layout', async () => {
      const storage = createTestStorage();
      const result = await handler.setResponsive(
        { layout: 'nope', breakpoints: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('remove', () => {
    it('should remove an existing layout', async () => {
      const storage = createTestStorage();
      await handler.create({ layout: 'to-remove', name: 'Remove', kind: 'flex' }, storage)();
      const result = await handler.remove({ layout: 'to-remove' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for non-existent layout', async () => {
      const storage = createTestStorage();
      const result = await handler.remove({ layout: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.remove({ layout: 'any' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
