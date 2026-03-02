// Token — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { tokenHandler } from './handler.js';
import type { TokenStorage } from './types.js';

const createTestStorage = (): TokenStorage => {
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

const createFailingStorage = (): TokenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Token handler', () => {
  describe('replace', () => {
    it('should replace token placeholders with resolved values', async () => {
      const storage = createTestStorage();
      await storage.put('token_providers', 'site.name', {
        token: 'site.name',
        provider: 'config',
      });
      await storage.put('token_values', 'config::site.name::web', {
        value: 'My Site',
      });

      const result = await tokenHandler.replace(
        { text: 'Welcome to [token:site.name]!', context: 'web' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.result).toBe('Welcome to My Site!');
      }
    });

    it('should leave unresolvable tokens in place', async () => {
      const storage = createTestStorage();

      const result = await tokenHandler.replace(
        { text: 'Hello [token:unknown]!', context: 'web' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.result).toBe('Hello [token:unknown]!');
      }
    });

    it('should use wildcard fallback when context-specific value is missing', async () => {
      const storage = createTestStorage();
      await storage.put('token_providers', 'app.title', {
        token: 'app.title',
        provider: 'env',
      });
      await storage.put('token_values', 'env::app.title::*', {
        value: 'Default App',
      });

      const result = await tokenHandler.replace(
        { text: '[token:app.title]', context: 'cli' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.result).toBe('Default App');
      }
    });

    it('should handle text with no tokens', async () => {
      const storage = createTestStorage();

      const result = await tokenHandler.replace(
        { text: 'No tokens here.', context: 'web' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.result).toBe('No tokens here.');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await tokenHandler.replace(
        { text: '[token:x]', context: 'web' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getAvailableTokens', () => {
    it('should list tokens available in a context', async () => {
      const storage = createTestStorage();
      await storage.put('token_providers', 'site.name', {
        token: 'site.name',
        provider: 'config',
      });
      await storage.put('token_values', 'config::site.name::web', {
        value: 'My Site',
      });

      const result = await tokenHandler.getAvailableTokens(
        { context: 'web' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const tokens = JSON.parse(result.right.tokens);
        expect(tokens).toContain('site.name');
      }
    });

    it('should return empty list when no tokens match the context', async () => {
      const storage = createTestStorage();
      await storage.put('token_providers', 'site.name', {
        token: 'site.name',
        provider: 'config',
      });

      const result = await tokenHandler.getAvailableTokens(
        { context: 'cli' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const tokens = JSON.parse(result.right.tokens);
        expect(tokens).toHaveLength(0);
      }
    });
  });

  describe('scan', () => {
    it('should find token patterns in text', async () => {
      const storage = createTestStorage();

      const result = await tokenHandler.scan(
        { text: 'Hello [token:name], your role is [token:role]. [token:name]' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const found = JSON.parse(result.right.found);
        expect(found).toContain('name');
        expect(found).toContain('role');
        // Deduplicated
        expect(found.filter((f: string) => f === 'name').length).toBe(1);
      }
    });

    it('should return empty array when no tokens found', async () => {
      const storage = createTestStorage();

      const result = await tokenHandler.scan(
        { text: 'No tokens here.' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const found = JSON.parse(result.right.found);
        expect(found).toHaveLength(0);
      }
    });
  });

  describe('registerProvider', () => {
    it('should register a new token provider', async () => {
      const storage = createTestStorage();

      const result = await tokenHandler.registerProvider(
        { token: 'site.name', provider: 'config' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists for a duplicate registration', async () => {
      const storage = createTestStorage();
      await storage.put('token_providers', 'site.name', {
        token: 'site.name',
        provider: 'config',
      });

      const result = await tokenHandler.registerProvider(
        { token: 'site.name', provider: 'other' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await tokenHandler.registerProvider(
        { token: 'x', provider: 'y' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
