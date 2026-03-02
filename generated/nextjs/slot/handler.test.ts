// Slot — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { slotHandler } from './handler.js';
import type { SlotStorage } from './types.js';

const createTestStorage = (): SlotStorage => {
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

const createFailingStorage = (): SlotStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = slotHandler;

describe('Slot handler', () => {
  describe('define', () => {
    it('should define a slot with valid position', async () => {
      const storage = createTestStorage();
      const result = await handler.define(
        { slot: 'header-slot', name: 'header', host: 'main-widget', position: 'before', fallback: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.slot).toBe('header-slot');
        }
      }
    });

    it('should define a slot with fallback content', async () => {
      const storage = createTestStorage();
      const result = await handler.define(
        { slot: 'fb-slot', name: 'fallback', host: 'widget', position: 'replace', fallback: O.some('<p>Default</p>') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
      const record = await storage.get('slots', 'fb-slot');
      expect(record).not.toBeNull();
      expect(record!['fallback']).toBe('<p>Default</p>');
    });

    it('should return duplicate for existing slot', async () => {
      const storage = createTestStorage();
      await handler.define(
        { slot: 'dup-slot', name: 'dup', host: 'widget', position: 'after', fallback: O.none },
        storage,
      )();
      const result = await handler.define(
        { slot: 'dup-slot', name: 'dup', host: 'widget', position: 'after', fallback: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('duplicate');
      }
    });

    it('should return left for invalid position', async () => {
      const storage = createTestStorage();
      const result = await handler.define(
        { slot: 'bad-pos', name: 'bad', host: 'widget', position: 'invalid', fallback: O.none },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('INVALID_POSITION');
      }
    });

    it('should accept all valid positions', async () => {
      const storage = createTestStorage();
      const positions = ['before', 'after', 'replace', 'prepend', 'append'];
      for (const position of positions) {
        const fresh = createTestStorage();
        const result = await handler.define(
          { slot: `pos-${position}`, name: position, host: 'widget', position, fallback: O.none },
          fresh,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });
  });

  describe('fill', () => {
    it('should fill a defined slot with content', async () => {
      const storage = createTestStorage();
      await handler.define(
        { slot: 'fill-slot', name: 'content', host: 'widget', position: 'replace', fallback: O.none },
        storage,
      )();
      const result = await handler.fill(
        { slot: 'fill-slot', content: '<div>Hello</div>' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.slot).toBe('fill-slot');
        }
      }
    });

    it('should return notfound for undefined slot', async () => {
      const storage = createTestStorage();
      const result = await handler.fill(
        { slot: 'missing', content: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.fill(
        { slot: 'test', content: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear a filled slot', async () => {
      const storage = createTestStorage();
      await handler.define(
        { slot: 'clear-slot', name: 'clr', host: 'widget', position: 'replace', fallback: O.none },
        storage,
      )();
      await handler.fill({ slot: 'clear-slot', content: 'content' }, storage)();
      const result = await handler.clear({ slot: 'clear-slot' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.slot).toBe('clear-slot');
        }
      }
    });

    it('should return notfound for undefined slot', async () => {
      const storage = createTestStorage();
      const result = await handler.clear({ slot: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
