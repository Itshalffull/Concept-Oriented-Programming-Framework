// RustToolchain — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { rustToolchainHandler } from './handler.js';
import type { RustToolchainStorage } from './types.js';

const createTestStorage = (): RustToolchainStorage => {
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

const createFailingStorage = (): RustToolchainStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = rustToolchainHandler;

describe('RustToolchain handler', () => {
  describe('resolve', () => {
    it('should return notInstalled when no rust installation found', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve(
        { platform: 'linux-x86_64', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notInstalled');
      }
    });

    it('should return targetMissing when installation exists but target is not installed', async () => {
      const storage = createTestStorage();
      await storage.put('rust-installations', 'default', { version: '1.75.0', rustcPath: '/usr/local/bin/rustc' });
      const result = await handler.resolve(
        { platform: 'wasm32', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('targetMissing');
        if (result.right.variant === 'targetMissing') {
          expect(result.right.target).toBe('wasm32-unknown-unknown');
        }
      }
    });

    it('should resolve successfully when installation and target exist', async () => {
      const storage = createTestStorage();
      await storage.put('rust-installations', 'default', { version: '1.75.0', rustcPath: '/usr/local/bin/rustc' });
      await storage.put('rust-targets', 'x86_64-unknown-linux-gnu', { installed: true });
      const result = await handler.resolve(
        { platform: 'linux-x86_64', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.version).toBe('1.75.0');
          expect(result.right.capabilities.length).toBeGreaterThan(0);
        }
      }
    });

    it('should reject when version constraint is not met', async () => {
      const storage = createTestStorage();
      await storage.put('rust-installations', 'default', { version: '1.60.0', rustcPath: '/usr/local/bin/rustc' });
      const result = await handler.resolve(
        { platform: 'linux-x86_64', versionConstraint: O.some('1.75.0') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notInstalled');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.resolve({ platform: 'linux-x86_64', versionConstraint: O.none }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('register', () => {
    it('should return toolchain registration info', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('rust-toolchain');
        expect(result.right.language).toBe('rust');
        expect(result.right.capabilities.length).toBeGreaterThan(0);
      }
    });
  });
});
