// ============================================================
// ZkSyncProvider Handler
//
// Monitor zkSync Era L2 chain state — block production, ZK proof
// generation, batch commitment, and execution — for the
// ChainMonitor coordination concept.
// See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `zksync-provider-${++idCounter}`;
}

export const zkSyncProviderHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const rpc_url = input.rpc_url as string;
    const diamond_proxy = input.diamond_proxy as string;

    if (!rpc_url) {
      return { variant: 'unreachable', message: 'rpc_url is required' };
    }
    if (!diamond_proxy) {
      return { variant: 'unreachable', message: 'diamond_proxy is required' };
    }

    // Check for duplicate registration
    const existing = await storage.find('zksync_provider', { rpc_url });
    if (existing.length > 0) {
      return { variant: 'already_registered', rpc_url };
    }

    const id = nextId();
    const now = new Date().toISOString();

    await storage.put('zksync_provider', id, {
      id,
      rpc_url,
      diamond_proxy,
      status: 'active',
      last_block: 0,
      last_batch: 0,
      last_check: now,
      createdAt: now,
      updatedAt: now,
    });

    return { variant: 'ok', provider: id };
  },

  async poll(input: Record<string, unknown>, storage: ConceptStorage) {
    const provider = input.provider as string;

    if (!provider) {
      return { variant: 'error', message: 'provider is required' };
    }

    const existing = await storage.get('zksync_provider', provider);
    if (!existing) {
      return { variant: 'notfound', provider };
    }

    // Simulate polling the zkSync Era chain
    const block_number = Number(existing['last_block'] || 0) + Math.floor(Math.random() * 100) + 1;
    const last_batch = Number(existing['last_batch'] || 0);
    const committed_batch = last_batch + Math.floor(Math.random() * 5) + 1;
    const proven_batch = committed_batch - Math.floor(Math.random() * 3);
    const executed_batch = proven_batch - Math.floor(Math.random() * 2);
    const now = new Date().toISOString();

    await storage.put('zksync_provider', provider, {
      ...existing,
      last_block: block_number,
      last_batch: committed_batch,
      last_check: now,
      updatedAt: now,
    });

    return { variant: 'ok', block_number, committed_batch, proven_batch, executed_batch };
  },

  async checkFinality(input: Record<string, unknown>, storage: ConceptStorage) {
    const provider = input.provider as string;
    const tx_hash = input.tx_hash as string;

    if (!provider) {
      return { variant: 'notfound', provider: '' };
    }

    const existing = await storage.get('zksync_provider', provider);
    if (!existing) {
      return { variant: 'notfound', provider };
    }

    if (!tx_hash) {
      return { variant: 'pending', block_number: 0 };
    }

    // Simulate finality check — use hash characteristics for deterministic variants
    const hashLen = tx_hash.length;
    const block_number = Number(existing['last_block'] || 100000);
    const batch_number = Number(existing['last_batch'] || 5000);

    if (hashLen % 4 === 0) {
      const l1_block = block_number - Math.floor(Math.random() * 1000);
      return { variant: 'executed', block_number, batch_number, l1_block };
    } else if (hashLen % 4 === 1) {
      return { variant: 'proven', block_number, batch_number };
    } else if (hashLen % 4 === 2) {
      return { variant: 'committed', block_number, batch_number };
    }

    return { variant: 'pending', block_number };
  },

  async getBatchProof(input: Record<string, unknown>, storage: ConceptStorage) {
    const provider = input.provider as string;
    const batch_number = input.batch_number as number;

    if (!provider) {
      return { variant: 'notfound', provider: '' };
    }

    const existing = await storage.get('zksync_provider', provider);
    if (!existing) {
      return { variant: 'notfound', provider };
    }

    if (batch_number === undefined || batch_number === null) {
      return { variant: 'not_proven', batch_number: 0 };
    }

    // Simulate proof retrieval — only available for proven batches
    const last_batch = Number(existing['last_batch'] || 0);
    if (batch_number > last_batch) {
      return { variant: 'not_proven', batch_number };
    }

    const proof = JSON.stringify({
      batch: batch_number,
      proof_type: 'plonk',
      commitments: [`0x${batch_number.toString(16).padStart(64, '0')}`],
    });

    const verification_key = JSON.stringify({
      vk_hash: `0x${(batch_number * 7).toString(16).padStart(64, '0')}`,
      protocol: 'groth16',
    });

    return { variant: 'ok', proof, verification_key };
  },
};

/** Reset internal state. Useful for testing. */
export function resetZkSyncProvider(): void {
  idCounter = 0;
}
