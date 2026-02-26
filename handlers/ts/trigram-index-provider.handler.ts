// ============================================================
// TrigramIndexProvider Handler
//
// Search index provider using trigram indexing for fast substring
// and regex text search across project files. Registers as a
// SearchIndex provider.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `trigram-index-provider-${++idCounter}`;
}

const PROVIDER_REF = 'search:trigram';

// ---------------------------------------------------------------------------
// Storage relations
// ---------------------------------------------------------------------------

const INSTANCE_RELATION = 'trigram-index-provider';
/** Trigram posting list entries: one record per (trigram, docId) pair. */
const POSTING_RELATION = 'trigram-index-provider-post';
/** Document metadata keyed by docId. */
const DOC_RELATION = 'trigram-index-provider-doc';

// ---------------------------------------------------------------------------
// Trigram extraction
// ---------------------------------------------------------------------------

/**
 * Extract all unique 3-character trigrams from the given text.
 * Text is lowercased before extraction.
 */
function extractTrigrams(text: string): string[] {
  const lower = text.toLowerCase();
  const trigrams = new Set<string>();
  for (let i = 0; i <= lower.length - 3; i++) {
    trigrams.add(lower.substring(i, i + 3));
  }
  return Array.from(trigrams);
}

export const trigramIndexProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const existing = await storage.find(INSTANCE_RELATION, { providerRef: PROVIDER_REF });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    const id = nextId();
    await storage.put(INSTANCE_RELATION, id, {
      id,
      providerRef: PROVIDER_REF,
    });

    return { variant: 'ok', instance: id };
  },

  /**
   * Index a document by extracting its trigrams and creating posting
   * list entries for each trigram pointing back to the document.
   */
  async index(input: Record<string, unknown>, storage: ConceptStorage) {
    const docId = input.docId as string;
    const text = input.text as string;

    // Store document text for later verification / snippet retrieval
    await storage.put(DOC_RELATION, docId, {
      id: docId,
      text,
    });

    // Build posting list entries
    const trigrams = extractTrigrams(text);
    for (const tri of trigrams) {
      const entryId = `${tri}::${docId}`;
      await storage.put(POSTING_RELATION, entryId, {
        id: entryId,
        trigram: tri,
        docId,
      });
    }

    return { variant: 'ok', docId, trigramCount: trigrams.length };
  },

  /**
   * Search for documents matching a query string by computing the
   * query's trigrams and intersecting the posting lists.
   */
  async search(input: Record<string, unknown>, storage: ConceptStorage) {
    const query = input.query as string;

    const queryTrigrams = extractTrigrams(query);

    if (queryTrigrams.length === 0) {
      // Query too short for trigram search; return empty
      return { variant: 'ok', results: JSON.stringify([]) };
    }

    // For each trigram, collect the set of docIds
    let candidateDocIds: Set<string> | null = null;

    for (const tri of queryTrigrams) {
      const entries = await storage.find(POSTING_RELATION, { trigram: tri });
      const docIds = new Set(entries.map((e) => e.docId as string));

      if (candidateDocIds === null) {
        candidateDocIds = docIds;
      } else {
        // Intersect: keep only docIds present in both sets
        const intersection = new Set<string>();
        for (const id of candidateDocIds) {
          if (docIds.has(id)) intersection.add(id);
        }
        candidateDocIds = intersection;
      }

      // Early exit if intersection is empty
      if (candidateDocIds.size === 0) break;
    }

    // Verify candidates actually contain the query substring
    const lowerQuery = query.toLowerCase();
    const results: Array<{ docId: string; positions: number[] }> = [];
    for (const docId of candidateDocIds || []) {
      const doc = await storage.get(DOC_RELATION, docId);
      if (!doc) continue;

      const text = (doc.text as string).toLowerCase();
      const positions: number[] = [];
      let idx = text.indexOf(lowerQuery);
      while (idx !== -1) {
        positions.push(idx);
        idx = text.indexOf(lowerQuery, idx + 1);
      }

      if (positions.length > 0) {
        results.push({ docId, positions });
      }
    }

    return { variant: 'ok', results: JSON.stringify(results) };
  },

  /**
   * Remove a document from the trigram index, deleting its metadata
   * and all its posting list entries.
   */
  async remove(input: Record<string, unknown>, storage: ConceptStorage) {
    const docId = input.docId as string;

    // Retrieve document text to know which trigrams to remove
    const doc = await storage.get(DOC_RELATION, docId);
    if (doc) {
      const trigrams = extractTrigrams(doc.text as string);
      for (const tri of trigrams) {
        const entryId = `${tri}::${docId}`;
        await storage.del(POSTING_RELATION, entryId);
      }
      await storage.del(DOC_RELATION, docId);
    }

    return { variant: 'ok', docId };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTrigramIndexProviderCounter(): void {
  idCounter = 0;
}
