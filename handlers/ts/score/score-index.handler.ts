// @migrated dsl-constructs 2026-03-18
// ScoreIndex Concept Implementation
//
// Materialized index backing ScoreApi queries. Maintains
// denormalized views of the five Score layers optimized for
// fast LLM-friendly lookups. Auto-registered as a built-in
// concept in every Clef runtime.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
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

    let removed = 0;

    // Remove file entry
    const fileId = `file:${path}`;
    p = get(p, 'files', fileId, 'existing');
    if (existing) {
      p = del(p, 'files', fileId);
      removed++;
    }

    // Remove symbols from this file
    p = find(p, 'symbols', { file: path }, 'symbols');
    for (const sym of symbols) {
      const symId = `symbol:${sym.symbolName}:${sym.file}:${sym.line}`;
      p = del(p, 'symbols', symId);
      removed++;
    }

    // Remove concepts from this file
    p = find(p, 'concepts', { file: path }, 'concepts');
    for (const c of concepts) {
      const cId = `concept:${c.conceptName}`;
      p = del(p, 'concepts', cId);
      removed++;
    }

    // Remove syncs from this file
    p = find(p, 'syncs', { file: path }, 'syncs');
    for (const s of syncs) {
      const sId = `sync:${s.syncName}`;
      p = del(p, 'syncs', sId);
      removed++;
    }

    return complete(p, 'ok', { removed }) as StorageProgram<Result>;
  },

  clear(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'concepts', 'concepts');
    p = find(p, 'syncs', 'syncs');
    p = find(p, 'symbols', 'symbols');
    p = find(p, 'files', 'files');

    const total = concepts.length + syncs.length + symbols.length + files.length;

    for (const c of concepts) p = del(p, 'concepts', `concept:${c.conceptName}`);
    for (const s of syncs) p = del(p, 'syncs', `sync:${s.syncName}`);
    for (const sym of symbols) p = del(p, 'symbols', `symbol:${sym.symbolName}:${sym.file}:${sym.line}`);
    for (const f of files) p = del(p, 'files', `file:${f.filePath}`);

    return complete(p, 'ok', { cleared: total }) as StorageProgram<Result>;
  },

  stats(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'concepts', 'concepts');
    p = find(p, 'syncs', 'syncs');
    p = find(p, 'symbols', 'symbols');
    p = find(p, 'files', 'files');
    p = get(p, 'meta', 'concepts', 'meta');

    return complete(p, 'ok', {
      conceptCount: concepts.length,
      syncCount: syncs.length,
      symbolCount: symbols.length,
      fileCount: files.length,
      lastUpdated: meta?.lastUpdated || new Date().toISOString(),
    }) as StorageProgram<Result>;
  },
};

export const scoreIndexHandler = autoInterpret(_handler);
