// @migrated dsl-constructs 2026-03-18
// ============================================================
// SuffixArrayIndexProvider Handler
//
// Search index provider using suffix arrays for exact and
// approximate substring matching with compressed storage.
// Registers as a SearchIndex provider.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, del, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `suffix-array-index-provider-${++idCounter}`;
}

const PROVIDER_REF = 'search:suffix-array';

// ---------------------------------------------------------------------------
// Suffix array construction and binary search
// ---------------------------------------------------------------------------

/**
 * Build a suffix array for the given text.
 */
function buildSuffixArray(text: string): number[] {
  const n = text.length;
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    indices.push(i);
  }
  indices.sort((a, b) => {
    const sa = text.substring(a);
    const sb = text.substring(b);
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  });
  return indices;
}

/**
 * Binary search through a suffix array to find all positions where
 * `pattern` occurs as a substring of `text`.
 */
function searchSuffixArray(text: string, sa: number[], pattern: string): number[] {
  const n = sa.length;
  if (n === 0 || pattern.length === 0) return [];

  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const suffix = text.substring(sa[mid], sa[mid] + pattern.length);
    if (suffix < pattern) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const left = lo;

  hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const suffix = text.substring(sa[mid], sa[mid] + pattern.length);
    if (suffix <= pattern) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const right = lo;

  const positions: number[] = [];
  for (let i = left; i < right; i++) {
    positions.push(sa[i]);
  }
  return positions;
}

// ---------------------------------------------------------------------------
// Storage relation for indexed documents
// ---------------------------------------------------------------------------

const DOC_RELATION = 'suffix-array-index-provider';
const SA_RELATION = 'suffix-array-index-provider-sa';

const _handler: FunctionalConceptHandler = {
  initialize(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, DOC_RELATION, { providerRef: PROVIDER_REF }, 'existing');

    return completeFrom(p, 'ok', (bindings) => {
      const existing = bindings.existing as Record<string, unknown>[];
      if (existing.length > 0) {
        return { instance: existing[0].id as string };
      }

      const id = nextId();
      return { instance: id };
    }) as StorageProgram<Result>;
  },

  index(input: Record<string, unknown>) {
    const docId = input.docId as string;
    const text = input.text as string;

    const lowerText = text.toLowerCase();
    const sa = buildSuffixArray(lowerText);

    let p = createProgram();
    p = put(p, SA_RELATION, docId, {
      id: docId,
      text: lowerText,
      suffixArray: JSON.stringify(sa),
    });

    return complete(p, 'ok', { docId }) as StorageProgram<Result>;
  },

  search(input: Record<string, unknown>) {
    const pattern = input.pattern as string;

    const lowerPattern = pattern.toLowerCase();

    let p = createProgram();
    p = find(p, SA_RELATION, {}, 'allDocs');

    return completeFrom(p, 'ok', (bindings) => {
      const allDocs = bindings.allDocs as Record<string, unknown>[];

      const results: Array<{ docId: string; positions: number[] }> = [];
      for (const doc of allDocs) {
        const text = doc.text as string;
        const sa: number[] = JSON.parse(doc.suffixArray as string);
        const positions = searchSuffixArray(text, sa, lowerPattern);
        if (positions.length > 0) {
          results.push({ docId: doc.id as string, positions });
        }
      }

      return { results: JSON.stringify(results) };
    }) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const docId = input.docId as string;

    let p = createProgram();
    p = del(p, SA_RELATION, docId);

    return complete(p, 'ok', { docId }) as StorageProgram<Result>;
  },
};

export const suffixArrayIndexProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSuffixArrayIndexProviderCounter(): void {
  idCounter = 0;
}
