// @migrated dsl-constructs 2026-03-18
// ScoreIndex Concept Implementation
//
// Materialized index backing ScoreApi queries. Maintains
// denormalized views of the five Score layers optimized for
// fast LLM-friendly lookups. Auto-registered as a built-in
// concept in every Clef runtime.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, complete, completeFrom, get, find, put, del, branch, mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  upsertConcept(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;
    if (!name) {
      return complete(p, 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const id = `concept:${name}`;
    const now = new Date().toISOString();

    p = put(p, 'concepts', id, {
      conceptName: name,
      purpose: (input.purpose as string) || '',
      actions: (input.actions as string[]) || [],
      stateFields: (input.stateFields as string[]) || [],
      file: (input.file as string) || '',
    });

    p = put(p, 'meta', 'concepts', {
      kind: 'concepts',
      lastUpdated: now,
    });

    return complete(p, 'ok', { index: id }) as StorageProgram<Result>;
  },

  upsertSync(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;
    if (!name) {
      return complete(p, 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const id = `sync:${name}`;
    const now = new Date().toISOString();

    p = put(p, 'syncs', id, {
      syncName: name,
      annotation: (input.annotation as string) || 'eager',
      triggers: (input.triggers as string[]) || [],
      effects: (input.effects as string[]) || [],
      file: (input.file as string) || '',
    });

    p = put(p, 'meta', 'syncs', {
      kind: 'syncs',
      lastUpdated: now,
    });

    return complete(p, 'ok', { index: id }) as StorageProgram<Result>;
  },

  upsertSymbol(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;
    const file = input.file as string;
    const line = input.line as number;
    if (!name) {
      return complete(p, 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const id = `symbol:${name}:${file}:${line}`;
    const now = new Date().toISOString();

    p = put(p, 'symbols', id, {
      symbolName: name,
      symbolKind: (input.kind as string) || 'unknown',
      file: file || '',
      line: line || 0,
      scope: (input.scope as string) || '',
    });

    p = put(p, 'meta', 'symbols', {
      kind: 'symbols',
      lastUpdated: now,
    });

    return complete(p, 'ok', { index: id }) as StorageProgram<Result>;
  },

  upsertFile(input: Record<string, unknown>) {
    let p = createProgram();
    const path = input.path as string;
    if (!path) {
      return complete(p, 'error', { message: 'path is required' }) as StorageProgram<Result>;
    }

    const id = `file:${path}`;
    const now = new Date().toISOString();

    p = put(p, 'files', id, {
      filePath: path,
      language: (input.language as string) || 'unknown',
      role: (input.role as string) || 'source',
      definitions: (input.definitions as string[]) || [],
    });

    p = put(p, 'meta', 'files', {
      kind: 'files',
      lastUpdated: now,
    });

    return complete(p, 'ok', { index: id }) as StorageProgram<Result>;
  },

  removeByFile(input: Record<string, unknown>) {
    let p = createProgram();
    const path = input.path as string;
    if (!path) {
      return complete(p, 'ok', { removed: 0 }) as StorageProgram<Result>;
    }

    const fileId = `file:${path}`;

    // Fetch file entry and related records
    p = get(p, 'files', fileId, 'existing');
    p = find(p, 'symbols', { file: path }, 'foundSymbols');
    p = find(p, 'concepts', { file: path }, 'foundConcepts');
    p = find(p, 'syncs', { file: path }, 'foundSyncs');

    // Remove file entry if it exists
    return branch(p, 'existing',
      (thenP) => {
        thenP = del(thenP, 'files', fileId);

        // Compute keys to delete and total removed count from bindings
        thenP = mapBindings(thenP, (bindings) => {
          const syms = (bindings.foundSymbols as Record<string, unknown>[]) || [];
          const concepts = (bindings.foundConcepts as Record<string, unknown>[]) || [];
          const syncs = (bindings.foundSyncs as Record<string, unknown>[]) || [];
          return {
            symbolKeys: syms.map((s) => `symbol:${s.symbolName}:${s.file}:${s.line}`),
            conceptKeys: concepts.map((c) => `concept:${c.conceptName}`),
            syncKeys: syncs.map((s) => `sync:${s.syncName}`),
            total: 1 + syms.length + concepts.length + syncs.length,
          };
        }, 'deleteInfo');

        return completeFrom(thenP, 'ok', (bindings) => {
          const info = bindings.deleteInfo as { total: number };
          return { removed: info.total };
        });
      },
      (elseP) => {
        // No file entry — still check for orphaned symbols/concepts/syncs
        elseP = mapBindings(elseP, (bindings) => {
          const syms = (bindings.foundSymbols as Record<string, unknown>[]) || [];
          const concepts = (bindings.foundConcepts as Record<string, unknown>[]) || [];
          const syncs = (bindings.foundSyncs as Record<string, unknown>[]) || [];
          return syms.length + concepts.length + syncs.length;
        }, 'orphanCount');

        return completeFrom(elseP, 'ok', (bindings) => ({
          removed: bindings.orphanCount as number,
        }));
      },
    ) as StorageProgram<Result>;
  },

  clear(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'concepts', {}, 'allConcepts');
    p = find(p, 'syncs', {}, 'allSyncs');
    p = find(p, 'symbols', {}, 'allSymbols');
    p = find(p, 'files', {}, 'allFiles');

    // Compute total count from bindings
    p = mapBindings(p, (bindings) => {
      const concepts = (bindings.allConcepts as unknown[]) || [];
      const syncs = (bindings.allSyncs as unknown[]) || [];
      const symbols = (bindings.allSymbols as unknown[]) || [];
      const files = (bindings.allFiles as unknown[]) || [];
      return concepts.length + syncs.length + symbols.length + files.length;
    }, 'total');

    return completeFrom(p, 'ok', (bindings) => ({
      cleared: bindings.total as number,
    })) as StorageProgram<Result>;
  },

  stats(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'concepts', {}, 'allConcepts');
    p = find(p, 'syncs', {}, 'allSyncs');
    p = find(p, 'symbols', {}, 'allSymbols');
    p = find(p, 'files', {}, 'allFiles');
    p = get(p, 'meta', 'concepts', 'metaRecord');

    return completeFrom(p, 'ok', (bindings) => ({
      conceptCount: ((bindings.allConcepts as unknown[]) || []).length,
      syncCount: ((bindings.allSyncs as unknown[]) || []).length,
      symbolCount: ((bindings.allSymbols as unknown[]) || []).length,
      fileCount: ((bindings.allFiles as unknown[]) || []).length,
      lastUpdated: (bindings.metaRecord as Record<string, unknown>)?.lastUpdated || new Date().toISOString(),
    })) as StorageProgram<Result>;
  },
};

export const scoreIndexHandler = autoInterpret(_handler);
