// FileArtifact — handler.test.ts
// Unit tests for fileArtifact handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { fileArtifactHandler } from './handler.js';
import type { FileArtifactStorage } from './types.js';

const createTestStorage = (): FileArtifactStorage => {
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

const createFailingStorage = (): FileArtifactStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('FileArtifact handler', () => {
  describe('register', () => {
    it('should register a new file artifact', async () => {
      const storage = createTestStorage();
      const result = await fileArtifactHandler.register(
        { node: 'src/handler.ts', role: 'handler', language: 'typescript' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.artifact).toContain('fa:');
        }
      }
    });

    it('should return alreadyRegistered for duplicate node', async () => {
      const storage = createTestStorage();
      await fileArtifactHandler.register(
        { node: 'src/handler.ts', role: 'handler', language: 'typescript' },
        storage,
      )();
      const result = await fileArtifactHandler.register(
        { node: 'src/handler.ts', role: 'handler', language: 'typescript' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyRegistered');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fileArtifactHandler.register(
        { node: 'src/handler.ts', role: 'handler', language: 'typescript' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setProvenance', () => {
    it('should set provenance on an existing artifact', async () => {
      const storage = createTestStorage();
      await fileArtifactHandler.register(
        { node: 'src/handler.ts', role: 'handler', language: 'typescript' },
        storage,
      )();
      // setProvenance looks up by artifact key in fileartifact relation
      // The register stores using node as key, so we need the artifact key
      const result = await fileArtifactHandler.setProvenance(
        { artifact: 'src/handler.ts', spec: 'echo.concept.yaml', generator: 'NextjsGen' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent artifact', async () => {
      const storage = createTestStorage();
      const result = await fileArtifactHandler.setProvenance(
        { artifact: 'missing', spec: 'spec.yaml', generator: 'gen' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fileArtifactHandler.setProvenance(
        { artifact: 'test', spec: 'spec.yaml', generator: 'gen' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByRole', () => {
    it('should find artifacts by role', async () => {
      const storage = createTestStorage();
      await fileArtifactHandler.register(
        { node: 'src/handler.ts', role: 'handler', language: 'typescript' },
        storage,
      )();
      await fileArtifactHandler.register(
        { node: 'src/types.ts', role: 'types', language: 'typescript' },
        storage,
      )();
      const result = await fileArtifactHandler.findByRole(
        { role: 'handler' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.artifacts).toContain('fa:src/handler.ts');
      }
    });

    it('should return empty for unknown role', async () => {
      const storage = createTestStorage();
      const result = await fileArtifactHandler.findByRole(
        { role: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fileArtifactHandler.findByRole(
        { role: 'handler' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findGeneratedFrom', () => {
    it('should find artifacts generated from a spec', async () => {
      const storage = createTestStorage();
      await fileArtifactHandler.register(
        { node: 'src/handler.ts', role: 'handler', language: 'typescript' },
        storage,
      )();
      await fileArtifactHandler.setProvenance(
        { artifact: 'src/handler.ts', spec: 'echo.concept.yaml', generator: 'NextjsGen' },
        storage,
      )();
      const result = await fileArtifactHandler.findGeneratedFrom(
        { spec: 'echo.concept.yaml' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.artifacts).toContain('fa:src/handler.ts');
        }
      }
    });

    it('should return noGeneratedFiles when no artifacts match', async () => {
      const storage = createTestStorage();
      const result = await fileArtifactHandler.findGeneratedFrom(
        { spec: 'nonexistent.yaml' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noGeneratedFiles');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fileArtifactHandler.findGeneratedFrom(
        { spec: 'echo.concept.yaml' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should retrieve full metadata for a registered artifact', async () => {
      const storage = createTestStorage();
      await fileArtifactHandler.register(
        { node: 'src/handler.ts', role: 'handler', language: 'typescript' },
        storage,
      )();
      const result = await fileArtifactHandler.get(
        { artifact: 'src/handler.ts' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.node).toBe('src/handler.ts');
          expect(result.right.role).toBe('handler');
          expect(result.right.language).toBe('typescript');
          expect(result.right.encoding).toBe('utf-8');
        }
      }
    });

    it('should return notfound for nonexistent artifact', async () => {
      const storage = createTestStorage();
      const result = await fileArtifactHandler.get(
        { artifact: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fileArtifactHandler.get(
        { artifact: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
