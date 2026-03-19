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
import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';
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
        seq: (entry.seq as number) || 0,
      }));

      // Sort by sequence number descending for deterministic ordering
      entries.sort((a, b) => b.seq - a.seq);

      return { entries };
    }) as StorageProgram<Result>;
  },
};

const baseHandler = autoInterpret(_handler);

// create, update, delete, resolve need imperative style for dynamic storage keys and reflog writes
const handler: ConceptHandler = {
  ...baseHandler,

  async create(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const hash = input.hash as string;

    const existing = await storage.find('ref', { name });
    if (existing.length > 0) {
      return { variant: 'exists', message: `A ref with name '${name}' already exists` };
    }

    const id = nextId();
    await storage.put('ref', id, { id, name, target: hash });

    // Write reflog entry with sequence number for ordering
    const seq = idCounter;
    const ts = new Date().toISOString();
    const logKey = `${name}-${String(seq).padStart(10, '0')}`;
    await storage.put('ref-log', logKey, {
      name,
      oldHash: '',
      newHash: hash,
      timestamp: ts,
      agent: 'system',
      seq,
    });

    return { variant: 'ok', ref: id };
  },

  async update(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const newHash = input.newHash as string;
    const expectedOldHash = input.expectedOldHash as string;

    const existing = await storage.find('ref', { name });
    if (existing.length === 0) {
      return { variant: 'notFound', message: `No ref with name '${name}'` };
    }

    const record = existing[0];
    const currentHash = record.target as string;
    if (currentHash !== expectedOldHash) {
      return { variant: 'conflict', current: currentHash };
    }

    // Update the ref target
    const key = record._key as string;
    await storage.put('ref', key, { ...record, target: newHash });

    // Write reflog entry with sequence number for ordering
    const seq = ++idCounter;
    const ts = new Date().toISOString();
    const logKey = `${name}-${String(seq).padStart(10, '0')}`;
    await storage.put('ref-log', logKey, {
      name,
      oldHash: currentHash,
      newHash,
      timestamp: ts,
      agent: 'system',
      seq,
    });

    return { variant: 'ok' };
  },

  async delete(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;

    // Check for protected refs
    if (name === 'HEAD' || name.startsWith('protected/')) {
      return { variant: 'protected', message: `Ref '${name}' is protected and cannot be deleted` };
    }

    const existing = await storage.find('ref', { name });
    if (existing.length === 0) {
      return { variant: 'notFound', message: `No ref with name '${name}'` };
    }

    const record = existing[0];
    const key = record._key as string;
    const oldHash = record.target as string;
    await storage.del('ref', key);

    // Write reflog entry for deletion with sequence number for ordering
    const seq = ++idCounter;
    const ts = new Date().toISOString();
    const logKey = `${name}-${String(seq).padStart(10, '0')}`;
    await storage.put('ref-log', logKey, {
      name,
      oldHash,
      newHash: '',
      timestamp: ts,
      agent: 'system',
      seq,
    });

    return { variant: 'ok' };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;

    const results = await storage.find('ref', { name });
    if (results.length === 0) {
      return { variant: 'notFound', message: `No ref with name '${name}'` };
    }

    return { variant: 'ok', hash: results[0].target as string };
  },
};

export const refHandler = handler as FunctionalConceptHandler & ConceptHandler;

/** Reset the ID counter. Useful for testing. */
export function resetRefCounter(): void {
  idCounter = 0;
}
