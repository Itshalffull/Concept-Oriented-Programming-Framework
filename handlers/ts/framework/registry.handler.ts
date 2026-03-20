// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Registry Concept Implementation
//
// Tracks deployed concepts, their locations, and availability.
// Stores concept registrations with URIs and transport configs.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import type { ConceptStorage } from '../../../runtime/types.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
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

  deregister(input: Record<string, unknown>) {
    const uri = input.uri as string;

    let p = createProgram();
    p = find(p, 'concepts', { uri }, 'matches');

    return branch(p,
      (bindings) => (bindings.matches as unknown[]).length > 0,
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          // Note: In the functional DSL, we cannot do conditional deletes
          // based on runtime bindings with static keys. The deletes are
          // handled by the branch confirming matches exist.
          return {};
        });
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

const _base = autoInterpret(_handler);

// deregister requires deleting records found via find() with dynamic keys.
async function _deregister(input: Record<string, unknown>, storage: ConceptStorage) {
  const uri = input.uri as string;

  const matches = await storage.find('concepts', { uri });
  if (!matches || matches.length === 0) {
    return { variant: 'ok' };
  }

  for (const match of matches) {
    const key = match._key as string || match.conceptId as string;
    await storage.del('concepts', key);
    await storage.del('uri', key);
    await storage.del('transport', key);
    await storage.del('available', key);
  }

  return { variant: 'ok' };
}

export const registryHandler = new Proxy(_base, {
  get(target, prop: string) {
    if (prop === 'deregister') return _deregister;
    return (target as Record<string, unknown>)[prop];
  },
}) as typeof _base;
