// @migrated dsl-constructs 2026-03-18
// ============================================================
// Content Concept Implementation
//
// Manage IPFS content storage with CID tracking, pinning,
// and retrieval. Stores content metadata in concept storage;
// actual bytes go to IPFS via perform() transport effects
// routed to the configured IPFS adapter.
//
// IPFS operations are modeled as perform() transport effects
// on the 'ipfs' protocol. The interpreter routes these to
// the IPFS transport adapter at runtime.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, putFrom, branch, complete, completeFrom, perform,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _contentHandler: FunctionalConceptHandler = {
  store(input: Record<string, unknown>) {
    const data = input.data as string;
    const name = input.name as string;
    const contentType = input.contentType as string;

    let p = createProgram();
    // IPFS add + metadata storage via transport effect.
    // The ipfs transport adapter adds bytes, returns { cid, size },
    // and the interpreter persists metadata to the 'items' relation
    // using the CID as key (keyed by the result's cid field).
    p = perform(p, 'ipfs', 'add', {
      data,
      name,
      contentType,
      pinned: false,
      createdAt: new Date().toISOString(),
    }, 'ipfsResult');
    return completeFrom(p, 'ok', (bindings) => {
      const result = bindings.ipfsResult as Record<string, unknown>;
      return {
        cid: result.cid as string,
        size: result.size as number,
      };
    }) as StorageProgram<Result>;
  },

  pin(input: Record<string, unknown>) {
    const cid = input.cid as string;

    let p = createProgram();
    // Pin via IPFS transport effect
    p = perform(p, 'ipfs', 'pin', { cid }, 'pinResult');
    p = get(p, 'items', cid, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, pinned: true };
        }, 'updated');
        b2 = putFrom(b2, 'items', cid, (bindings) => bindings.updated as Record<string, unknown>);
        return complete(b2, 'ok', { cid });
      },
      (b) => complete(b, 'ok', { cid }),
    );
    return p as StorageProgram<Result>;
  },

  unpin(input: Record<string, unknown>) {
    const cid = input.cid as string;

    let p = createProgram();
    // Unpin via IPFS transport effect
    p = perform(p, 'ipfs', 'unpin', { cid }, 'unpinResult');
    p = get(p, 'items', cid, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, pinned: false };
        }, 'updated');
        b2 = putFrom(b2, 'items', cid, (bindings) => bindings.updated as Record<string, unknown>);
        return complete(b2, 'ok', { cid });
      },
      (b) => complete(b, 'ok', { cid }),
    );
    return p as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const cid = input.cid as string;

    let p = createProgram();
    p = get(p, 'items', cid, 'meta');
    p = branch(p, 'meta',
      (b) => {
        // Fetch bytes via IPFS transport effect
        let b2 = perform(b, 'ipfs', 'get', { cid }, 'ipfsData');
        return completeFrom(b2, 'ok', (bindings) => {
          const meta = bindings.meta as Record<string, unknown>;
          const data = bindings.ipfsData as unknown;
          return {
            data,
            contentType: meta.contentType as string,
            size: meta.size as number,
          };
        });
      },
      (b) => complete(b, 'notFound', { cid }),
    );
    return p as StorageProgram<Result>;
  },
};

export const contentHandler = autoInterpret(_contentHandler);
