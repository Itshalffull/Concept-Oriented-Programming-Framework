// WatchAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { watchAdapterHandler } from './handler.js';
import type { WatchAdapterStorage } from './types.js';

const createTestStorage = (): WatchAdapterStorage => {
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

const createFailingStorage = (): WatchAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = watchAdapterHandler;

describe('WatchAdapter handler', () => {
  describe('normalize', () => {
    it('should return error variant for invalid JSON props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'watch/Card', props: 'not-json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error variant for array props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'watch/Card', props: '[1,2,3]' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should normalize valid props with watch platform metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'watch/Card', props: '{"text":"hello"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.platform).toBe('watch');
          expect(normalized.component).toBe('Card');
          expect(normalized.powerAware).toBe(true);
        }
      }
    });

    it('should resolve known watch component from adapter string', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'some/path/Button', props: '{"label":"tap"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('Button');
        expect(normalized.interactive).toBe(true);
      }
    });

    it('should default to Card for unknown component', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'watch/UnknownWidget', props: '{"text":"hi"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('Card');
      }
    });

    it('should constrain width/height to display limits', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'watch/Card', props: '{"width":500,"height":500,"displaySize":"small"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props.width).toBeLessThanOrEqual(162);
        expect(normalized.props.height).toBeLessThanOrEqual(162);
      }
    });

    it('should enforce minimum touch target for interactive elements', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'watch/Button', props: '{"minWidth":10,"minHeight":10}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props.minWidth).toBeGreaterThanOrEqual(38);
        expect(normalized.props.minHeight).toBeGreaterThanOrEqual(38);
      }
    });

    it('should resolve form factor from props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'watch/Card', props: '{"formFactor":"circular"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.formFactor).toBe('circular');
      }
    });

    it('should persist normalized output to storage', async () => {
      const storage = createTestStorage();
      await handler.normalize(
        { adapter: 'watch/Card', props: '{"text":"hello"}' },
        storage,
      )();
      const record = await storage.get('watchadapter', 'watch/Card');
      expect(record).not.toBeNull();
      expect(record!['adapter']).toBe('watch/Card');
    });

    it('should return left on storage failure during persist', async () => {
      const storage = createFailingStorage();
      const result = await handler.normalize(
        { adapter: 'watch/Card', props: '{"text":"hello"}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
