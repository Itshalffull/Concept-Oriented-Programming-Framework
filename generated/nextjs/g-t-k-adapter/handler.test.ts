// GTKAdapter — handler.test.ts
// Unit tests for gTKAdapter handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { gTKAdapterHandler } from './handler.js';
import type { GTKAdapterStorage } from './types.js';

const createTestStorage = (): GTKAdapterStorage => {
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

const createFailingStorage = (): GTKAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('GTKAdapter handler', () => {
  describe('normalize', () => {
    it('should normalize a button widget with valid props', async () => {
      const storage = createTestStorage();
      const input = {
        adapter: 'button',
        props: JSON.stringify({ type: 'button', onClick: true }),
      };

      const result = await gTKAdapterHandler.normalize(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.widget).toBe('GtkButton');
          expect(normalized.signals).toHaveProperty('clicked');
        }
      }
    });

    it('should normalize layout props like direction, spacing, padding', async () => {
      const storage = createTestStorage();
      const input = {
        adapter: 'container',
        props: JSON.stringify({
          type: 'container',
          direction: 'horizontal',
          spacing: 10,
          padding: 5,
        }),
      };

      const result = await gTKAdapterHandler.normalize(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.widget).toBe('GtkBox');
          expect(normalized.properties.orientation).toBe('GTK_ORIENTATION_HORIZONTAL');
          expect(normalized.properties.spacing).toBe(10);
          expect(normalized.properties['margin-top']).toBe(5);
        }
      }
    });

    it('should normalize accessibility properties', async () => {
      const storage = createTestStorage();
      const input = {
        adapter: 'button',
        props: JSON.stringify({
          type: 'button',
          accessibilityLabel: 'Submit',
          role: 'button',
        }),
      };

      const result = await gTKAdapterHandler.normalize(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.accessibility['accessible-label']).toBe('Submit');
          expect(normalized.accessibility['accessible-role']).toBe('GTK_ACCESSIBLE_ROLE_BUTTON');
        }
      }
    });

    it('should return error for invalid JSON props', async () => {
      const storage = createTestStorage();
      const input = { adapter: 'button', props: 'not-json' };

      const result = await gTKAdapterHandler.normalize(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for unsupported widget type', async () => {
      const storage = createTestStorage();
      const input = {
        adapter: 'unknown-widget',
        props: JSON.stringify({ type: 'unknown-widget' }),
      };

      const result = await gTKAdapterHandler.normalize(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure during persist', async () => {
      const storage = createFailingStorage();
      const input = {
        adapter: 'button',
        props: JSON.stringify({ type: 'button' }),
      };

      const result = await gTKAdapterHandler.normalize(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
