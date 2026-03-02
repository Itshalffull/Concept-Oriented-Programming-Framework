// MobileAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { mobileAdapterHandler } from './handler.js';
import type { MobileAdapterStorage } from './types.js';

const createTestStorage = (): MobileAdapterStorage => {
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

const createFailingStorage = (): MobileAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = mobileAdapterHandler;

describe('MobileAdapter handler', () => {
  describe('normalize', () => {
    it('should normalize props for a basic View component', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'View',
          props: JSON.stringify({ width: 100, height: 50 }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.component).toBe('View');
          expect(normalized.platform).toBe('mobile');
          expect(normalized.safeArea).toBe(true);
        }
      }
    });

    it('should map CSS prop names to camelCase mobile equivalents', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'View',
          props: JSON.stringify({ 'background-color': 'red', 'font-size': 16 }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props.backgroundColor).toBe('red');
      }
    });

    it('should enforce minimum touch target for interactive components', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'TouchableOpacity/Button',
          props: JSON.stringify({ width: 20, height: 20 }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.interactive).toBe(true);
        // minWidth and minHeight should be at least 44dp
        expect(normalized.props.minWidth.value).toBeGreaterThanOrEqual(44);
        expect(normalized.props.minHeight.value).toBeGreaterThanOrEqual(44);
      }
    });

    it('should annotate scalable numeric props with dp units', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'View',
          props: JSON.stringify({ padding: 16, margin: 8 }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props.padding).toEqual({ value: 16, unit: 'dp' });
        expect(normalized.props.margin).toEqual({ value: 8, unit: 'dp' });
      }
    });

    it('should resolve known mobile primitive components', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'app/ScrollView',
          props: JSON.stringify({}),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('ScrollView');
      }
    });

    it('should default unknown components to View', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'custom/UnknownWidget',
          props: JSON.stringify({}),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('View');
      }
    });

    it('should return error for invalid JSON props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'View', props: 'not json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure during persistence', async () => {
      const storage = createFailingStorage();
      const result = await handler.normalize(
        { adapter: 'View', props: JSON.stringify({ width: 10 }) },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
