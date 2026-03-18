// @migrated dsl-constructs 2026-03-18
// SearchIndex Concept Implementation
// Build and maintain full-text and faceted search indexes with a pluggable processor pipeline.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const searchIndexHandlerFunctional: FunctionalConceptHandler = {
  createIndex(input: Record<string, unknown>) {
    const index = input.index as string;
    const config = input.config as string;

    let p = createProgram();
    p = spGet(p, 'index', index, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { index }),
      (b) => {
        let b2 = put(b, 'index', index, {
          index,
          config,
          processors: JSON.stringify([]),
          items: JSON.stringify({}),
        });
        return complete(b2, 'ok', { index });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  indexItem(input: Record<string, unknown>) {
    const index = input.index as string;
    const item = input.item as string;
    const data = input.data as string;

    let p = createProgram();
    p = spGet(p, 'index', index, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'index', index, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const processors: string[] = JSON.parse(record.processors as string);
          let processedData = data;
          for (const processor of processors) {
            if (processor === 'lowercase') processedData = processedData.toLowerCase();
            else if (processor === 'trim') processedData = processedData.trim();
          }
          const items: Record<string, string> = JSON.parse(record.items as string);
          items[item] = processedData;
          return { ...record, items: JSON.stringify(items) };
        });
        return complete(b2, 'ok', { index });
      },
      (b) => complete(b, 'notfound', { index }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  removeItem(input: Record<string, unknown>) {
    const index = input.index as string;
    const item = input.item as string;

    let p = createProgram();
    p = spGet(p, 'index', index, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'index', index, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const items: Record<string, string> = JSON.parse(record.items as string);
          delete items[item];
          return { ...record, items: JSON.stringify(items) };
        });
        return complete(b2, 'ok', { index });
      },
      (b) => complete(b, 'notfound', { index }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  search(input: Record<string, unknown>) {
    const index = input.index as string;
    const query = input.query as string;

    let p = createProgram();
    p = spGet(p, 'index', index, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const items: Record<string, string> = JSON.parse(record.items as string);
          const queryLower = query.toLowerCase();
          const results: Array<{ item: string; score: number }> = [];
          for (const [itemId, data] of Object.entries(items)) {
            const dataLower = data.toLowerCase();
            if (dataLower.includes(queryLower)) {
              const occurrences = dataLower.split(queryLower).length - 1;
              results.push({ item: itemId, score: occurrences });
            }
          }
          results.sort((a, b) => b.score - a.score);
          return JSON.stringify(results);
        }, 'resultsJson');
        return complete(b2, 'ok', { results: '' });
      },
      (b) => complete(b, 'notfound', { index }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addProcessor(input: Record<string, unknown>) {
    const index = input.index as string;
    const processor = input.processor as string;

    let p = createProgram();
    p = spGet(p, 'index', index, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'index', index, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const processors: string[] = JSON.parse(record.processors as string);
          processors.push(processor);
          return { ...record, processors: JSON.stringify(processors) };
        });
        return complete(b2, 'ok', { index });
      },
      (b) => complete(b, 'notfound', { index }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  reindex(input: Record<string, unknown>) {
    const index = input.index as string;

    let p = createProgram();
    p = spGet(p, 'index', index, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'index', index, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const processors: string[] = JSON.parse(record.processors as string);
          const items: Record<string, string> = JSON.parse(record.items as string);
          const reindexedItems: Record<string, string> = {};
          for (const [itemId, data] of Object.entries(items)) {
            let processedData = data;
            for (const processor of processors) {
              if (processor === 'lowercase') processedData = processedData.toLowerCase();
              else if (processor === 'trim') processedData = processedData.trim();
            }
            reindexedItems[itemId] = processedData;
          }
          return { ...record, items: JSON.stringify(reindexedItems) };
        });
        b2 = mapBindings(b2, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const items: Record<string, string> = JSON.parse(record.items as string);
          return Object.keys(items).length;
        }, 'count');
        return complete(b2, 'ok', { count: 0 });
      },
      (b) => complete(b, 'notfound', { index }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const searchIndexHandler = wrapFunctional(searchIndexHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { searchIndexHandlerFunctional };
