// @clef-handler style=functional
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
  createProgram, get, find, put, del, branch, complete, completeFrom, mapBindings, putFrom, delFrom, traverse,
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
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const hash = input.hash as string;

    let p = createProgram();
    p = find(p, 'ref', { name }, 'existingRefs');

    p = branch(p,
      (bindings) => {
        const refs = bindings.existingRefs as Record<string, unknown>[];
        return refs.length > 0;
      },
      (b) => complete(b, 'exists', { message: `A ref with name '${name}' already exists` }),
      (b) => {
        const id = nextId();
        let b2 = put(b, 'ref', id, { id, name, target: hash });

        // Write reflog entry with sequence number for ordering
        const seq = idCounter;
        const ts = new Date().toISOString();
        const logKey = `${name}-${String(seq).padStart(10, '0')}`;
        b2 = put(b2, 'ref-log', logKey, {
          name,
          oldHash: '',
          newHash: hash,
          timestamp: ts,
          agent: 'system',
          seq,
        });

        return complete(b2, 'ok', { ref: id });
      },
    );

    return p as StorageProgram<Result>;
  },

  update(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const newHash = input.newHash as string;
    const expectedOldHash = input.expectedOldHash as string;

    let p = createProgram();
    p = find(p, 'ref', { name }, 'existingRefs');

    p = branch(p,
      (bindings) => {
        const refs = bindings.existingRefs as Record<string, unknown>[];
        return refs.length === 0;
      },
      (b) => {
        // No ref with this name — create it (upsert behavior; spec says -> ok when no ref found)
        const id = nextId();
        const seq = idCounter;
        const ts = new Date().toISOString();
        const logKey = `${name}-${String(seq).padStart(10, '0')}`;
        let b2 = put(b, 'ref', id, { id, name, target: newHash });
        b2 = put(b2, 'ref-log', logKey, {
          name, oldHash: expectedOldHash, newHash, timestamp: ts, agent: 'system', seq,
        });
        return complete(b2, 'ok', {});
      },
      (b) => {
        // Extract the first record's info
        let b2 = mapBindings(b, (bindings) => {
          const refs = bindings.existingRefs as Record<string, unknown>[];
          const record = refs[0];
          return {
            key: record._key as string,
            currentHash: record.target as string,
            record,
          };
        }, '_refInfo');

        b2 = branch(b2,
          (bindings) => {
            const info = bindings._refInfo as Record<string, unknown>;
            return (info.currentHash as string) !== expectedOldHash;
          },
          (t) => completeFrom(t, 'conflict', (bindings) => {
            const info = bindings._refInfo as Record<string, unknown>;
            return { current: info.currentHash as string };
          }),
          (e) => {
            // Update the ref target using traverse over the single-element array
            let e2 = traverse(e, 'existingRefs', '_refItem', (item) => {
              const record = item as Record<string, unknown>;
              const key = record._key as string;
              let sub = createProgram();
              sub = put(sub, 'ref', key, { ...record, target: newHash });
              return complete(sub, 'ok', {});
            }, '_updateResults', { writes: ['ref'], completionVariants: ['updated'] });

            // Write reflog entry
            const seq = ++idCounter;
            const ts = new Date().toISOString();
            const logKey = `${name}-${String(seq).padStart(10, '0')}`;
            e2 = put(e2, 'ref-log', logKey, {
              name,
              oldHash: expectedOldHash,
              newHash,
              timestamp: ts,
              agent: 'system',
              seq,
            });

            return complete(e2, 'ok', {});
          },
        );

        return b2;
      },
    );

    return p as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;

    let p = createProgram();

    // Check for protected refs
    if (name === 'HEAD' || name.startsWith('protected/')) {
      return complete(p, 'protected', { message: `Ref '${name}' is protected and cannot be deleted` }) as StorageProgram<Result>;
    }

    p = find(p, 'ref', { name }, 'existingRefs');

    p = branch(p,
      (bindings) => {
        const refs = bindings.existingRefs as Record<string, unknown>[];
        return refs.length === 0;
      },
      (b) => complete(b, 'ok', { message: `No ref with name '${name}'` }),
      (b) => {
        // Use traverse over the found refs to delete each and write reflog
        let b2 = traverse(b, 'existingRefs', '_refItem', (item) => {
          const record = item as Record<string, unknown>;
          const key = record._key as string;
          const oldHash = record.target as string;
          let sub = createProgram();
          sub = del(sub, 'ref', key);

          // Write reflog entry for deletion
          const seq = ++idCounter;
          const ts = new Date().toISOString();
          const logKey = `${name}-${String(seq).padStart(10, '0')}`;
          sub = put(sub, 'ref-log', logKey, {
            name,
            oldHash,
            newHash: '',
            timestamp: ts,
            agent: 'system',
            seq,
          });

          return complete(sub, 'ok', {});
        }, '_deleteResults', { writes: ['ref', 'ref-log'], completionVariants: ['deleted'] });

        return complete(b2, 'ok', {});
      },
    );

    return p as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = find(p, 'ref', { name }, 'refs');

    p = branch(p,
      (bindings) => {
        const refs = bindings.refs as Record<string, unknown>[];
        return refs.length === 0;
      },
      (b) => complete(b, 'notFound', { message: `No ref with name '${name}'` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const refs = bindings.refs as Record<string, unknown>[];
        return { hash: refs[0].target as string };
      }),
    );

    return p as StorageProgram<Result>;
  },

  log(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = find(p, 'ref', { name }, 'refs');
    p = find(p, 'ref-log', { name }, 'logEntries');

    p = branch(p,
      (bindings) => {
        const refs = bindings.refs as Record<string, unknown>[];
        const logEntries = bindings.logEntries as Record<string, unknown>[];
        return refs.length === 0 && logEntries.length === 0;
      },
      (b) => complete(b, 'notFound', { message: `No ref with name '${name}'` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const logEntries = bindings.logEntries as Record<string, unknown>[];
        const entries = logEntries.map(entry => ({
          oldHash: entry.oldHash as string,
          newHash: entry.newHash as string,
          timestamp: entry.timestamp as string,
          agent: entry.agent as string,
          seq: (entry.seq as number) || 0,
        }));
        entries.sort((a, b) => b.seq - a.seq);
        return { entries };
      }),
    );
    return p as StorageProgram<Result>;
  },
};

// All actions are now fully functional — no imperative overrides needed.
export const refHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetRefCounter(): void {
  idCounter = 0;
}
