// TypeScriptToolchain — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { typeScriptToolchainHandler } from './handler.js';
import type { TypeScriptToolchainStorage } from './types.js';

const createTestStorage = (): TypeScriptToolchainStorage => {
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

const createFailingStorage = (): TypeScriptToolchainStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = typeScriptToolchainHandler;

describe('TypeScriptToolchain handler', () => {
  describe('resolve', () => {
    it('should return notInstalled when no installation found', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve(
        { platform: 'linux', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notInstalled');
        if (result.right.variant === 'notInstalled') {
          expect(result.right.installHint).toContain('npm install');
        }
      }
    });

    it('should resolve a valid installation', async () => {
      const storage = createTestStorage();
      await storage.put('typescript-installations', 'linux', {
        tscVersion: '5.3.0',
        tscPath: '/usr/local/bin/tsc',
        nodeVersion: '20.0.0',
      });

      const result = await handler.resolve(
        { platform: 'linux', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.version).toBe('5.3.0');
          expect(result.right.tscPath).toBe('/usr/local/bin/tsc');
          expect(result.right.capabilities.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return notInstalled when version constraint not met', async () => {
      const storage = createTestStorage();
      await storage.put('typescript-installations', 'linux', {
        tscVersion: '4.9.0',
        tscPath: '/usr/local/bin/tsc',
        nodeVersion: '18.0.0',
      });

      const result = await handler.resolve(
        { platform: 'linux', versionConstraint: O.some('5.0.0') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notInstalled');
      }
    });

    it('should return nodeVersionMismatch when Node.js is too old', async () => {
      const storage = createTestStorage();
      await storage.put('typescript-installations', 'linux', {
        tscVersion: '5.3.0',
        tscPath: '/usr/local/bin/tsc',
        nodeVersion: '14.0.0',
      });

      const result = await handler.resolve(
        { platform: 'linux', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('nodeVersionMismatch');
        if (result.right.variant === 'nodeVersionMismatch') {
          expect(result.right.installed).toBe('14.0.0');
          expect(result.right.required).toBe('18.0.0');
        }
      }
    });

    it('should persist resolved toolchain to storage', async () => {
      const storage = createTestStorage();
      await storage.put('typescript-installations', 'linux', {
        tscVersion: '5.3.0',
        tscPath: '/usr/local/bin/tsc',
        nodeVersion: '20.0.0',
      });

      const result = await handler.resolve(
        { platform: 'linux', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const toolchain = await storage.get('resolved-toolchains', result.right.toolchain);
        expect(toolchain).not.toBeNull();
        expect(toolchain?.version).toBe('5.3.0');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.resolve(
        { platform: 'linux', versionConstraint: O.none },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('register', () => {
    it('should return registration metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('typescript-toolchain');
        expect(result.right.language).toBe('typescript');
        expect(result.right.capabilities).toContain('type-checking');
        expect(result.right.capabilities).toContain('declaration-emit');
      }
    });
  });
});
