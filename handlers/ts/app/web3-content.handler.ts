// Web3 Content Concept Implementation
// Manage content stored on IPFS with CID tracking, pinning, and resolution.
// Each content item is identified by its content-addressed hash (CID).
// The unavailable variant enables reactive sync chains for retry, fallback,
// or alerting.
import { createHash } from 'crypto';
import type { ConceptHandler } from '@clef/kernel';

/**
 * Generate a deterministic IPFS-style CID from raw data bytes.
 * Uses SHA-256 and prefixes with "Qm" to mimic a CIDv0 multihash.
 * In production this would use the actual IPFS DAG/unixfs chunking.
 */
function generateCid(data: Buffer | Uint8Array | string): string {
  const bytes = typeof data === 'string' ? Buffer.from(data, 'utf-8') : Buffer.from(data);
  const hash = createHash('sha256').update(bytes).digest('hex');
  return 'Qm' + hash.slice(0, 44);
}

export const web3ContentHandler: ConceptHandler = {
  async store(input, storage) {
    const data = input.data as string | Uint8Array;
    const name = input.name as string;
    const contentType = input.contentType as string;

    try {
      if (!data || !name || !contentType) {
        return { variant: 'error', message: 'Missing required fields: data, name, contentType' };
      }

      const bytes = typeof data === 'string' ? Buffer.from(data, 'utf-8') : Buffer.from(data);
      const cid = generateCid(bytes);
      const size = bytes.length;

      // Store content metadata keyed by CID
      await storage.put('item', cid, {
        cid,
        name,
        contentType,
        size,
        pinned: false,
        createdAt: new Date().toISOString(),
      });

      // Store the raw data separately so resolve can retrieve it
      await storage.put('blob', cid, {
        cid,
        data: bytes.toString('base64'),
        encoding: 'base64',
      });

      return { variant: 'ok', cid, size };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },

  async pin(input, storage) {
    const cid = input.cid as string;

    try {
      const existing = await storage.get('item', cid);
      if (!existing) {
        return { variant: 'error', cid, message: 'Content not found for CID' };
      }

      await storage.put('item', cid, {
        ...existing,
        pinned: true,
        pinnedAt: new Date().toISOString(),
      });

      return { variant: 'ok', cid };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', cid, message };
    }
  },

  async unpin(input, storage) {
    const cid = input.cid as string;

    try {
      const existing = await storage.get('item', cid);
      if (!existing) {
        return { variant: 'error', cid, message: 'Content not found for CID' };
      }

      await storage.put('item', cid, {
        ...existing,
        pinned: false,
        unpinnedAt: new Date().toISOString(),
      });

      return { variant: 'ok', cid };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', cid, message };
    }
  },

  async resolve(input, storage) {
    const cid = input.cid as string;

    // Look up metadata to confirm the CID exists
    const meta = await storage.get('item', cid);
    if (!meta) {
      return { variant: 'notFound', cid };
    }

    try {
      // Retrieve the stored blob data
      const blob = await storage.get('blob', cid);
      if (!blob || !blob.data) {
        return {
          variant: 'unavailable',
          cid,
          message: 'Content metadata exists but blob data is unreachable',
        };
      }

      const data = Buffer.from(blob.data as string, blob.encoding as BufferEncoding || 'base64');

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
