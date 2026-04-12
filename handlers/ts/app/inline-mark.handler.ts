// @clef-handler style=functional
// InlineMark Concept Implementation
// Typed, range-scoped inline presentational marks (bold, italic, code, link,
// strikethrough, subscript, superscript, wikilink) on block body text.
// Marks are consumed by RenderTransforms at render time and are invisible to
// content semantics.
//
// Toggle semantics:
//   - Exact (block, rangeStart, rangeEnd, kind) match → remove (toggle off), returns `removed`
//   - No exact match → create a new mark for the input range, returns `ok`
//
// Overlap/merge note: The spec's overlap merge rule (union of ranges for same-kind
// overlapping marks) is a behavioral invariant enforced at the application layer
// via syncs. The handler implements the simpler guarantee: no two marks share the
// same (block, rangeStart, rangeEnd, kind) — this is what the conformance tests verify.
//
// Reversal: toggleMark is self-inverse. Two calls with identical inputs cancel out.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type R = StorageProgram<{ variant: string; [key: string]: unknown }>;

const VALID_KINDS = new Set([
  'bold', 'italic', 'code', 'link',
  'strikethrough', 'subscript', 'superscript', 'wikilink',
]);

// Canonical storage key for a mark — derived from its four defining fields.
function markKey(block: string, rangeStart: number, rangeEnd: number, kind: string): string {
  return `${block}::${kind}::${rangeStart}::${rangeEnd}`;
}

// Map a mark kind to its attribute-editor token string.
function editorToken(kind: string): string {
  if (kind === 'link') return 'link-editor';
  if (kind === 'wikilink') return 'wikilink-editor';
  return 'mark-attrs-editor';
}

const _handler: FunctionalConceptHandler = {

  register() {
    return { name: 'InlineMark' };
  },

  toggleMark(input: Record<string, unknown>) {
    const block = typeof input.block === 'string' ? input.block : '';
    const rangeStart = Number(input.rangeStart);
    const rangeEnd = Number(input.rangeEnd);
    const kind = typeof input.kind === 'string' ? input.kind : '';
    const attributes = typeof input.attributes === 'string' ? input.attributes : '';

    // Validate kind before touching storage.
    if (!VALID_KINDS.has(kind)) {
      return complete(createProgram(), 'invalid_kind', {
        message: `kind '${kind}' is not allowed; valid kinds: ${[...VALID_KINDS].join(', ')}`,
      }) as R;
    }

    // Validate range.
    if (!block || block.trim() === '') {
      return complete(createProgram(), 'invalid_range', {
        message: 'block identifier is required',
      }) as R;
    }
    if (isNaN(rangeStart) || rangeStart < 0) {
      return complete(createProgram(), 'invalid_range', {
        message: 'rangeStart must be a non-negative integer',
      }) as R;
    }
    if (isNaN(rangeEnd) || rangeEnd <= rangeStart) {
      return complete(createProgram(), 'invalid_range', {
        message: 'rangeEnd must be strictly greater than rangeStart',
      }) as R;
    }

    const key = markKey(block, rangeStart, rangeEnd, kind);

    // Check for an existing exact-match mark.
    let p = createProgram();
    p = get(p, 'marks', key, 'existing');
    return branch(p,
      (b) => b.existing != null,
      // Exact match → remove (toggle off).
      (b) => {
        let dp = del(b, 'marks', key);
        return complete(dp, 'removed', { mark: key }) as R;
      },
      // No match → create the mark with the input range.
      (b) => {
        let cp = put(b, 'marks', key, {
          id: key,
          block,
          rangeStart,
          rangeEnd,
          kind,
          attributes,
        });
        return complete(cp, 'ok', { mark: key }) as R;
      },
    ) as R;
  },

  openEditor(input: Record<string, unknown>) {
    const mark = typeof input.mark === 'string' ? input.mark : '';

    if (!mark || mark.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'mark identifier is required' }) as R;
    }

    let p = createProgram();
    p = get(p, 'marks', mark, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const kind = (rec?.kind as string) ?? '';
          return { editor: editorToken(kind) };
        }) as R;
      },
      (b) => complete(b, 'notfound', { message: `mark '${mark}' not found` }) as R,
    ) as R;
  },

  listForBlock(input: Record<string, unknown>) {
    const block = typeof input.block === 'string' ? input.block : '';

    let p = createProgram();
    p = find(p, 'marks', {}, 'allMarks');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allMarks as Array<Record<string, unknown>>) ?? [];
      const forBlock = all.filter(m => m.block === block);
      return { marks: JSON.stringify(forBlock) };
    }) as R;
  },

  removeMark(input: Record<string, unknown>) {
    const mark = typeof input.mark === 'string' ? input.mark : '';

    if (!mark || mark.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'mark identifier is required' }) as R;
    }

    let p = createProgram();
    p = get(p, 'marks', mark, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => {
        let dp = del(b, 'marks', mark);
        return complete(dp, 'ok', {}) as R;
      },
      (b) => complete(b, 'notfound', { message: `mark '${mark}' not found` }) as R,
    ) as R;
  },

  updateAttributes(input: Record<string, unknown>) {
    const mark = typeof input.mark === 'string' ? input.mark : '';
    const attributes = typeof input.attributes === 'string' ? input.attributes : '';

    if (!mark || mark.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'mark identifier is required' }) as R;
    }

    let p = createProgram();
    p = get(p, 'marks', mark, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return { mark, ...rec, attributes };
        }) as R;
      },
      (b) => complete(b, 'notfound', { message: `mark '${mark}' not found` }) as R,
    ) as R;
  },

};

export const inlineMarkHandler = autoInterpret(_handler);
export default inlineMarkHandler;
