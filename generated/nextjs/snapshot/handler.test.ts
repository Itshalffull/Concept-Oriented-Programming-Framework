// Snapshot — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { snapshotHandler } from './handler.js';
import type { SnapshotStorage } from './types.js';

const createTestStorage = (): SnapshotStorage => {
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

const createFailingStorage = (): SnapshotStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = snapshotHandler;

describe('Snapshot handler', () => {
  describe('compare', () => {
    it('should return new for first-time snapshot', async () => {
      const storage = createTestStorage();
      const result = await handler.compare(
        { outputPath: 'src/app.tsx', currentContent: 'const App = () => {}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('new');
        if (result.right.variant === 'new') {
          expect(result.right.path).toBe('src/app.tsx');
          expect(result.right.contentHash).toBeTruthy();
        }
      }
    });

    it('should return unchanged for identical content', async () => {
      const storage = createTestStorage();
      const content = 'const x = 1;';
      await handler.compare({ outputPath: 'file.ts', currentContent: content }, storage)();
      const result = await handler.compare({ outputPath: 'file.ts', currentContent: content }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unchanged');
      }
    });

    it('should return changed when content differs', async () => {
      const storage = createTestStorage();
      await handler.compare({ outputPath: 'mod.ts', currentContent: 'line1\nline2' }, storage)();
      const result = await handler.compare(
        { outputPath: 'mod.ts', currentContent: 'line1\nline2\nline3' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('changed');
        if (result.right.variant === 'changed') {
          expect(result.right.linesAdded).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.compare(
        { outputPath: 'file.ts', currentContent: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('approve', () => {
    it('should approve a new snapshot', async () => {
      const storage = createTestStorage();
      await handler.compare({ outputPath: 'approve.ts', currentContent: 'code' }, storage)();
      const result = await handler.approve(
        { path: 'approve.ts', approver: O.some('reviewer') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return noChange when no snapshot exists', async () => {
      const storage = createTestStorage();
      const result = await handler.approve(
        { path: 'missing.ts', approver: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noChange');
      }
    });

    it('should return noChange for already-approved snapshot', async () => {
      const storage = createTestStorage();
      await handler.compare({ outputPath: 'already.ts', currentContent: 'code' }, storage)();
      await handler.approve({ path: 'already.ts', approver: O.none }, storage)();
      const result = await handler.approve({ path: 'already.ts', approver: O.none }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noChange');
      }
    });
  });

  describe('approveAll', () => {
    it('should approve all pending snapshots', async () => {
      const storage = createTestStorage();
      await handler.compare({ outputPath: 'a.ts', currentContent: 'a' }, storage)();
      await handler.compare({ outputPath: 'b.ts', currentContent: 'b' }, storage)();
      const result = await handler.approveAll({ paths: O.none }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.approved).toBe(2);
      }
    });

    it('should filter by paths when provided', async () => {
      const storage = createTestStorage();
      await handler.compare({ outputPath: 'x.ts', currentContent: 'x' }, storage)();
      await handler.compare({ outputPath: 'y.ts', currentContent: 'y' }, storage)();
      const result = await handler.approveAll({ paths: O.some(['x.ts']) }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.approved).toBe(1);
      }
    });
  });

  describe('reject', () => {
    it('should reject a pending change', async () => {
      const storage = createTestStorage();
      await handler.compare({ outputPath: 'rej.ts', currentContent: 'original' }, storage)();
      await handler.compare({ outputPath: 'rej.ts', currentContent: 'changed' }, storage)();
      const result = await handler.reject({ path: 'rej.ts' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return noChange when no pending content', async () => {
      const storage = createTestStorage();
      const result = await handler.reject({ path: 'none.ts' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noChange');
      }
    });
  });

  describe('status', () => {
    it('should return status for all snapshots', async () => {
      const storage = createTestStorage();
      await handler.compare({ outputPath: 'status.ts', currentContent: 'test' }, storage)();
      const result = await handler.status({ paths: O.none }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.results.length).toBeGreaterThan(0);
        expect(result.right.results[0].path).toBe('status.ts');
      }
    });
  });

  describe('diff', () => {
    it('should return noBaseline for missing path', async () => {
      const storage = createTestStorage();
      const result = await handler.diff({ path: 'missing.ts' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noBaseline');
      }
    });

    it('should return unchanged when no pending content', async () => {
      const storage = createTestStorage();
      await handler.compare({ outputPath: 'same.ts', currentContent: 'code' }, storage)();
      const result = await handler.diff({ path: 'same.ts' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unchanged');
      }
    });

    it('should return diff when pending content exists', async () => {
      const storage = createTestStorage();
      await handler.compare({ outputPath: 'diff.ts', currentContent: 'line1' }, storage)();
      await handler.compare({ outputPath: 'diff.ts', currentContent: 'line1\nline2' }, storage)();
      const result = await handler.diff({ path: 'diff.ts' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.linesAdded).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('clean', () => {
    it('should remove snapshots under the output directory', async () => {
      const storage = createTestStorage();
      await handler.compare({ outputPath: 'dist/a.ts', currentContent: 'a' }, storage)();
      await handler.compare({ outputPath: 'dist/b.ts', currentContent: 'b' }, storage)();
      await handler.compare({ outputPath: 'src/c.ts', currentContent: 'c' }, storage)();
      const result = await handler.clean({ outputDir: 'dist/' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.removed).toContain('dist/a.ts');
        expect(result.right.removed).toContain('dist/b.ts');
        expect(result.right.removed).not.toContain('src/c.ts');
      }
    });
  });
});
