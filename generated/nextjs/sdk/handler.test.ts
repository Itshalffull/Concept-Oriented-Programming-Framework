// Sdk — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { sdkHandler } from './handler.js';
import type { SdkStorage } from './types.js';

const createTestStorage = (): SdkStorage => {
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

const createFailingStorage = (): SdkStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = sdkHandler;

describe('Sdk handler', () => {
  describe('generate', () => {
    it('should generate a TypeScript SDK package', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { projection: 'order', language: 'typescript', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.package).toBe('@clef-sdk/order-typescript');
          expect(result.right.files.length).toBeGreaterThan(0);
          expect(result.right.files).toContain('src/client.ts');
          expect(result.right.files).toContain('src/types.ts');
          expect(result.right.files).toContain('src/index.ts');
          const pkg = JSON.parse(result.right.packageJson);
          expect(pkg.name).toBe('@clef-sdk/order-typescript');
        }
      }
    });

    it('should generate a Python SDK package', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { projection: 'user', language: 'python', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.files).toContain('src/client.py');
        }
      }
    });

    it('should return languageError for unsupported language', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { projection: 'order', language: 'cobol', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('languageError');
        if (result.right.variant === 'languageError') {
          expect(result.right.language).toBe('cobol');
        }
      }
    });

    it('should return unsupportedType for generic custom types', async () => {
      const storage = createTestStorage();
      const config = JSON.stringify({ customTypes: ['Map<string, number>'] });
      const result = await handler.generate(
        { projection: 'order', language: 'typescript', config },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unsupportedType');
        if (result.right.variant === 'unsupportedType') {
          expect(result.right.typeName).toBe('Map<string, number>');
        }
      }
    });

    it('should use custom version from config', async () => {
      const storage = createTestStorage();
      const config = JSON.stringify({ version: '2.0.0' });
      const result = await handler.generate(
        { projection: 'order', language: 'typescript', config },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const pkg = JSON.parse(result.right.packageJson);
        expect(pkg.version).toBe('2.0.0');
      }
    });

    it('should persist package record to storage', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { projection: 'order', language: 'rust', config: '{}' },
        storage,
      )();
      const stored = await storage.get('packages', '@clef-sdk/order-rust');
      expect(stored).not.toBeNull();
      expect(stored!['language']).toBe('rust');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.generate(
        { projection: 'x', language: 'typescript', config: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('publish', () => {
    it('should publish a generated package to a known registry', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { projection: 'order', language: 'typescript', config: '{}' },
        storage,
      )();
      const result = await handler.publish(
        { package: '@clef-sdk/order-typescript', registry: 'npm' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.package).toBe('@clef-sdk/order-typescript');
          expect(result.right.publishedVersion).toBe('0.1.0');
        }
      }
    });

    it('should return versionExists when already published', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { projection: 'order', language: 'typescript', config: '{}' },
        storage,
      )();
      await handler.publish(
        { package: '@clef-sdk/order-typescript', registry: 'npm' },
        storage,
      )();
      const result = await handler.publish(
        { package: '@clef-sdk/order-typescript', registry: 'npm' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('versionExists');
      }
    });

    it('should return registryUnavailable for unknown registry', async () => {
      const storage = createTestStorage();
      const result = await handler.publish(
        { package: 'anything', registry: 'unknown-registry' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('registryUnavailable');
      }
    });

    it('should accept URL-based registries', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { projection: 'order', language: 'typescript', config: '{}' },
        storage,
      )();
      const result = await handler.publish(
        { package: '@clef-sdk/order-typescript', registry: 'https://registry.example.com' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.publish(
        { package: 'x', registry: 'npm' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
