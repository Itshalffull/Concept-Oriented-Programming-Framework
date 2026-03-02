// Shell — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { shellHandler } from './handler.js';
import type { ShellStorage } from './types.js';

const createTestStorage = (): ShellStorage => {
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

const createFailingStorage = (): ShellStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = shellHandler;

describe('Shell handler', () => {
  describe('initialize', () => {
    it('should initialize a shell with named zones', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize(
        { shell: 'main-shell', zones: 'header, content, sidebar' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.shell).toBe('main-shell');
        }
      }
    });

    it('should return invalid for empty zone list', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize(
        { shell: 'empty-shell', zones: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for whitespace-only zones', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize(
        { shell: 'ws-shell', zones: '  ,  ,  ' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });
  });

  describe('assignToZone', () => {
    it('should assign a content ref to a valid zone', async () => {
      const storage = createTestStorage();
      await handler.initialize({ shell: 'as-shell', zones: 'main, side' }, storage)();
      const result = await handler.assignToZone(
        { shell: 'as-shell', zone: 'main', ref: 'widget-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent shell', async () => {
      const storage = createTestStorage();
      const result = await handler.assignToZone(
        { shell: 'missing-shell', zone: 'main', ref: 'widget-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return notfound for nonexistent zone', async () => {
      const storage = createTestStorage();
      await handler.initialize({ shell: 'zone-shell', zones: 'header' }, storage)();
      const result = await handler.assignToZone(
        { shell: 'zone-shell', zone: 'nonexistent', ref: 'widget-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('clearZone', () => {
    it('should clear a zone and return previous ref', async () => {
      const storage = createTestStorage();
      await handler.initialize({ shell: 'clr-shell', zones: 'main' }, storage)();
      await handler.assignToZone({ shell: 'clr-shell', zone: 'main', ref: 'widget-x' }, storage)();
      const result = await handler.clearZone({ shell: 'clr-shell', zone: 'main' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(O.isSome(result.right.previous)).toBe(true);
        }
      }
    });

    it('should return none previous when zone was empty', async () => {
      const storage = createTestStorage();
      await handler.initialize({ shell: 'empty-clr', zones: 'main' }, storage)();
      const result = await handler.clearZone({ shell: 'empty-clr', zone: 'main' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(O.isNone(result.right.previous)).toBe(true);
        }
      }
    });

    it('should return notfound for missing shell', async () => {
      const storage = createTestStorage();
      const result = await handler.clearZone({ shell: 'missing', zone: 'main' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('pushOverlay', () => {
    it('should push an overlay onto the shell stack', async () => {
      const storage = createTestStorage();
      await handler.initialize({ shell: 'ov-shell', zones: 'main' }, storage)();
      const result = await handler.pushOverlay(
        { shell: 'ov-shell', ref: 'modal-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid for nonexistent shell', async () => {
      const storage = createTestStorage();
      const result = await handler.pushOverlay(
        { shell: 'missing', ref: 'modal-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });
  });

  describe('popOverlay', () => {
    it('should pop the topmost overlay', async () => {
      const storage = createTestStorage();
      await handler.initialize({ shell: 'pop-shell', zones: 'main' }, storage)();
      await handler.pushOverlay({ shell: 'pop-shell', ref: 'modal-a' }, storage)();
      await handler.pushOverlay({ shell: 'pop-shell', ref: 'modal-b' }, storage)();
      const result = await handler.popOverlay({ shell: 'pop-shell' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.overlay).toBe('modal-b');
        }
      }
    });

    it('should return empty when no overlays on stack', async () => {
      const storage = createTestStorage();
      await handler.initialize({ shell: 'empty-pop', zones: 'main' }, storage)();
      const result = await handler.popOverlay({ shell: 'empty-pop' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('empty');
      }
    });

    it('should return empty for nonexistent shell', async () => {
      const storage = createTestStorage();
      const result = await handler.popOverlay({ shell: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('empty');
      }
    });
  });
});
