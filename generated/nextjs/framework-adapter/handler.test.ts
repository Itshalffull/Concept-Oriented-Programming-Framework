// FrameworkAdapter — handler.test.ts
// Unit tests for frameworkAdapter handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { frameworkAdapterHandler } from './handler.js';
import type { FrameworkAdapterStorage } from './types.js';

const createTestStorage = (): FrameworkAdapterStorage => {
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

const createFailingStorage = (): FrameworkAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const registerAdapter = async (storage: FrameworkAdapterStorage, renderer = 'react-renderer') => {
  await frameworkAdapterHandler.register(
    { renderer, framework: 'react', version: '18.0', normalizer: 'camelCase', mountFn: 'createRoot' },
    storage,
  )();
};

describe('FrameworkAdapter handler', () => {
  describe('register', () => {
    it('should register a new adapter', async () => {
      const storage = createTestStorage();
      const result = await frameworkAdapterHandler.register(
        { renderer: 'react-renderer', framework: 'react', version: '18.0', normalizer: 'camelCase', mountFn: 'createRoot' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.renderer).toBe('react-renderer');
        }
      }
    });

    it('should return duplicate for existing adapter', async () => {
      const storage = createTestStorage();
      await registerAdapter(storage);
      const result = await frameworkAdapterHandler.register(
        { renderer: 'react-renderer', framework: 'react', version: '18.0', normalizer: 'camelCase', mountFn: 'createRoot' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('duplicate');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await frameworkAdapterHandler.register(
        { renderer: 'r', framework: 'f', version: '1', normalizer: 'n', mountFn: 'm' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('normalize', () => {
    it('should normalize props through a registered adapter', async () => {
      const storage = createTestStorage();
      await registerAdapter(storage);
      const result = await frameworkAdapterHandler.normalize(
        { renderer: 'react-renderer', props: '{"className":"test"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.normalizer).toBe('camelCase');
        }
      }
    });

    it('should return notfound for unregistered adapter', async () => {
      const storage = createTestStorage();
      const result = await frameworkAdapterHandler.normalize(
        { renderer: 'missing', props: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await frameworkAdapterHandler.normalize(
        { renderer: 'r', props: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('mount', () => {
    it('should mount a registered adapter to a target', async () => {
      const storage = createTestStorage();
      await registerAdapter(storage);
      const result = await frameworkAdapterHandler.mount(
        { renderer: 'react-renderer', machine: 'state-machine-1', target: '#app' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return error for unregistered adapter', async () => {
      const storage = createTestStorage();
      const result = await frameworkAdapterHandler.mount(
        { renderer: 'missing', machine: 'sm', target: '#app' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error when already mounted to same target', async () => {
      const storage = createTestStorage();
      await registerAdapter(storage);
      await frameworkAdapterHandler.mount(
        { renderer: 'react-renderer', machine: 'sm', target: '#app' },
        storage,
      )();
      const result = await frameworkAdapterHandler.mount(
        { renderer: 'react-renderer', machine: 'sm', target: '#app' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await frameworkAdapterHandler.mount(
        { renderer: 'r', machine: 'sm', target: '#app' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('render', () => {
    it('should render through a mounted adapter', async () => {
      const storage = createTestStorage();
      await registerAdapter(storage);
      await frameworkAdapterHandler.mount(
        { renderer: 'react-renderer', machine: 'sm', target: '#app' },
        storage,
      )();
      const result = await frameworkAdapterHandler.render(
        { adapter: 'react-renderer', props: '{"text":"hi"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return error for unregistered adapter', async () => {
      const storage = createTestStorage();
      const result = await frameworkAdapterHandler.render(
        { adapter: 'missing', props: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await frameworkAdapterHandler.render(
        { adapter: 'r', props: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('unmount', () => {
    it('should unmount a mounted adapter', async () => {
      const storage = createTestStorage();
      await registerAdapter(storage);
      await frameworkAdapterHandler.mount(
        { renderer: 'react-renderer', machine: 'sm', target: '#app' },
        storage,
      )();
      const result = await frameworkAdapterHandler.unmount(
        { renderer: 'react-renderer', target: '#app' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when not mounted', async () => {
      const storage = createTestStorage();
      const result = await frameworkAdapterHandler.unmount(
        { renderer: 'react-renderer', target: '#app' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await frameworkAdapterHandler.unmount(
        { renderer: 'r', target: '#app' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
