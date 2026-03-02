// NativeScriptAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { nativeScriptAdapterHandler } from './handler.js';
import type { NativeScriptAdapterStorage } from './types.js';

const createTestStorage = (): NativeScriptAdapterStorage => {
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

const createFailingStorage = (): NativeScriptAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = nativeScriptAdapterHandler;

describe('NativeScriptAdapter handler', () => {
  describe('normalize', () => {
    it('should normalize props for a StackLayout component', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'StackLayout',
          props: JSON.stringify({ 'background-color': 'blue', padding: 16 }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.component).toBe('StackLayout');
          expect(normalized.platform).toBe('nativescript');
          expect(normalized.props.backgroundColor).toBe('blue');
          expect(normalized.viewType).toBe('layout');
        }
      }
    });

    it('should resolve GridLayout component', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'app/GridLayout',
          props: JSON.stringify({ rows: '*, auto', columns: '*, *' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('GridLayout');
        expect(normalized.viewType).toBe('layout');
      }
    });

    it('should resolve Button as a view component', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'Button',
          props: JSON.stringify({ color: 'white' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('Button');
        expect(normalized.viewType).toBe('view');
      }
    });

    it('should default unknown components to StackLayout', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'UnknownComponent',
          props: JSON.stringify({}),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('StackLayout');
      }
    });

    it('should map flex-direction to orientation', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'StackLayout',
          props: JSON.stringify({ 'flex-direction': 'row' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props.orientation).toBe('horizontal');
      }
    });

    it('should map CSS property names to NativeScript equivalents', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'Label',
          props: JSON.stringify({ 'font-size': 20, 'text-align': 'center' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props.fontSize).toBe(20);
        expect(normalized.props.textAlignment).toBe('center');
      }
    });

    it('should return error for invalid JSON props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'StackLayout', props: 'not json' },
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
        { adapter: 'StackLayout', props: JSON.stringify({ width: 100 }) },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
