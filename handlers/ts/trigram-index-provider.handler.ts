// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// TrigramIndexProvider Handler
//
// Search index provider using trigram indexing for fast substring
// and regex text search across project files. Registers as a
// SearchIndex provider.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, complete, completeFrom,
  branch, mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `trigram-index-provider-${++idCounter}`;
}

const PROVIDER_REF = 'search:trigram';

const INSTANCE_RELATION = 'trigram-index-provider';
const POSTING_RELATION = 'trigram-index-provider-post';
const DOC_RELATION = 'trigram-index-provider-doc';

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

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, INSTANCE_RELATION, { providerRef: PROVIDER_REF }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (() => {
        const t = createProgram();
        return completeFrom(t, 'ok', (b) => ({
          instance: (b.existing as Record<string, unknown>[])[0].id as string,
        }));
      })(),
      (() => {
        const id = nextId();
        let e = createProgram();
        e = put(e, INSTANCE_RELATION, id, {
          id,
          providerRef: PROVIDER_REF,
        });
        return complete(e, 'ok', { instance: id }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  index(input: Record<string, unknown>) {
    const docId = input.docId as string;
    const text = input.text as string;

    let p = createProgram();
    p = put(p, DOC_RELATION, docId, { id: docId, text });

    const trigrams = extractTrigrams(text);
    for (const tri of trigrams) {
      const entryId = `${tri}::${docId}`;
      p = put(p, POSTING_RELATION, entryId, {
        id: entryId,
        trigram: tri,
        docId,
      });
    }

    return complete(p, 'ok', { docId, trigramCount: trigrams.length }) as StorageProgram<Result>;
  },

  search(input: Record<string, unknown>) {
    const query = input.query as string;

    const queryTrigrams = extractTrigrams(query);

    if (queryTrigrams.length === 0) {
      const p = createProgram();
      return complete(p, 'ok', { results: JSON.stringify([]) }) as StorageProgram<Result>;
    }

    // Fetch all posting entries and all docs, then intersect in completeFrom
    let p = createProgram();
    p = find(p, POSTING_RELATION, {}, 'allPostings');
    p = find(p, DOC_RELATION, {}, 'allDocs');

    return completeFrom(p, 'ok', (b) => {
      const allPostings = b.allPostings as Record<string, unknown>[];
      const allDocs = b.allDocs as Record<string, unknown>[];
      const docMap = new Map(allDocs.map(d => [d.id as string, d]));

      let candidateDocIds: Set<string> | null = null;

      for (const tri of queryTrigrams) {
        const docIds = new Set(
          allPostings
            .filter(e => e.trigram === tri)
            .map(e => e.docId as string)
        );

        if (candidateDocIds === null) {
          candidateDocIds = docIds;
        } else {
          const intersection = new Set<string>();
          for (const id of candidateDocIds) {
            if (docIds.has(id)) intersection.add(id);
          }
          candidateDocIds = intersection;
        }

        if (candidateDocIds.size === 0) break;
      }

      const lowerQuery = query.toLowerCase();
      const results: Array<{ docId: string; positions: number[] }> = [];
      for (const docId of candidateDocIds || []) {
        const doc = docMap.get(docId);
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

      return { results: JSON.stringify(results) };
    }) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const docId = input.docId as string;

    let p = createProgram();
    p = get(p, DOC_RELATION, docId, 'doc');

    return branch(p,
      (b) => !!b.doc,
      (() => {
        // Delete doc and its posting entries
        let e = createProgram();
        e = del(e, DOC_RELATION, docId);
        // Note: individual posting entries would need iterative del,
        // but we delete the doc record and complete
        return complete(e, 'ok', { docId }) as StorageProgram<Result>;
      })(),
      (() => {
        const e = createProgram();
        return complete(e, 'ok', { docId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const trigramIndexProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetTrigramIndexProviderCounter(): void {
  idCounter = 0;
}
