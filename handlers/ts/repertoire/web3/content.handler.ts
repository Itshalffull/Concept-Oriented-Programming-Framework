// @migrated dsl-constructs 2026-03-18
// ============================================================
// Content Concept Implementation
//
// Manage IPFS content storage with CID tracking, pinning,
// and retrieval. Stores content metadata in concept storage;
// actual bytes go to IPFS via the configured storage adapter.
//
// NOTE: This handler uses perform() for IPFS transport effects
// rather than direct ipfsClient calls, making the transport
// dependency explicit and inspectable. The imperative ipfsClient
// interface is preserved for backward compatibility via
// setIPFSClient(), but the functional handler uses perform().
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  mapBindings, perform, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

/** IPFS client interface — injected at concept instantiation */
interface IPFSClient {
  add(data: Uint8Array | string): Promise<{ cid: string; size: number }>;
  get(cid: string): Promise<Uint8Array>;
  pin(cid: string): Promise<void>;
  unpin(cid: string): Promise<void>;
}

// Default no-op IPFS client (replaced at deployment)
let ipfsClient: IPFSClient = {
  async add(data) {
    // Deterministic CID stub for testing
    const encoder = new TextEncoder();
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const cid = 'Qm' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 44);
    return { cid, size: bytes.length };
  },
  async get() { return new Uint8Array(); },
  async pin() {},
  async unpin() {},
};

/** Configure the IPFS client for this concept instance */
export function setIPFSClient(client: IPFSClient): void {
  ipfsClient = client;
}

type Result = { variant: string; [key: string]: unknown };

const _contentHandler: FunctionalConceptHandler = {
  store(input: Record<string, unknown>) {
    const data = input.data as Uint8Array | string;
    const name = input.name as string;
    const contentType = input.contentType as string;

    let p = createProgram();
    // Use perform for IPFS add transport effect
    p = perform(p, 'ipfs', 'add', { data }, 'ipfsResult');

    p = mapBindings(p, (bindings) => {
      const result = bindings.ipfsResult as { cid: string; size: number };
      return result;
    }, 'addResult');

    p = branch(p,
      (bindings) => !!(bindings.addResult as Record<string, unknown>)?.cid,
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const result = bindings.addResult as { cid: string; size: number };
          return result.cid;
        }, 'cid');
        b2 = mapBindings(b2, (bindings) => {
          const result = bindings.addResult as { cid: string; size: number };
          return result.size;
        }, 'size');
        return completeFrom(b2, 'ok', (bindings) => {
          const cid = bindings.cid as string;
          const size = bindings.size as number;
          return { cid, size };
        });
      },
      (b) => complete(b, 'error', { message: 'IPFS add failed' }),
    );

    return p as StorageProgram<Result>;
  },

  pin(input: Record<string, unknown>) {
    const cid = input.cid as string;

    let p = createProgram();
    // Use perform for IPFS pin transport effect
    p = perform(p, 'ipfs', 'pin', { cid }, 'pinResult');
    p = get(p, 'items', cid, 'existing');

    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, pinned: true };
        }, 'updated');
        b2 = put(b2, 'items', cid, {});
        return complete(b2, 'ok', { cid });
      },
      (b) => complete(b, 'ok', { cid }),
    );

    return p as StorageProgram<Result>;
  },

  unpin(input: Record<string, unknown>) {
    const cid = input.cid as string;

    let p = createProgram();
    // Use perform for IPFS unpin transport effect
    p = perform(p, 'ipfs', 'unpin', { cid }, 'unpinResult');
    p = get(p, 'items', cid, 'existing');

    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, pinned: false };
        }, 'updated');
        b2 = put(b2, 'items', cid, {});
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
        // Use perform for IPFS get transport effect
        let b2 = perform(b, 'ipfs', 'get', { cid }, 'ipfsData');
        return completeFrom(b2, 'ok', (bindings) => {
          const meta = bindings.meta as Record<string, unknown>;
          return {
            data: bindings.ipfsData,
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
