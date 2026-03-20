// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Registry Concept Implementation
//
// Tracks deployed concepts, their locations, and availability.
// Stores concept registrations with URIs and transport configs.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, traverse, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import { generateId } from '../../../runtime/types.js';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const uri = input.uri as string;
    const transport = input.transport as Record<string, unknown>;

    let p = createProgram();
    p = find(p, 'concepts', { uri }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => complete(thenP, 'error', { message: `Concept already registered: ${uri}` }),
      (elseP) => {
        const conceptId = generateId();
        let p2 = put(elseP, 'concepts', conceptId, { conceptId, uri });
        p2 = put(p2, 'uri', conceptId, { conceptId, uri });
        p2 = put(p2, 'transport', conceptId, { conceptId, ...(transport || {}) });
        p2 = put(p2, 'available', conceptId, { conceptId, available: true });
        return complete(p2, 'ok', { concept: conceptId });
      },
    ) as StorageProgram<Result>;
  },

  /**
   * Deregister all concept records matching the given URI.
   * Uses traverse to iterate over matching records and delete
   * all associated entries (concepts, uri, transport, available).
   */
  deregister(input: Record<string, unknown>) {
    const uri = input.uri as string;

    let p = createProgram();
    p = find(p, 'concepts', { uri }, 'matches');

    return branch(p,
      (bindings) => (bindings.matches as unknown[]).length > 0,
      (thenP) => {
        let t = traverse(thenP, 'matches', '_match', (item) => {
          const match = item as Record<string, unknown>;
          const key = (match._key as string) || (match.conceptId as string);
          let sub = createProgram();
          sub = del(sub, 'concepts', key);
          sub = del(sub, 'uri', key);
          sub = del(sub, 'transport', key);
          sub = del(sub, 'available', key);
          return complete(sub, 'ok', {});
        }, '_deleteResults');
        return complete(t, 'ok', {});
      },
      (elseP) => complete(elseP, 'ok', {}),
    ) as StorageProgram<Result>;
  },

  heartbeat(input: Record<string, unknown>) {
    const uri = input.uri as string;

    let p = createProgram();
    p = find(p, 'concepts', { uri }, 'matches');

    return branch(p,
      (bindings) => (bindings.matches as unknown[]).length === 0,
      (thenP) => complete(thenP, 'ok', { available: false }),
      (elseP) => {
        return completeFrom(elseP, 'ok', (bindings) => {
          const matches = bindings.matches as Array<Record<string, unknown>>;
          return { available: true };
        });
      },
    ) as StorageProgram<Result>;
  },
};

// All actions are now fully functional — no imperative overrides needed.
export const registryHandler = autoInterpret(_handler);
