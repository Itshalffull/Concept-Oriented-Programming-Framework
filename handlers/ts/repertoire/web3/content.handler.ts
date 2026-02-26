// ============================================================
// Content Concept Implementation
//
// Manage IPFS content storage with CID tracking, pinning,
// and retrieval. Stores content metadata in concept storage;
// actual bytes go to IPFS via the configured storage adapter.
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
} from '../../../../runtime/types.js';

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

export const contentHandler: ConceptHandler = {
  async store(input, storage) {
    const data = input.data as Uint8Array | string;
    const name = input.name as string;
    const contentType = input.contentType as string;

    try {
      const result = await ipfsClient.add(data);

      await storage.put('items', result.cid, {
        cid: result.cid,
        name,
        contentType,
        size: result.size,
        pinned: false,
        createdAt: new Date().toISOString(),
      });

      return {
        variant: 'ok',
        cid: result.cid,
        size: result.size,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },

  async pin(input, storage) {
    const cid = input.cid as string;

    try {
      await ipfsClient.pin(cid);

      const existing = await storage.get('items', cid);
      if (existing) {
        await storage.put('items', cid, { ...existing, pinned: true });
      }

      return { variant: 'ok', cid };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', cid, message };
    }
  },

  async unpin(input, storage) {
    const cid = input.cid as string;

    try {
      await ipfsClient.unpin(cid);

      const existing = await storage.get('items', cid);
      if (existing) {
        await storage.put('items', cid, { ...existing, pinned: false });
      }

      return { variant: 'ok', cid };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', cid, message };
    }
  },

  async resolve(input, storage) {
    const cid = input.cid as string;

    const meta = await storage.get('items', cid);
    if (!meta) {
      return { variant: 'notFound', cid };
    }

    try {
      const data = await ipfsClient.get(cid);
      return {
        variant: 'ok',
        data,
        contentType: meta.contentType as string,
        size: meta.size as number,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'unavailable', cid, message };
    }
  },
};
