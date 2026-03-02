// SwiftGen — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { swiftGenHandler } from './handler.js';
import type { SwiftGenStorage } from './types.js';

const createTestStorage = (): SwiftGenStorage => {
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

const createFailingStorage = (): SwiftGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = swiftGenHandler;

const validManifest = {
  name: 'user-profile',
  operations: [
    {
      name: 'create',
      input: [
        { name: 'name', type: 'string' },
        { name: 'age', type: 'integer' },
      ],
      output: [
        { variant: 'ok', fields: [{ name: 'id', type: 'string' }] },
        { variant: 'error', fields: [{ name: 'message', type: 'string' }] },
      ],
    },
  ],
};

describe('SwiftGen handler', () => {
  describe('generate', () => {
    it('should generate Swift protocol and types files', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { spec: 'user-profile.concept', manifest: validManifest },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.files.length).toBe(2);
          const paths = result.right.files.map((f) => f.path);
          expect(paths).toContain('UserProfile/Handler.swift');
          expect(paths).toContain('UserProfile/Types.swift');
        }
      }
    });

    it('should generate protocol with correct method signatures', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { spec: 'user-profile.concept', manifest: validManifest },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const handlerFile = result.right.files.find((f) => f.path.endsWith('Handler.swift'));
        expect(handlerFile).toBeDefined();
        expect(handlerFile!.content).toContain('protocol UserProfileHandler');
        expect(handlerFile!.content).toContain('func create');
        expect(handlerFile!.content).toContain('UserProfileCreateInput');
        expect(handlerFile!.content).toContain('UserProfileCreateOutput');
      }
    });

    it('should generate types with correct Swift type mappings', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { spec: 'user-profile.concept', manifest: validManifest },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const typesFile = result.right.files.find((f) => f.path.endsWith('Types.swift'));
        expect(typesFile).toBeDefined();
        expect(typesFile!.content).toContain('let name: String');
        expect(typesFile!.content).toContain('let age: Int');
        expect(typesFile!.content).toContain('enum UserProfileCreateOutput');
        expect(typesFile!.content).toContain('case ok');
        expect(typesFile!.content).toContain('case error');
      }
    });

    it('should return error for null manifest', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { spec: 'test.concept', manifest: null },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for manifest without name', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { spec: 'test.concept', manifest: { operations: [] } },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should persist generation metadata to storage', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { spec: 'user-profile.concept', manifest: validManifest },
        storage,
      )();
      const stored = await storage.get('generated', 'user-profile.concept');
      expect(stored).not.toBeNull();
      expect(stored?.language).toBe('swift');
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.generate(
        { spec: 'user-profile.concept', manifest: validManifest },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('register', () => {
    it('should return registration with capabilities', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('swift-gen');
        expect(result.right.inputKind).toBe('concept-ast');
        expect(result.right.outputKind).toBe('swift');
        expect(result.right.capabilities).toContain('protocols');
        expect(result.right.capabilities).toContain('async-await');
      }
    });
  });
});
