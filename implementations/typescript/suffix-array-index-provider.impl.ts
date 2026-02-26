// ============================================================
// SuffixArrayIndexProvider Handler
//
// Search index provider using suffix arrays for exact and
// approximate substring matching with compressed storage.
// Registers as a SearchIndex provider.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

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
 * Returns an array of starting indices sorted by the lexicographic order
 * of their corresponding suffixes.
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

  // Find left bound
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

  // Find right bound
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

export const suffixArrayIndexProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    // Check if already initialised
    const existing = await storage.find(DOC_RELATION, { providerRef: PROVIDER_REF });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    const id = nextId();
    await storage.put(DOC_RELATION, id, {
      id,
      providerRef: PROVIDER_REF,
    });

    return { variant: 'ok', instance: id };
  },

  /**
   * Index a document by building its suffix array and storing both
   * the text and the sorted suffix indices.
   */
  async index(input: Record<string, unknown>, storage: ConceptStorage) {
    const docId = input.docId as string;
    const text = input.text as string;

    const lowerText = text.toLowerCase();
    const sa = buildSuffixArray(lowerText);

    await storage.put(SA_RELATION, docId, {
      id: docId,
      text: lowerText,
      suffixArray: JSON.stringify(sa),
    });

    return { variant: 'ok', docId };
  },

  /**
   * Search all indexed documents for a substring pattern.
   * Returns matching docIds with positions.
   */
  async search(input: Record<string, unknown>, storage: ConceptStorage) {
    const pattern = input.pattern as string;

    const lowerPattern = pattern.toLowerCase();
    const allDocs = await storage.find(SA_RELATION);

    const results: Array<{ docId: string; positions: number[] }> = [];
    for (const doc of allDocs) {
      const text = doc.text as string;
      const sa: number[] = JSON.parse(doc.suffixArray as string);
      const positions = searchSuffixArray(text, sa, lowerPattern);
      if (positions.length > 0) {
        results.push({ docId: doc.id as string, positions });
      }
    }

    return { variant: 'ok', results: JSON.stringify(results) };
  },

  /**
   * Remove a document from the suffix array index.
   */
  async remove(input: Record<string, unknown>, storage: ConceptStorage) {
    const docId = input.docId as string;

    await storage.del(SA_RELATION, docId);

    return { variant: 'ok', docId };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSuffixArrayIndexProviderCounter(): void {
  idCounter = 0;
}
