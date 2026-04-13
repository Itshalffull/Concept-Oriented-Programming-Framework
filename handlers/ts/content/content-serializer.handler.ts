// @clef-handler style=functional
// ContentSerializer Concept Implementation
// Manages a registry of serialization providers keyed by output format target
// (e.g. markdown, html, json, pdf). Dispatches serialize() requests to the
// registered provider for the given target and returns stub bytes — real
// provider tree-walking is wired via sync/perform in a later layer.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `content-serializer-provider-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    const provider = input.provider != null ? String(input.provider) : '';
    const target = input.target != null ? String(input.target) : '';
    const config = input.config != null ? String(input.config) : '';

    if (!provider || provider.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'provider must be a non-empty string',
      }) as StorageProgram<Result>;
    }
    if (!target || target.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'target must be a non-empty string',
      }) as StorageProgram<Result>;
    }

    // Check for duplicate: is there already a provider registered for this target?
    let p = createProgram();
    p = get(p, 'byTarget', target, 'existing');
    return branch(p,
      (b) => !!b.existing,
      (b) => complete(b, 'duplicate', { provider, target }) as StorageProgram<Result>,
      (b) => {
        const id = nextId();
        let b2 = put(b, 'providers', id, { id, name: provider, target, providerConfig: config });
        b2 = put(b2, 'byTarget', target, id);
        return complete(b2, 'ok', { id }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  serialize(input: Record<string, unknown>) {
    const target = input.target != null ? String(input.target) : '';
    const rootNodeId = input.rootNodeId != null ? String(input.rootNodeId) : '';

    if (!target || target.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'target must be a non-empty string',
      }) as StorageProgram<Result>;
    }
    if (!rootNodeId || rootNodeId.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'rootNodeId must be a non-empty string',
      }) as StorageProgram<Result>;
    }

    // Look up registered provider for this target
    let p = createProgram();
    p = get(p, 'byTarget', target, 'providerId');
    return branch(p,
      (b) => !b.providerId,
      (b) => complete(b, 'no_provider', { target }) as StorageProgram<Result>,
      (b) => {
        // Stub bytes — real provider walks the ContentNode tree via perform/sync wiring
        const bytes = JSON.stringify({ target, rootNodeId, providerId: b.providerId });
        return complete(b, 'ok', { bytes }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  listTargets(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'byTarget', {}, 'allEntries');
    return completeFrom(p, 'ok', (b) => {
      const entries = (b.allEntries || []) as Array<{ key: string }>;
      const targets = entries.map((e) => e.key).sort();
      return { targets };
    }) as StorageProgram<Result>;
  },
};

export const contentSerializerHandler = autoInterpret(_handler);
