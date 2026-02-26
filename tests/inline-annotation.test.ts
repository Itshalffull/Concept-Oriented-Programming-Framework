// ============================================================
// InlineAnnotation Concept Handler Tests
//
// Validates annotate, accept, reject, acceptAll, rejectAll,
// toggleTracking, and listPending actions for the collaboration
// kit's inline annotation concept.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  inlineAnnotationHandler,
  resetInlineAnnotationCounter,
} from '../implementations/typescript/inline-annotation.impl.js';

describe('InlineAnnotation', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetInlineAnnotationCounter();
  });

  // ---- annotate ----

  describe('annotate', () => {
    it('creates an annotation and returns ok with an ID', async () => {
      const result = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'Hello', author: 'alice' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.annotationId).toBe('inline-annotation-1');
    });

    it('stores the annotation as pending', async () => {
      const result = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'deletion', scope: 'removed text', author: 'bob' },
        storage,
      );
      const stored = await storage.get('inline-annotation', result.annotationId as string);
      expect(stored).not.toBeNull();
      expect(stored!.status).toBe('pending');
      expect(stored!.changeType).toBe('deletion');
      expect(stored!.author).toBe('bob');
      expect(stored!.contentRef).toBe('doc-1');
    });

    it('accepts all valid change types', async () => {
      const validTypes = ['insertion', 'deletion', 'formatting', 'move'];
      for (const changeType of validTypes) {
        const result = await inlineAnnotationHandler.annotate(
          { contentRef: 'doc-1', changeType, scope: 's', author: 'a' },
          storage,
        );
        expect(result.variant).toBe('ok');
      }
    });

    it('rejects invalid change type', async () => {
      const result = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'replace', scope: 's', author: 'a' },
        storage,
      );
      expect(result.variant).toBe('invalidChangeType');
      expect(result.message).toContain('replace');
    });

    it('returns trackingDisabled when tracking is off for the content', async () => {
      await inlineAnnotationHandler.toggleTracking(
        { contentRef: 'doc-1', enabled: false },
        storage,
      );
      const result = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'text', author: 'alice' },
        storage,
      );
      expect(result.variant).toBe('trackingDisabled');
      expect(result.message).toContain('doc-1');
    });

    it('allows annotation when tracking is explicitly enabled', async () => {
      await inlineAnnotationHandler.toggleTracking(
        { contentRef: 'doc-1', enabled: true },
        storage,
      );
      const result = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'text', author: 'alice' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });

  // ---- accept ----

  describe('accept', () => {
    it('accepts a pending annotation and returns the scope as cleanContent', async () => {
      const ann = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'new paragraph', author: 'alice' },
        storage,
      );
      const result = await inlineAnnotationHandler.accept(
        { annotationId: ann.annotationId },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.cleanContent).toBe('new paragraph');
    });

    it('marks the annotation as accepted in storage', async () => {
      const ann = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'text', author: 'a' },
        storage,
      );
      await inlineAnnotationHandler.accept({ annotationId: ann.annotationId }, storage);
      const stored = await storage.get('inline-annotation', ann.annotationId as string);
      expect(stored!.status).toBe('accepted');
    });

    it('returns notFound for unknown annotation ID', async () => {
      const result = await inlineAnnotationHandler.accept(
        { annotationId: 'ghost' },
        storage,
      );
      expect(result.variant).toBe('notFound');
    });

    it('returns alreadyResolved if annotation was already accepted', async () => {
      const ann = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'text', author: 'a' },
        storage,
      );
      await inlineAnnotationHandler.accept({ annotationId: ann.annotationId }, storage);
      const result = await inlineAnnotationHandler.accept(
        { annotationId: ann.annotationId },
        storage,
      );
      expect(result.variant).toBe('alreadyResolved');
      expect(result.message).toContain('accepted');
    });

    it('returns alreadyResolved if annotation was already rejected', async () => {
      const ann = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'text', author: 'a' },
        storage,
      );
      await inlineAnnotationHandler.reject({ annotationId: ann.annotationId }, storage);
      const result = await inlineAnnotationHandler.accept(
        { annotationId: ann.annotationId },
        storage,
      );
      expect(result.variant).toBe('alreadyResolved');
      expect(result.message).toContain('rejected');
    });
  });

  // ---- reject ----

  describe('reject', () => {
    it('rejects a pending annotation and returns empty cleanContent', async () => {
      const ann = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'deletion', scope: 'deleted text', author: 'bob' },
        storage,
      );
      const result = await inlineAnnotationHandler.reject(
        { annotationId: ann.annotationId },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.cleanContent).toBe('');
    });

    it('marks the annotation as rejected in storage', async () => {
      const ann = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'text', author: 'a' },
        storage,
      );
      await inlineAnnotationHandler.reject({ annotationId: ann.annotationId }, storage);
      const stored = await storage.get('inline-annotation', ann.annotationId as string);
      expect(stored!.status).toBe('rejected');
    });

    it('returns notFound for unknown annotation ID', async () => {
      const result = await inlineAnnotationHandler.reject(
        { annotationId: 'no-such-id' },
        storage,
      );
      expect(result.variant).toBe('notFound');
    });

    it('returns alreadyResolved if annotation was already resolved', async () => {
      const ann = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'text', author: 'a' },
        storage,
      );
      await inlineAnnotationHandler.reject({ annotationId: ann.annotationId }, storage);
      const result = await inlineAnnotationHandler.reject(
        { annotationId: ann.annotationId },
        storage,
      );
      expect(result.variant).toBe('alreadyResolved');
    });
  });

  // ---- acceptAll ----

  describe('acceptAll', () => {
    it('accepts all pending annotations for a content ref', async () => {
      await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'A', author: 'a' },
        storage,
      );
      await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'B', author: 'a' },
        storage,
      );
      const result = await inlineAnnotationHandler.acceptAll(
        { contentRef: 'doc-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(2);
      expect(result.cleanContent).toBe('AB');
    });

    it('returns count 0 when no pending annotations exist', async () => {
      const result = await inlineAnnotationHandler.acceptAll(
        { contentRef: 'doc-empty' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(0);
      expect(result.cleanContent).toBe('');
    });

    it('does not affect annotations for other content refs', async () => {
      await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'X', author: 'a' },
        storage,
      );
      const ann2 = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-2', changeType: 'insertion', scope: 'Y', author: 'a' },
        storage,
      );

      await inlineAnnotationHandler.acceptAll({ contentRef: 'doc-1' }, storage);

      // doc-2 annotation should still be pending
      const stored = await storage.get('inline-annotation', ann2.annotationId as string);
      expect(stored!.status).toBe('pending');
    });

    it('does not re-accept already resolved annotations', async () => {
      const ann = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'Z', author: 'a' },
        storage,
      );
      await inlineAnnotationHandler.reject({ annotationId: ann.annotationId }, storage);

      const result = await inlineAnnotationHandler.acceptAll(
        { contentRef: 'doc-1' },
        storage,
      );
      // Already rejected, so count should be 0
      expect(result.count).toBe(0);
    });
  });

  // ---- rejectAll ----

  describe('rejectAll', () => {
    it('rejects all pending annotations for a content ref', async () => {
      await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'A', author: 'a' },
        storage,
      );
      await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'deletion', scope: 'B', author: 'b' },
        storage,
      );
      const result = await inlineAnnotationHandler.rejectAll(
        { contentRef: 'doc-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(2);
      expect(result.cleanContent).toBe('');
    });

    it('returns count 0 when no pending annotations exist', async () => {
      const result = await inlineAnnotationHandler.rejectAll(
        { contentRef: 'none' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(0);
    });
  });

  // ---- toggleTracking ----

  describe('toggleTracking', () => {
    it('disables tracking for a content ref', async () => {
      const result = await inlineAnnotationHandler.toggleTracking(
        { contentRef: 'doc-1', enabled: false },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('enables tracking for a content ref', async () => {
      await inlineAnnotationHandler.toggleTracking(
        { contentRef: 'doc-1', enabled: false },
        storage,
      );
      await inlineAnnotationHandler.toggleTracking(
        { contentRef: 'doc-1', enabled: true },
        storage,
      );
      // Should now allow annotations
      const result = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'text', author: 'a' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });

  // ---- listPending ----

  describe('listPending', () => {
    it('returns empty list when no annotations exist', async () => {
      const result = await inlineAnnotationHandler.listPending(
        { contentRef: 'doc-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.annotations).toEqual([]);
    });

    it('returns only pending annotation IDs', async () => {
      const ann1 = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'A', author: 'a' },
        storage,
      );
      const ann2 = await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'deletion', scope: 'B', author: 'b' },
        storage,
      );
      // Accept first one
      await inlineAnnotationHandler.accept({ annotationId: ann1.annotationId }, storage);

      const result = await inlineAnnotationHandler.listPending(
        { contentRef: 'doc-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const annotations = result.annotations as string[];
      expect(annotations).toHaveLength(1);
      expect(annotations[0]).toBe(ann2.annotationId);
    });

    it('does not include annotations from other content refs', async () => {
      await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'A', author: 'a' },
        storage,
      );
      await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-2', changeType: 'insertion', scope: 'B', author: 'a' },
        storage,
      );

      const result = await inlineAnnotationHandler.listPending(
        { contentRef: 'doc-1' },
        storage,
      );
      expect((result.annotations as string[]).length).toBe(1);
    });
  });

  // ---- Multi-step workflow ----

  describe('full annotation review workflow', () => {
    it('annotate -> listPending -> accept/reject -> listPending empty', async () => {
      // Create 3 annotations
      await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'insertion', scope: 'para1', author: 'alice' },
        storage,
      );
      await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'deletion', scope: 'para2', author: 'bob' },
        storage,
      );
      await inlineAnnotationHandler.annotate(
        { contentRef: 'doc-1', changeType: 'formatting', scope: 'para3', author: 'alice' },
        storage,
      );

      // List pending should show 3
      const pending1 = await inlineAnnotationHandler.listPending(
        { contentRef: 'doc-1' },
        storage,
      );
      expect((pending1.annotations as string[]).length).toBe(3);

      // Accept all
      const acceptResult = await inlineAnnotationHandler.acceptAll(
        { contentRef: 'doc-1' },
        storage,
      );
      expect(acceptResult.count).toBe(3);
      expect(acceptResult.cleanContent).toBe('para1para2para3');

      // List pending should now be empty
      const pending2 = await inlineAnnotationHandler.listPending(
        { contentRef: 'doc-1' },
        storage,
      );
      expect((pending2.annotations as string[]).length).toBe(0);
    });
  });
});
