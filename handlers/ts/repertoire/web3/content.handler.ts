// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Content Concept Implementation
//
// Manage content storage with CID tracking, pinning,
// and retrieval. Stores content metadata and data in concept
// storage, keyed by a deterministic content-addressed ID (CID)
// derived from a SHA-256 hash of the data.
// ============================================================

import { createHash } from 'crypto';
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

/** Compute a deterministic content-addressed ID from data. */
function computeCid(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

const _contentHandler: FunctionalConceptHandler = {
  store(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const data = input.data as string;
    const name = input.name as string;
    const contentType = input.contentType as string;

    const cid = computeCid(data);
    const size = data.length;

    let p = createProgram();
    // Store content metadata and data to the 'items' relation,
    // keyed by the deterministic CID.
    p = put(p, 'items', cid, {
      cid,
      data,
      name,
      contentType,
      size,
      pinned: false,
      createdAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { cid, size }) as StorageProgram<Result>;
  },

  pin(input: Record<string, unknown>) {
    if (!input.cid || (typeof input.cid === 'string' && (input.cid as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'cid is required' }) as StorageProgram<Result>;
    }
    const cid = input.cid as string;

    let p = createProgram();
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
    if (!input.cid || (typeof input.cid === 'string' && (input.cid as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'cid is required' }) as StorageProgram<Result>;
    }
    const cid = input.cid as string;

    let p = createProgram();
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
        return completeFrom(b, 'ok', (bindings) => {
          const meta = bindings.meta as Record<string, unknown>;
          return {
            data: meta.data,
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
