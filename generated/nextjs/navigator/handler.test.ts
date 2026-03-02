// Navigator — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { navigatorHandler } from './handler.js';
import type { NavigatorStorage } from './types.js';

const createTestStorage = (): NavigatorStorage => {
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

const createFailingStorage = (): NavigatorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = navigatorHandler;

describe('Navigator handler', () => {
  describe('register', () => {
    it('should register a new route', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        {
          nav: '/home',
          name: 'Home',
          targetConcept: 'HomePage',
          targetView: 'default',
          paramsSchema: O.none,
          meta: O.none,
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.nav).toBe('/home');
        }
      }
    });

    it('should return duplicate for existing route', async () => {
      const storage = createTestStorage();
      await handler.register(
        {
          nav: '/dup',
          name: 'Dup',
          targetConcept: 'C',
          targetView: 'v',
          paramsSchema: O.none,
          meta: O.none,
        },
        storage,
      )();
      const result = await handler.register(
        {
          nav: '/dup',
          name: 'Dup2',
          targetConcept: 'C2',
          targetView: 'v2',
          paramsSchema: O.none,
          meta: O.none,
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('duplicate');
      }
    });
  });

  describe('go', () => {
    it('should navigate to a registered route', async () => {
      const storage = createTestStorage();
      await handler.register(
        {
          nav: '/dashboard',
          name: 'Dashboard',
          targetConcept: 'Dashboard',
          targetView: 'main',
          paramsSchema: O.none,
          meta: O.none,
        },
        storage,
      )();
      const result = await handler.go(
        { nav: '/dashboard', params: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.nav).toBe('/dashboard');
        }
      }
    });

    it('should return notfound for unregistered route', async () => {
      const storage = createTestStorage();
      const result = await handler.go(
        { nav: '/unknown', params: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return blocked when guard blocks navigation', async () => {
      const storage = createTestStorage();
      await handler.register(
        {
          nav: '/admin',
          name: 'Admin',
          targetConcept: 'Admin',
          targetView: 'main',
          paramsSchema: O.none,
          meta: O.none,
        },
        storage,
      )();
      await handler.addGuard(
        { nav: '/admin', guard: 'isAdmin' },
        storage,
      )();
      const result = await handler.go(
        { nav: '/admin', params: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('blocked');
        if (result.right.variant === 'blocked') {
          expect(result.right.reason).toContain('isAdmin');
        }
      }
    });

    it('should build navigation history', async () => {
      const storage = createTestStorage();
      await handler.register(
        { nav: '/a', name: 'A', targetConcept: 'A', targetView: 'v', paramsSchema: O.none, meta: O.none },
        storage,
      )();
      await handler.register(
        { nav: '/b', name: 'B', targetConcept: 'B', targetView: 'v', paramsSchema: O.none, meta: O.none },
        storage,
      )();
      await handler.go({ nav: '/a', params: O.none }, storage)();
      await handler.go({ nav: '/b', params: O.none }, storage)();
      // Back stack should have /a
      const backResult = await handler.back({ nav: '/b' }, storage)();
      expect(E.isRight(backResult)).toBe(true);
      if (E.isRight(backResult)) {
        expect(backResult.right.variant).toBe('ok');
      }
    });
  });

  describe('back', () => {
    it('should go back to previous route', async () => {
      const storage = createTestStorage();
      await handler.register(
        { nav: '/page1', name: 'P1', targetConcept: 'P', targetView: 'v', paramsSchema: O.none, meta: O.none },
        storage,
      )();
      await handler.register(
        { nav: '/page2', name: 'P2', targetConcept: 'P', targetView: 'v', paramsSchema: O.none, meta: O.none },
        storage,
      )();
      await handler.go({ nav: '/page1', params: O.none }, storage)();
      await handler.go({ nav: '/page2', params: O.none }, storage)();
      const result = await handler.back({ nav: '/page2' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return empty when no history', async () => {
      const storage = createTestStorage();
      const result = await handler.back({ nav: '/any' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('empty');
      }
    });
  });

  describe('forward', () => {
    it('should return empty when no forward history', async () => {
      const storage = createTestStorage();
      const result = await handler.forward({ nav: '/any' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('empty');
      }
    });

    it('should go forward after going back', async () => {
      const storage = createTestStorage();
      await handler.register(
        { nav: '/x', name: 'X', targetConcept: 'X', targetView: 'v', paramsSchema: O.none, meta: O.none },
        storage,
      )();
      await handler.register(
        { nav: '/y', name: 'Y', targetConcept: 'Y', targetView: 'v', paramsSchema: O.none, meta: O.none },
        storage,
      )();
      await handler.go({ nav: '/x', params: O.none }, storage)();
      await handler.go({ nav: '/y', params: O.none }, storage)();
      await handler.back({ nav: '/y' }, storage)();
      const result = await handler.forward({ nav: '/x' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('replace', () => {
    it('should replace current route without affecting history', async () => {
      const storage = createTestStorage();
      await handler.register(
        { nav: '/old', name: 'Old', targetConcept: 'O', targetView: 'v', paramsSchema: O.none, meta: O.none },
        storage,
      )();
      await handler.register(
        { nav: '/new', name: 'New', targetConcept: 'N', targetView: 'v', paramsSchema: O.none, meta: O.none },
        storage,
      )();
      await handler.go({ nav: '/old', params: O.none }, storage)();
      const result = await handler.replace({ nav: '/new', params: O.none }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for unregistered route', async () => {
      const storage = createTestStorage();
      const result = await handler.replace(
        { nav: '/nonexistent', params: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('addGuard', () => {
    it('should add a guard to a registered route', async () => {
      const storage = createTestStorage();
      await handler.register(
        { nav: '/protected', name: 'P', targetConcept: 'P', targetView: 'v', paramsSchema: O.none, meta: O.none },
        storage,
      )();
      const result = await handler.addGuard(
        { nav: '/protected', guard: 'authGuard' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid for non-existent route', async () => {
      const storage = createTestStorage();
      const result = await handler.addGuard(
        { nav: '/missing', guard: 'guard' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });
  });

  describe('removeGuard', () => {
    it('should remove an existing guard', async () => {
      const storage = createTestStorage();
      await handler.register(
        { nav: '/guarded', name: 'G', targetConcept: 'G', targetView: 'v', paramsSchema: O.none, meta: O.none },
        storage,
      )();
      await handler.addGuard({ nav: '/guarded', guard: 'myGuard' }, storage)();
      const result = await handler.removeGuard(
        { nav: '/guarded', guard: 'myGuard' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for non-existent guard', async () => {
      const storage = createTestStorage();
      const result = await handler.removeGuard(
        { nav: '/any', guard: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
