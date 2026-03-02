// SolidAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { solidAdapterHandler } from './handler.js';
import type { SolidAdapterStorage } from './types.js';

const createTestStorage = (): SolidAdapterStorage => {
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

const createFailingStorage = (): SolidAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = solidAdapterHandler;

describe('SolidAdapter handler', () => {
  describe('normalize', () => {
    it('should normalize React-style props to SolidJS equivalents', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'components/Button',
          props: JSON.stringify({ className: 'btn', onClick: 'handleClick' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.props['class']).toBe('btn');
          expect(normalized.props['on:click']).toBe('handleClick');
          expect(normalized.platform).toBe('solid');
        }
      }
    });

    it('should map htmlFor to for', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'components/Label',
          props: JSON.stringify({ htmlFor: 'input-1' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props['for']).toBe('input-1');
      }
    });

    it('should detect SolidJS control flow components', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'components/Show',
          props: JSON.stringify({ when: true, fallback: 'loading' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.controlFlow).toBe(true);
        expect(normalized.component).toBe('Show');
      }
    });

    it('should detect signal indicators', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'components/Counter',
          props: JSON.stringify({ createSignal: true, value: 0 }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.signals).toContain('createSignal');
      }
    });

    it('should return error for invalid JSON props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'components/Bad', props: 'not valid json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for array props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'components/Arr', props: JSON.stringify([1, 2, 3]) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should persist normalized result in storage', async () => {
      const storage = createTestStorage();
      await handler.normalize(
        { adapter: 'components/Saved', props: JSON.stringify({ text: 'hi' }) },
        storage,
      )();
      const record = await storage.get('solidadapter', 'components/Saved');
      expect(record).not.toBeNull();
      expect(record!['adapter']).toBe('components/Saved');
    });

    it('should set fineGrainedReactivity to true', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'components/Widget', props: JSON.stringify({ title: 'test' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.fineGrainedReactivity).toBe(true);
        expect(normalized.framework).toBe('solidjs');
      }
    });
  });
});
