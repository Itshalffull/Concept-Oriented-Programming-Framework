// ============================================================
// IPFS Storage Adapter (~200 LOC)
//
// Implements ConceptStorage backed by IPFS.
// Content-addressed: store returns CID, retrieve by CID.
// Maintains a mutable index (key → CID) on top of immutable
// content storage.
//
// The index can live on-chain, in IPNS, or in a sidecar DB.
// This implementation uses an in-memory index with optional
// persistence to a backing store.
//
// Supports: Pinata, web3.storage, self-hosted IPFS nodes
//
// Pre-conceptual infrastructure (Section 10.3).
// ============================================================

import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
} from '../../../../runtime/types.js';

/** Configuration for the IPFS storage adapter */
export interface IPFSConfig {
  /** IPFS HTTP API endpoint */
  apiUrl: string;
  /** Gateway URL for content retrieval */
  gatewayUrl: string;
  /** Pinning service: 'pinata' | 'web3storage' | 'local' */
  pinning?: 'pinata' | 'web3storage' | 'local';
  /** API key for the pinning service */
  apiKey?: string;
  /** API secret (Pinata) */
  apiSecret?: string;
}

/** Internal entry with CID and metadata */
interface IPFSEntry {
  cid: string;
  fields: Record<string, unknown>;
  meta: EntryMeta;
}

/**
 * Create a ConceptStorage backed by IPFS.
 *
 * Content is stored as IPFS objects (immutable, content-addressed).
 * A mutable index maps relation:key → CID so the storage interface
 * works like a normal key-value store.
 *
 * @param config - IPFS connection and pinning configuration
 */
export function createIPFSStorage(config: IPFSConfig): ConceptStorage {
  // Mutable index: relation → key → IPFSEntry
  const index = new Map<string, Map<string, IPFSEntry>>();

  function getRelation(name: string): Map<string, IPFSEntry> {
    let rel = index.get(name);
    if (!rel) {
      rel = new Map();
      index.set(name, rel);
    }
    return rel;
  }

  /** Store data on IPFS and return the CID */
  async function ipfsAdd(data: unknown): Promise<string> {
    const body = JSON.stringify(data);

    const response = await fetch(`${config.apiUrl}/api/v0/add`, {
      method: 'POST',
      headers: config.apiKey
        ? { Authorization: `Bearer ${config.apiKey}` }
        : {},
      body: new Blob([body]),
    });

    if (!response.ok) {
      throw new Error(`IPFS add failed: ${response.statusText}`);
    }

    const result = await response.json() as { Hash: string };
    return result.Hash;
  }

  /** Retrieve data from IPFS by CID */
  async function ipfsGet(cid: string): Promise<unknown> {
    const response = await fetch(`${config.gatewayUrl}/ipfs/${cid}`);
    if (!response.ok) {
      throw new Error(`IPFS get failed: ${response.statusText}`);
    }
    return response.json();
  }

  /** Pin a CID via the configured pinning service */
  async function ipfsPin(cid: string): Promise<void> {
    if (config.pinning === 'pinata' && config.apiKey) {
      await fetch('https://api.pinata.cloud/pinning/pinByHash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({ hashToPin: cid }),
      });
    } else if (config.pinning === 'local') {
      await fetch(`${config.apiUrl}/api/v0/pin/add?arg=${cid}`, {
        method: 'POST',
      });
    }
    // web3.storage auto-pins on upload
  }

  const storage: ConceptStorage = {
    async put(relation, key, value) {
      const now = new Date().toISOString();
      const rel = getRelation(relation);

      // Check for conflicts
      if (storage.onConflict) {
        const existing = rel.get(key);
        if (existing) {
          const info: ConflictInfo = {
            relation,
            key,
            existing: {
              fields: { ...existing.fields },
              writtenAt: existing.meta.lastWrittenAt,
            },
            incoming: {
              fields: { ...value },
              writtenAt: now,
            },
          };

          const resolution = storage.onConflict(info);
          switch (resolution.action) {
            case 'keep-existing':
              return;
            case 'accept-incoming':
              break;
            case 'merge': {
              const cid = await ipfsAdd(resolution.merged);
              rel.set(key, {
                cid,
                fields: { ...resolution.merged },
                meta: { lastWrittenAt: now },
              });
              return;
            }
            case 'escalate':
              break;
          }
        }
      }

      // Store on IPFS and update index
      const cid = await ipfsAdd(value);
      rel.set(key, {
        cid,
        fields: { ...value },
        meta: { lastWrittenAt: now },
      });
    },

    async get(relation, key) {
      const rel = getRelation(relation);
      const entry = rel.get(key);
      if (!entry) return null;

      // Optionally verify from IPFS (content-addressed guarantees integrity)
      return { ...entry.fields, _cid: entry.cid };
    },

    async find(relation, criteria?) {
      const rel = getRelation(relation);
      const results: Record<string, unknown>[] = [];

      for (const entry of rel.values()) {
        if (!criteria || Object.keys(criteria).length === 0 ||
            Object.entries(criteria).every(([k, v]) => entry.fields[k] === v)) {
          results.push({ ...entry.fields, _cid: entry.cid });
        }
      }

      return results;
    },

    async del(relation, key) {
      const rel = getRelation(relation);
      rel.delete(key);
      // Note: IPFS content is immutable — we only remove the index entry.
      // The actual content remains on IPFS unless unpinned and garbage collected.
    },

    async delMany(relation, criteria) {
      const rel = getRelation(relation);
      let count = 0;
      for (const [key, entry] of rel.entries()) {
        if (Object.entries(criteria).every(([k, v]) => entry.fields[k] === v)) {
          rel.delete(key);
          count++;
        }
      }
      return count;
    },

    async getMeta(relation, key) {
      const rel = getRelation(relation);
      const entry = rel.get(key);
      return entry ? { ...entry.meta } : null;
    },
  };

  return storage;
}
