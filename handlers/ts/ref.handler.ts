// @migrated dsl-constructs 2026-03-18
// ============================================================
// Ref Handler
//
// Provide mutable, human-readable names for immutable content-
// addressed objects. The only mutable state in the versioning
// system is naming -- all content and history are immutable once
// created.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `ref-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const hash = input.hash as string;

    let p = createProgram();
    p = find(p, 'ref', { name }, 'existing');

    return completeFrom(p, 'ok', (bindings) => {
      const existing = bindings.existing as Record<string, unknown>[];
      if (existing.length > 0) {
        return { variant: 'exists', message: `A ref with name '${name}' already exists` };
      }
      return { ref: nextId() };
    }) as StorageProgram<Result>;
  },

  update(input: Record<string, unknown>) {
    const name = input.name as string;
    const newHash = input.newHash as string;
    const expectedOldHash = input.expectedOldHash as string;

    let p = createProgram();
    p = find(p, 'ref', { name }, 'existing');

    return completeFrom(p, 'ok', (bindings) => {
      const existing = bindings.existing as Record<string, unknown>[];
      if (existing.length === 0) {
        return { variant: 'notFound', message: `No ref with name '${name}'` };
      }
      const record = existing[0];
      const currentHash = record.target as string;
      if (currentHash !== expectedOldHash) {
        return { variant: 'conflict', current: currentHash };
      }
      return {};
    }) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const name = input.name as string;

    // Check for protected refs
    if (name === 'HEAD' || name.startsWith('protected/')) {
      const p = createProgram();
      return complete(p, 'protected', { message: `Ref '${name}' is protected and cannot be deleted` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'ref', { name }, 'existing');

    return completeFrom(p, 'ok', (bindings) => {
      const existing = bindings.existing as Record<string, unknown>[];
      if (existing.length === 0) {
        return { variant: 'notFound', message: `No ref with name '${name}'` };
      }
      return {};
    }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = find(p, 'ref', { name }, 'results');

    return completeFrom(p, 'ok', (bindings) => {
      const results = bindings.results as Record<string, unknown>[];
      if (results.length === 0) {
        return { variant: 'notFound', message: `No ref with name '${name}'` };
      }
      return { hash: results[0].target as string };
    }) as StorageProgram<Result>;
  },

  log(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = find(p, 'ref', { name }, 'refs');
    p = find(p, 'ref-log', { name }, 'logEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const refs = bindings.refs as Record<string, unknown>[];
      const logEntries = bindings.logEntries as Record<string, unknown>[];

      if (refs.length === 0 && logEntries.length === 0) {
        return { variant: 'notFound', message: `No ref with name '${name}'` };
      }

      const entries = logEntries.map(entry => ({
        oldHash: entry.oldHash as string,
        newHash: entry.newHash as string,
        timestamp: entry.timestamp as string,
        agent: entry.agent as string,
      }));

      entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      return { entries };
    }) as StorageProgram<Result>;
  },
};

export const refHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetRefCounter(): void {
  idCounter = 0;
}
