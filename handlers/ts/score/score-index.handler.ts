// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ScoreIndex Concept Implementation
//
// Materialized index backing ScoreApi queries. Maintains
// denormalized views of the five Score layers optimized for
// fast LLM-friendly lookups. Auto-registered as a built-in
// concept in every Clef runtime.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, complete, completeFrom, get, find, put, del, delMany, branch, mapBindings, type StorageProgram,
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

    // Check if the file entry exists
    p = get(p, 'files', fileId, 'existing');

    // Delete related records from all relations matching this file
    p = delMany(p, 'symbols', { file: path }, 'deletedSymbols');
    p = delMany(p, 'concepts', { file: path }, 'deletedConcepts');
    p = delMany(p, 'syncs', { file: path }, 'deletedSyncs');

    // Remove file entry if it exists
    return branch(p, 'existing',
      (thenP) => {
        thenP = del(thenP, 'files', fileId);
        return completeFrom(thenP, 'ok', (bindings) => ({
          removed: 1 +
            (bindings.deletedSymbols as number) +
            (bindings.deletedConcepts as number) +
            (bindings.deletedSyncs as number),
        }));
      },
      (elseP) => {
        return completeFrom(elseP, 'ok', (bindings) => ({
          removed:
            (bindings.deletedSymbols as number) +
            (bindings.deletedConcepts as number) +
            (bindings.deletedSyncs as number),
        }));
      },
    ) as StorageProgram<Result>;
  },

  clear(_input: Record<string, unknown>) {
    let p = createProgram();

    // Delete all records from each relation
    p = delMany(p, 'concepts', {}, 'deletedConcepts');
    p = delMany(p, 'syncs', {}, 'deletedSyncs');
    p = delMany(p, 'symbols', {}, 'deletedSymbols');
    p = delMany(p, 'files', {}, 'deletedFiles');

    return completeFrom(p, 'ok', (bindings) => ({
      cleared:
        (bindings.deletedConcepts as number) +
        (bindings.deletedSyncs as number) +
        (bindings.deletedSymbols as number) +
        (bindings.deletedFiles as number),
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
