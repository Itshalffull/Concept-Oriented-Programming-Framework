// InkAdapter — handler.test.ts
// Unit tests for inkAdapter handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { inkAdapterHandler } from './handler.js';
import type { InkAdapterStorage } from './types.js';

const createTestStorage = (): InkAdapterStorage => {
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

const createFailingStorage = (): InkAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('InkAdapter handler', () => {
  describe('normalize', () => {
    it('should normalize props for a Box component', async () => {
      const storage = createTestStorage();
      const input = {
        adapter: 'Box',
        props: JSON.stringify({
          'flex-direction': 'column',
          'padding': 2,
        }),
      };

      const result = await inkAdapterHandler.normalize(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.component).toBe('Box');
          expect(normalized.props.flexDirection).toBe('column');
          expect(normalized.props.paddingX).toBe(2);
          expect(normalized.platform).toBe('ink');
        }
      }
    });

    it('should resolve a Text component from adapter path', async () => {
      const storage = createTestStorage();
      const input = {
        adapter: 'widgets/Text',
        props: JSON.stringify({ bold: true, color: 'green' }),
      };

      const result = await inkAdapterHandler.normalize(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.component).toBe('Text');
          expect(normalized.props.bold).toBe(true);
          expect(normalized.props.color).toBe('green');
        }
      }
    });

    it('should default to Box for unrecognized component names', async () => {
      const storage = createTestStorage();
      const input = {
        adapter: 'CustomWidget',
        props: JSON.stringify({ width: 50 }),
      };

      const result = await inkAdapterHandler.normalize(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.component).toBe('Box');
        }
      }
    });

    it('should normalize border prop to Ink borderStyle', async () => {
      const storage = createTestStorage();
      const input = {
        adapter: 'Box',
        props: JSON.stringify({ border: 'round' }),
      };

      const result = await inkAdapterHandler.normalize(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.props.borderStyle).toBe('round');
        }
      }
    });

    it('should normalize boolean border to single style', async () => {
      const storage = createTestStorage();
      const input = {
        adapter: 'Box',
        props: JSON.stringify({ border: true }),
      };

      const result = await inkAdapterHandler.normalize(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.props.borderStyle).toBe('single');
        }
      }
    });

    it('should return error for invalid JSON props', async () => {
      const storage = createTestStorage();
      const input = { adapter: 'Box', props: 'not-json{' };

      const result = await inkAdapterHandler.normalize(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure during persist', async () => {
      const storage = createFailingStorage();
      const input = {
        adapter: 'Box',
        props: JSON.stringify({ width: 10 }),
      };

      const result = await inkAdapterHandler.normalize(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
