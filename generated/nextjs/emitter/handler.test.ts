// Emitter — handler.test.ts
// Unit tests for emitter handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { emitterHandler } from './handler.js';
import type { EmitterStorage } from './types.js';

const createTestStorage = (): EmitterStorage => {
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

const createFailingStorage = (): EmitterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Emitter handler', () => {
  describe('write', () => {
    it('should write a file and return written=true', async () => {
      const storage = createTestStorage();
      const result = await emitterHandler.write(
        { path: 'src/index.ts', content: 'export default 42;', formatHint: O.none, sources: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.written).toBe(true);
          expect(result.right.path).toBe('src/index.ts');
          expect(result.right.contentHash).toBeTruthy();
        }
      }
    });

    it('should skip write when content hash is unchanged', async () => {
      const storage = createTestStorage();
      await emitterHandler.write(
        { path: 'src/index.ts', content: 'export default 42;', formatHint: O.none, sources: O.none },
        storage,
      )();
      const result = await emitterHandler.write(
        { path: 'src/index.ts', content: 'export default 42;', formatHint: O.none, sources: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.written).toBe(false);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await emitterHandler.write(
        { path: 'src/index.ts', content: 'hello', formatHint: O.none, sources: O.none },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('writeBatch', () => {
    it('should write multiple files', async () => {
      const storage = createTestStorage();
      const result = await emitterHandler.writeBatch(
        {
          files: [
            { path: 'a.ts', content: 'a', formatHint: O.none, sources: O.none },
            { path: 'b.ts', content: 'b', formatHint: O.none, sources: O.none },
          ],
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.results.length).toBe(2);
          expect(result.right.results[0].written).toBe(true);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await emitterHandler.writeBatch(
        { files: [{ path: 'a.ts', content: 'a', formatHint: O.none, sources: O.none }] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('format', () => {
    it('should return changed=true when no formatHint was set', async () => {
      const storage = createTestStorage();
      await emitterHandler.write(
        { path: 'src/index.ts', content: 'export default 42;', formatHint: O.none, sources: O.none },
        storage,
      )();
      const result = await emitterHandler.format(
        { path: 'src/index.ts' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.changed).toBe(true);
        }
      }
    });

    it('should return error for unknown file', async () => {
      const storage = createTestStorage();
      const result = await emitterHandler.format(
        { path: 'nonexistent.ts' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });
  });

  describe('clean', () => {
    it('should remove files not in the manifest', async () => {
      const storage = createTestStorage();
      await emitterHandler.write(
        { path: 'keep.ts', content: 'keep', formatHint: O.none, sources: O.none },
        storage,
      )();
      await emitterHandler.write(
        { path: 'remove.ts', content: 'remove', formatHint: O.none, sources: O.none },
        storage,
      )();
      const result = await emitterHandler.clean(
        { outputDir: 'out', currentManifest: ['keep.ts'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.removed).toContain('remove.ts');
      }
    });
  });

  describe('manifest', () => {
    it('should return a list of emitted files', async () => {
      const storage = createTestStorage();
      await emitterHandler.write(
        { path: 'a.ts', content: 'content-a', formatHint: O.none, sources: O.none },
        storage,
      )();
      const result = await emitterHandler.manifest(
        { outputDir: 'out' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.files.length).toBeGreaterThan(0);
      }
    });
  });

  describe('trace', () => {
    it('should return sources for an emitted file', async () => {
      const storage = createTestStorage();
      await emitterHandler.write(
        {
          path: 'out.ts',
          content: 'generated',
          formatHint: O.none,
          sources: O.some([{ sourcePath: 'spec.yaml', sourceRange: O.none, conceptName: O.some('Echo'), actionName: O.some('send') }]),
        },
        storage,
      )();
      const result = await emitterHandler.trace(
        { outputPath: 'out.ts' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.sources.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return notFound for unknown file', async () => {
      const storage = createTestStorage();
      const result = await emitterHandler.trace(
        { outputPath: 'nonexistent.ts' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });
  });

  describe('affected', () => {
    it('should find outputs affected by a source path', async () => {
      const storage = createTestStorage();
      await emitterHandler.write(
        {
          path: 'out.ts',
          content: 'generated',
          formatHint: O.none,
          sources: O.some([{ sourcePath: 'spec.yaml', sourceRange: O.none, conceptName: O.none, actionName: O.none }]),
        },
        storage,
      )();
      const result = await emitterHandler.affected(
        { sourcePath: 'spec.yaml' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.outputs).toContain('out.ts');
      }
    });
  });

  describe('audit', () => {
    it('should audit emitted files as current', async () => {
      const storage = createTestStorage();
      await emitterHandler.write(
        { path: 'file.ts', content: 'content', formatHint: O.none, sources: O.none },
        storage,
      )();
      const result = await emitterHandler.audit(
        { outputDir: 'out' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.status.length).toBeGreaterThan(0);
        expect(result.right.status[0].state).toBe('current');
      }
    });
  });
});
