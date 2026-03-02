// DesktopAdapter — handler.test.ts
// Unit tests for desktopAdapter handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { desktopAdapterHandler } from './handler.js';
import type { DesktopAdapterStorage } from './types.js';

const createTestStorage = (): DesktopAdapterStorage => {
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

const createFailingStorage = (): DesktopAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DesktopAdapter handler', () => {
  describe('normalize', () => {
    it('returns ok with normalized desktop props for a known widget type', async () => {
      const storage = createTestStorage();
      const result = await desktopAdapterHandler.normalize(
        {
          adapter: 'button',
          props: JSON.stringify({ type: 'button', onClick: true, width: 200, height: 40 }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.adapter).toBe('button');
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.component).toBe('Button');
        }
      }
    });

    it('returns error for invalid JSON props', async () => {
      const storage = createTestStorage();
      const result = await desktopAdapterHandler.normalize(
        { adapter: 'button', props: 'not-json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns error for unknown widget type', async () => {
      const storage = createTestStorage();
      const result = await desktopAdapterHandler.normalize(
        { adapter: 'unknown-widget', props: JSON.stringify({ type: 'unknown-widget' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await desktopAdapterHandler.normalize(
        { adapter: 'button', props: JSON.stringify({ type: 'button' }) },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
