// @migrated dsl-constructs 2026-03-18
// ============================================================
// InlineAnnotation Handler
//
// Embed change markers directly within content structure, enabling
// accept/reject review workflows where the document simultaneously
// holds both before and after states. Content-type-agnostic — scope
// is opaque bytes resolved by the content system.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, delMany, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `inline-annotation-${++idCounter}`;
}

const VALID_CHANGE_TYPES = ['insertion', 'deletion', 'formatting', 'move'];

const _handler: FunctionalConceptHandler = {
  annotate(input: Record<string, unknown>) {
    const contentRef = input.contentRef as string;
    const changeType = input.changeType as string;
    const scope = input.scope as string;
    const author = input.author as string;

    if (!VALID_CHANGE_TYPES.includes(changeType)) {
      const p = createProgram();
      return complete(p, 'invalidChangeType', {
        message: `changeType must be one of: ${VALID_CHANGE_TYPES.join(', ')}. Got "${changeType}"`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'inline-annotation-tracking', { contentRef }, 'trackingRecords');

    return branch(p,
      (bindings) => {
        const recs = bindings.trackingRecords as Record<string, unknown>[];
        return recs.length > 0 && recs[0].enabled === false;
      },
      (bp) => complete(bp, 'trackingDisabled', {
        message: `Tracking is disabled for "${contentRef}"`,
      }),
      (bp) => {
        const id = nextId();
        const timestamp = new Date().toISOString();
        const bp2 = put(bp, 'inline-annotation', id, {
          id, contentRef, changeType, scope, author, timestamp, status: 'pending',
        });
        return complete(bp2, 'ok', { annotationId: id });
      },
    ) as StorageProgram<Result>;
  },

  accept(input: Record<string, unknown>) {
    const annotationId = input.annotationId as string;

    let p = createProgram();
    p = get(p, 'inline-annotation', annotationId, 'record');

    return branch(p,
      (bindings) => !bindings.record,
      (bp) => complete(bp, 'notFound', { message: `Annotation "${annotationId}" not found` }),
      (bp) => branch(bp,
        (bindings) => (bindings.record as Record<string, unknown>).status !== 'pending',
        (bp2) => completeFrom(bp2, 'alreadyResolved', (bindings) => ({
          message: `Annotation "${annotationId}" was already ${(bindings.record as Record<string, unknown>).status}`,
        })),
        (bp2) => {
          const bp3 = putFrom(bp2, 'inline-annotation', annotationId, (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            return { ...record, status: 'accepted' };
          });
          return completeFrom(bp3, 'ok', (bindings) => ({
            cleanContent: (bindings.record as Record<string, unknown>).scope as string,
          }));
        },
      ),
    ) as StorageProgram<Result>;
  },

  reject(input: Record<string, unknown>) {
    const annotationId = input.annotationId as string;

    let p = createProgram();
    p = get(p, 'inline-annotation', annotationId, 'record');

    return branch(p,
      (bindings) => !bindings.record,
      (bp) => complete(bp, 'notFound', { message: `Annotation "${annotationId}" not found` }),
      (bp) => branch(bp,
        (bindings) => (bindings.record as Record<string, unknown>).status !== 'pending',
        (bp2) => completeFrom(bp2, 'alreadyResolved', (bindings) => ({
          message: `Annotation "${annotationId}" was already ${(bindings.record as Record<string, unknown>).status}`,
        })),
        (bp2) => {
          const bp3 = putFrom(bp2, 'inline-annotation', annotationId, (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            return { ...record, status: 'rejected' };
          });
          return complete(bp3, 'ok', { cleanContent: '' });
        },
      ),
    ) as StorageProgram<Result>;
  },

  acceptAll(input: Record<string, unknown>) {
    const contentRef = input.contentRef as string;

    let p = createProgram();
    p = find(p, 'inline-annotation', { contentRef, status: 'pending' }, 'pending');
    // Remove pending annotations after accepting
    p = delMany(p, 'inline-annotation', { contentRef, status: 'pending' }, 'deleted');

    return completeFrom(p, 'ok', (bindings) => {
      const pending = bindings.pending as Record<string, unknown>[];
      let cleanContent = '';
      for (const record of pending) {
        cleanContent += (record.scope as string) || '';
      }
      return { cleanContent, count: pending.length };
    }) as StorageProgram<Result>;
  },

  rejectAll(input: Record<string, unknown>) {
    const contentRef = input.contentRef as string;

    let p = createProgram();
    p = find(p, 'inline-annotation', { contentRef, status: 'pending' }, 'pending');

    return completeFrom(p, 'ok', (bindings) => {
      const pending = bindings.pending as Record<string, unknown>[];
      return { cleanContent: '', count: pending.length };
    }) as StorageProgram<Result>;
  },

  toggleTracking(input: Record<string, unknown>) {
    const contentRef = input.contentRef as string;
    const enabled = input.enabled as boolean;

    let p = createProgram();
    p = put(p, 'inline-annotation-tracking', contentRef, {
      contentRef,
      enabled,
    });

    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },

  listPending(input: Record<string, unknown>) {
    const contentRef = input.contentRef as string;

    let p = createProgram();
    p = find(p, 'inline-annotation', { contentRef, status: 'pending' }, 'results');

    return completeFrom(p, 'ok', (bindings) => {
      const results = bindings.results as Record<string, unknown>[];
      const annotations = results.map((r) => r.id as string);
      return { annotations };
    }) as StorageProgram<Result>;
  },
};

export const inlineAnnotationHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetInlineAnnotationCounter(): void {
  idCounter = 0;
}
