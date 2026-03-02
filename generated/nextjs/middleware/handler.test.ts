// Middleware — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { middlewareHandler } from './handler.js';
import type { MiddlewareStorage } from './types.js';

const createTestStorage = (): MiddlewareStorage => {
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

const createFailingStorage = (): MiddlewareStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = middlewareHandler;

describe('Middleware handler', () => {
  describe('register', () => {
    it('should register a middleware implementation', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        {
          trait: 'auth',
          target: 'api',
          implementation: 'authMiddleware',
          position: 'before',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.middleware).toContain('auth');
        }
      }
    });

    it('should return duplicateRegistration for same trait+target', async () => {
      const storage = createTestStorage();
      await handler.register(
        {
          trait: 'logging',
          target: 'api',
          implementation: 'logMiddleware',
          position: 'first',
        },
        storage,
      )();
      const result = await handler.register(
        {
          trait: 'logging',
          target: 'api',
          implementation: 'logMiddleware2',
          position: 'last',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('duplicateRegistration');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.register(
        {
          trait: 'fail',
          target: 'api',
          implementation: 'failMw',
          position: 'first',
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resolve', () => {
    it('should resolve a middleware chain for registered traits', async () => {
      const storage = createTestStorage();
      await handler.register(
        { trait: 'auth', target: 'api', implementation: 'authMw', position: 'before' },
        storage,
      )();
      await handler.register(
        { trait: 'cors', target: 'api', implementation: 'corsMw', position: 'after' },
        storage,
      )();
      const result = await handler.resolve(
        { traits: ['auth', 'cors'], target: 'api' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.middlewares).toHaveLength(2);
          // auth (before=0) should come before cors (after=999)
          expect(result.right.middlewares[0]).toBe('authMw');
          expect(result.right.middlewares[1]).toBe('corsMw');
        }
      }
    });

    it('should return missingImplementation for unregistered trait', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve(
        { traits: ['unregistered'], target: 'api' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('missingImplementation');
      }
    });

    it('should return incompatibleTraits for conflicting traits', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve(
        { traits: ['cache', 'no-cache'], target: 'api' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompatibleTraits');
        if (result.right.variant === 'incompatibleTraits') {
          expect(result.right.trait1).toBe('cache');
          expect(result.right.trait2).toBe('no-cache');
        }
      }
    });

    it('should detect auth-required vs public-only incompatibility', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve(
        { traits: ['auth-required', 'public-only'], target: 'api' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompatibleTraits');
      }
    });
  });

  describe('inject', () => {
    it('should inject middleware markers into output', async () => {
      const storage = createTestStorage();
      const result = await handler.inject(
        {
          output: 'const app = express();',
          middlewares: ['authMiddleware', 'corsMiddleware'],
          target: 'api',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.injectedCount).toBe(2);
        expect(result.right.output).toContain('/* middleware:authMiddleware */');
        expect(result.right.output).toContain('/* middleware:corsMiddleware */');
      }
    });
  });
});
