// PlatformAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { platformAdapterHandler } from './handler.js';
import type { PlatformAdapterStorage } from './types.js';

const createTestStorage = (): PlatformAdapterStorage => {
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

const createFailingStorage = (): PlatformAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('PlatformAdapter handler', () => {
  describe('register', () => {
    it('should register a new adapter', async () => {
      const storage = createTestStorage();

      const result = await platformAdapterHandler.register(
        { adapter: 'nextjs-adapter', platform: 'nextjs', config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.adapter).toBe('nextjs-adapter');
        }
      }
    });

    it('should return duplicate for already registered adapter', async () => {
      const storage = createTestStorage();
      await platformAdapterHandler.register(
        { adapter: 'dup', platform: 'react', config: '{}' },
        storage,
      )();

      const result = await platformAdapterHandler.register(
        { adapter: 'dup', platform: 'react', config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('duplicate');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await platformAdapterHandler.register(
        { adapter: 'fail', platform: 'nextjs', config: '{}' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('mapNavigation', () => {
    it('should map push transition for nextjs platform', async () => {
      const storage = createTestStorage();
      await platformAdapterHandler.register(
        { adapter: 'nj', platform: 'nextjs', config: '{}' },
        storage,
      )();

      const result = await platformAdapterHandler.mapNavigation(
        { adapter: 'nj', transition: 'push' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.platformAction).toBe('router.push');
      }
    });

    it('should return unsupported for unknown transition', async () => {
      const storage = createTestStorage();
      await platformAdapterHandler.register(
        { adapter: 'nj2', platform: 'nextjs', config: '{}' },
        storage,
      )();

      const result = await platformAdapterHandler.mapNavigation(
        { adapter: 'nj2', transition: 'teleport' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unsupported');
      }
    });

    it('should return unsupported for unregistered adapter', async () => {
      const storage = createTestStorage();

      const result = await platformAdapterHandler.mapNavigation(
        { adapter: 'missing', transition: 'push' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unsupported');
      }
    });
  });

  describe('mapZone', () => {
    it('should map header zone for react platform', async () => {
      const storage = createTestStorage();
      await platformAdapterHandler.register(
        { adapter: 'ra', platform: 'react', config: '{}' },
        storage,
      )();

      const result = await platformAdapterHandler.mapZone(
        { adapter: 'ra', role: 'header' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.platformConfig).toContain('AppBar');
      }
    });

    it('should return unmapped for unknown zone role', async () => {
      const storage = createTestStorage();
      await platformAdapterHandler.register(
        { adapter: 'ra2', platform: 'react', config: '{}' },
        storage,
      )();

      const result = await platformAdapterHandler.mapZone(
        { adapter: 'ra2', role: 'unknown-zone' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unmapped');
      }
    });

    it('should return unmapped for unregistered adapter', async () => {
      const storage = createTestStorage();

      const result = await platformAdapterHandler.mapZone(
        { adapter: 'gone', role: 'header' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unmapped');
      }
    });
  });

  describe('handlePlatformEvent', () => {
    it('should handle a known event for swift platform', async () => {
      const storage = createTestStorage();
      await platformAdapterHandler.register(
        { adapter: 'sw', platform: 'swift', config: '{}' },
        storage,
      )();

      const result = await platformAdapterHandler.handlePlatformEvent(
        { adapter: 'sw', event: 'viewDidAppear' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.action).toBe('onAppear');
      }
    });

    it('should return ignored for unknown event', async () => {
      const storage = createTestStorage();
      await platformAdapterHandler.register(
        { adapter: 'sw2', platform: 'swift', config: '{}' },
        storage,
      )();

      const result = await platformAdapterHandler.handlePlatformEvent(
        { adapter: 'sw2', event: 'unknownEvent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ignored');
      }
    });

    it('should return ignored for unregistered adapter', async () => {
      const storage = createTestStorage();

      const result = await platformAdapterHandler.handlePlatformEvent(
        { adapter: 'gone', event: 'routeChange' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ignored');
      }
    });
  });
});
