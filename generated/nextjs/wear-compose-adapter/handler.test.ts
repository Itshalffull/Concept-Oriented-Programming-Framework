// WearComposeAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { wearComposeAdapterHandler } from './handler.js';
import type { WearComposeAdapterStorage } from './types.js';

const createTestStorage = (): WearComposeAdapterStorage => {
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

const createFailingStorage = (): WearComposeAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = wearComposeAdapterHandler;

describe('WearComposeAdapter handler', () => {
  describe('normalize', () => {
    it('should return error variant for invalid JSON props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wear/Chip', props: 'bad-json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error variant for non-object JSON props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wear/Chip', props: '"string"' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should normalize valid props with wear-compose platform metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wear/Chip', props: '{"label":"Settings"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.platform).toBe('wear-compose');
          expect(normalized.runtime).toBe('android');
          expect(normalized.composable).toBe('Chip');
        }
      }
    });

    it('should resolve known Wear composables', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wear/ScalingLazyColumn', props: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.composable).toBe('ScalingLazyColumn');
      }
    });

    it('should resolve standard Compose composables that work on Wear', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wear/Box', props: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.composable).toBe('Box');
      }
    });

    it('should default to Chip for unknown composables', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wear/UnknownThing', props: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.composable).toBe('Chip');
      }
    });

    it('should mark interactive composables correctly', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wear/Button', props: '{"label":"Go"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.interactive).toBe(true);
      }
    });

    it('should transform layout props to Compose modifiers', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wear/Chip', props: '{"padding":16,"backgroundColor":"blue"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        const modNames = normalized.modifiers.map((m: { name: string }) => m.name);
        expect(modNames).toContain('padding');
        expect(modNames).toContain('background');
      }
    });

    it('should handle rotary input prop', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wear/ScalingLazyColumn', props: '{"rotaryScrollable":true}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.rotaryInput).toBe(true);
      }
    });

    it('should handle ambient mode prop', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wear/Chip', props: '{"ambientMode":true}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.ambientMode).toBe(true);
      }
    });

    it('should include round display constraints', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wear/Chip', props: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.display.shape).toBe('round');
        expect(normalized.display.width).toBe(227);
      }
    });

    it('should persist normalized output to storage', async () => {
      const storage = createTestStorage();
      await handler.normalize(
        { adapter: 'wear/Chip', props: '{"label":"test"}' },
        storage,
      )();
      const record = await storage.get('wearcomposeadapter', 'wear/Chip');
      expect(record).not.toBeNull();
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.normalize(
        { adapter: 'wear/Chip', props: '{"label":"test"}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
