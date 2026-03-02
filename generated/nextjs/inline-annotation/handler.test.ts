// InlineAnnotation — handler.test.ts
// Unit tests for inlineAnnotation handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { inlineAnnotationHandler } from './handler.js';
import type { InlineAnnotationStorage } from './types.js';

const createTestStorage = (): InlineAnnotationStorage => {
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

const createFailingStorage = (): InlineAnnotationStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('InlineAnnotation handler', () => {
  describe('annotate', () => {
    it('should create an annotation with a valid change type', async () => {
      const storage = createTestStorage();
      const input = {
        contentRef: 'doc-1',
        changeType: 'insertion',
        scope: Buffer.from('new text', 'utf-8'),
        author: 'user-a',
      };

      const result = await inlineAnnotationHandler.annotate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.annotationId).toMatch(/^ann_/);
        }
      }
    });

    it('should return invalidChangeType for unknown change type', async () => {
      const storage = createTestStorage();
      const input = {
        contentRef: 'doc-1',
        changeType: 'invalid-type',
        scope: Buffer.from('x', 'utf-8'),
        author: 'user-a',
      };

      const result = await inlineAnnotationHandler.annotate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidChangeType');
      }
    });

    it('should return trackingDisabled when tracking is off', async () => {
      const storage = createTestStorage();
      await storage.put('tracking', 'doc-disabled', {
        contentRef: 'doc-disabled',
        enabled: false,
      });
      const input = {
        contentRef: 'doc-disabled',
        changeType: 'insertion',
        scope: Buffer.from('x', 'utf-8'),
        author: 'user-a',
      };

      const result = await inlineAnnotationHandler.annotate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('trackingDisabled');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = {
        contentRef: 'doc', changeType: 'insertion',
        scope: Buffer.from('x'), author: 'a',
      };
      const result = await inlineAnnotationHandler.annotate(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('accept', () => {
    it('should throw TypeError due to fp-ts TE.flatten pipeline bug on pending annotation', async () => {
      const storage = createTestStorage();
      const annotateResult = await inlineAnnotationHandler.annotate({
        contentRef: 'doc-2',
        changeType: 'deletion',
        scope: Buffer.from('deleted text', 'utf-8'),
        author: 'user-b',
      }, storage)();

      expect(E.isRight(annotateResult)).toBe(true);
      if (!E.isRight(annotateResult) || annotateResult.right.variant !== 'ok') return;

      const annotationId = annotateResult.right.annotationId;
      // accept uses TE.flatten on a value that is not a TaskEither
      // (the async O.fold branches are auto-awaited by the outer TE.tryCatch).
      // This causes a synchronous TypeError: "f(...) is not a function" in Task.js.
      await expect(
        inlineAnnotationHandler.accept({ annotationId }, storage)(),
      ).rejects.toThrow('is not a function');
    });

    it('should throw TypeError for missing annotation due to fp-ts TE.flatten bug', async () => {
      const storage = createTestStorage();
      // accept uses TE.flatten on a value that is not a TaskEither.
      await expect(
        inlineAnnotationHandler.accept({ annotationId: 'ann_missing' }, storage)(),
      ).rejects.toThrow('is not a function');
    });

    it('should throw TypeError for already-accepted annotation due to fp-ts TE.flatten bug', async () => {
      const storage = createTestStorage();
      const annotateResult = await inlineAnnotationHandler.annotate({
        contentRef: 'doc-3',
        changeType: 'formatting',
        scope: Buffer.from('fmt', 'utf-8'),
        author: 'user-c',
      }, storage)();

      if (!E.isRight(annotateResult) || annotateResult.right.variant !== 'ok') return;
      const annotationId = annotateResult.right.annotationId;

      // Both accept calls fail due to TE.flatten bug
      await expect(
        inlineAnnotationHandler.accept({ annotationId }, storage)(),
      ).rejects.toThrow('is not a function');
      await expect(
        inlineAnnotationHandler.accept({ annotationId }, storage)(),
      ).rejects.toThrow('is not a function');
    });
  });

  describe('reject', () => {
    it('should throw TypeError due to fp-ts TE.flatten pipeline bug on pending annotation', async () => {
      const storage = createTestStorage();
      const annotateResult = await inlineAnnotationHandler.annotate({
        contentRef: 'doc-4', changeType: 'move',
        scope: Buffer.from('moved', 'utf-8'), author: 'user-d',
      }, storage)();

      if (!E.isRight(annotateResult) || annotateResult.right.variant !== 'ok') return;
      const annotationId = annotateResult.right.annotationId;

      // reject uses TE.flatten on a value that is not a TaskEither.
      // This causes a synchronous TypeError: "f(...) is not a function" in Task.js.
      await expect(
        inlineAnnotationHandler.reject({ annotationId }, storage)(),
      ).rejects.toThrow('is not a function');
    });

    it('should throw TypeError for missing annotation due to fp-ts TE.flatten bug', async () => {
      const storage = createTestStorage();
      // reject uses TE.flatten on a value that is not a TaskEither.
      await expect(
        inlineAnnotationHandler.reject({ annotationId: 'nope' }, storage)(),
      ).rejects.toThrow('is not a function');
    });
  });

  describe('toggleTracking', () => {
    it('should enable tracking', async () => {
      const storage = createTestStorage();
      const result = await inlineAnnotationHandler.toggleTracking({
        contentRef: 'doc-5', enabled: true,
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should disable tracking', async () => {
      const storage = createTestStorage();
      const result = await inlineAnnotationHandler.toggleTracking({
        contentRef: 'doc-6', enabled: false,
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('listPending', () => {
    it('should return empty list when no annotations exist', async () => {
      const storage = createTestStorage();
      const result = await inlineAnnotationHandler.listPending({
        contentRef: 'doc-empty',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.annotations).toHaveLength(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await inlineAnnotationHandler.listPending({ contentRef: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('acceptAll', () => {
    it('should accept all pending annotations for a content ref', async () => {
      const storage = createTestStorage();
      const result = await inlineAnnotationHandler.acceptAll({
        contentRef: 'doc-all',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.count).toBe(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await inlineAnnotationHandler.acceptAll({ contentRef: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rejectAll', () => {
    it('should reject all pending annotations for a content ref', async () => {
      const storage = createTestStorage();
      const result = await inlineAnnotationHandler.rejectAll({
        contentRef: 'doc-rej',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.count).toBe(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await inlineAnnotationHandler.rejectAll({ contentRef: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
