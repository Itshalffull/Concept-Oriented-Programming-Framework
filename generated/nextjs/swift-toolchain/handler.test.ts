// SwiftToolchain — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { swiftToolchainHandler } from './handler.js';
import type { SwiftToolchainStorage } from './types.js';

const createTestStorage = (): SwiftToolchainStorage => {
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

const createFailingStorage = (): SwiftToolchainStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = swiftToolchainHandler;

describe('SwiftToolchain handler', () => {
  describe('resolve', () => {
    it('should return notInstalled when no Swift installation found for linux', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve(
        { platform: 'linux-x86_64', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notInstalled');
        if (result.right.variant === 'notInstalled') {
          expect(result.right.installHint).toContain('swift.org');
        }
      }
    });

    it('should return notInstalled with Xcode hint for darwin platform', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve(
        { platform: 'darwin-arm64', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notInstalled');
        if (result.right.variant === 'notInstalled') {
          expect(result.right.installHint).toContain('Xcode');
        }
      }
    });

    it('should resolve toolchain when installation exists', async () => {
      const storage = createTestStorage();
      await storage.put('swift-installations', 'linux-x86_64', {
        version: '5.9.0',
        swiftcPath: '/opt/swift/bin/swiftc',
      });
      const result = await handler.resolve(
        { platform: 'linux-x86_64', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.version).toBe('5.9.0');
          expect(result.right.swiftcPath).toBe('/opt/swift/bin/swiftc');
          expect(result.right.capabilities).toContain('compile');
        }
      }
    });

    it('should fail version constraint check', async () => {
      const storage = createTestStorage();
      await storage.put('swift-installations', 'linux-x86_64', {
        version: '5.5.0',
        swiftcPath: '/usr/bin/swiftc',
      });
      const result = await handler.resolve(
        { platform: 'linux-x86_64', versionConstraint: O.some('5.9') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notInstalled');
      }
    });

    it('should pass version constraint when version matches', async () => {
      const storage = createTestStorage();
      await storage.put('swift-installations', 'linux-x86_64', {
        version: '5.9.2',
        swiftcPath: '/usr/bin/swiftc',
      });
      const result = await handler.resolve(
        { platform: 'linux-x86_64', versionConstraint: O.some('5.9') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return xcodeRequired for iOS platform when Xcode not installed', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve(
        { platform: 'ios-arm64', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('xcodeRequired');
      }
    });

    it('should resolve iOS platform when Xcode is installed', async () => {
      const storage = createTestStorage();
      await storage.put('xcode-installations', 'ios-arm64', { version: '15.0' });
      await storage.put('swift-installations', 'ios-arm64', {
        version: '5.9.0',
        swiftcPath: '/usr/bin/swiftc',
      });
      const result = await handler.resolve(
        { platform: 'ios-arm64', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should persist resolved toolchain to storage', async () => {
      const storage = createTestStorage();
      await storage.put('swift-installations', 'linux-x86_64', {
        version: '5.9.0',
        swiftcPath: '/usr/bin/swiftc',
      });
      await handler.resolve(
        { platform: 'linux-x86_64', versionConstraint: O.none },
        storage,
      )();
      const resolved = await storage.get('resolved-toolchains', 'swift-5.9.0-linux-x86_64');
      expect(resolved).not.toBeNull();
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.resolve(
        { platform: 'linux-x86_64', versionConstraint: O.none },
        storage,
      )();
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
        expect(result.right.name).toBe('swift-toolchain');
        expect(result.right.language).toBe('swift');
        expect(result.right.capabilities).toContain('concurrency');
      }
    });
  });
});
