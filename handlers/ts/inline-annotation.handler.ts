// ============================================================
// InlineAnnotation Handler
//
// Embed change markers directly within content structure, enabling
// accept/reject review workflows where the document simultaneously
// holds both before and after states. Content-type-agnostic — scope
// is opaque bytes resolved by the content system.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `inline-annotation-${++idCounter}`;
}

const VALID_CHANGE_TYPES = ['insertion', 'deletion', 'formatting', 'move'];

export const inlineAnnotationHandler: ConceptHandler = {
  async annotate(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentRef = input.contentRef as string;
    const changeType = input.changeType as string;
    const scope = input.scope as string;
    const author = input.author as string;

    // Check if tracking is enabled for this content
    const trackingRecords = await storage.find('inline-annotation-tracking', { contentRef });
    if (trackingRecords.length > 0 && trackingRecords[0].enabled === false) {
      return { variant: 'trackingDisabled', message: `Tracking is disabled for "${contentRef}"` };
    }

    // Validate change type
    if (!VALID_CHANGE_TYPES.includes(changeType)) {
      return {
        variant: 'invalidChangeType',
        message: `changeType must be one of: ${VALID_CHANGE_TYPES.join(', ')}. Got "${changeType}"`,
      };
    }

    const id = nextId();
    const timestamp = new Date().toISOString();

    await storage.put('inline-annotation', id, {
      id,
      contentRef,
      changeType,
      scope,
      author,
      timestamp,
      status: 'pending',
    });

    return { variant: 'ok', annotationId: id };
  },

  async accept(input: Record<string, unknown>, storage: ConceptStorage) {
    const annotationId = input.annotationId as string;

    const record = await storage.get('inline-annotation', annotationId);
    if (!record) {
      return { variant: 'notFound', message: `Annotation "${annotationId}" not found` };
    }

    if (record.status !== 'pending') {
      return {
        variant: 'alreadyResolved',
        message: `Annotation "${annotationId}" was already ${record.status}`,
      };
    }

    await storage.put('inline-annotation', annotationId, {
      ...record,
      status: 'accepted',
    });

    // Return the scope as cleanContent (the change content is kept)
    return { variant: 'ok', cleanContent: record.scope as string };
  },

  async reject(input: Record<string, unknown>, storage: ConceptStorage) {
    const annotationId = input.annotationId as string;

    const record = await storage.get('inline-annotation', annotationId);
    if (!record) {
      return { variant: 'notFound', message: `Annotation "${annotationId}" not found` };
    }

    if (record.status !== 'pending') {
      return {
        variant: 'alreadyResolved',
        message: `Annotation "${annotationId}" was already ${record.status}`,
      };
    }

    await storage.put('inline-annotation', annotationId, {
      ...record,
      status: 'rejected',
    });

    // Return empty cleanContent (the change content is removed)
    return { variant: 'ok', cleanContent: '' };
  },

  async acceptAll(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentRef = input.contentRef as string;

    const pending = await storage.find('inline-annotation', { contentRef, status: 'pending' });
    let cleanContent = '';

    for (const record of pending) {
      await storage.put('inline-annotation', record.id as string, {
        ...record,
        status: 'accepted',
      });
      // Accumulate scope bytes as accepted content
      cleanContent += (record.scope as string) || '';
    }

    return { variant: 'ok', cleanContent, count: pending.length };
  },

  async rejectAll(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentRef = input.contentRef as string;

    const pending = await storage.find('inline-annotation', { contentRef, status: 'pending' });

    for (const record of pending) {
      await storage.put('inline-annotation', record.id as string, {
        ...record,
        status: 'rejected',
      });
    }

    return { variant: 'ok', cleanContent: '', count: pending.length };
  },

  async toggleTracking(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentRef = input.contentRef as string;
    const enabled = input.enabled as boolean;

    await storage.put('inline-annotation-tracking', contentRef, {
      contentRef,
      enabled,
    });

    return { variant: 'ok' };
  },

  async listPending(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentRef = input.contentRef as string;

    const results = await storage.find('inline-annotation', { contentRef, status: 'pending' });
    const annotationIds = results.map((r) => r.id as string);

    return { variant: 'ok', annotations: annotationIds };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetInlineAnnotationCounter(): void {
  idCounter = 0;
}
