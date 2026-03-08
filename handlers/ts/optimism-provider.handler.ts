// ============================================================
// OptimismProvider Handler
//
// Monitor Optimism L2 chain state — block production, transaction
// finality, and cross-domain message relaying — for the
// ChainMonitor coordination concept.
// See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `op-provider-${++idCounter}`;
}

export const optimismProviderHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const rpc_url = input.rpc_url as string;
    const l1_bridge_address = input.l1_bridge_address as string;

    if (!rpc_url) {
      return { variant: 'unreachable', message: 'rpc_url is required' };
    }
    if (!l1_bridge_address) {
      return { variant: 'unreachable', message: 'l1_bridge_address is required' };
    }

    // Check for duplicate registration
    const existing = await storage.find('optimism_provider', { rpc_url });
    if (existing.length > 0) {
      return { variant: 'already_registered', rpc_url };
    }

    const id = nextId();
    const now = new Date().toISOString();

    await storage.put('optimism_provider', id, {
      id,
      rpc_url,
      l1_bridge_address,
      status: 'active',
      last_block: 0,
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

    const existing = await storage.get('optimism_provider', provider);
    if (!existing) {
      return { variant: 'notfound', provider };
    }

    // Simulate polling the Optimism L2 chain
    const block_number = Number(existing['last_block'] || 0) + Math.floor(Math.random() * 100) + 1;
    const finalized = block_number - Math.floor(Math.random() * 50);
    const pending_messages = Math.floor(Math.random() * 10);
    const now = new Date().toISOString();

    await storage.put('optimism_provider', provider, {
      ...existing,
      last_block: block_number,
      last_check: now,
      updatedAt: now,
    });

    return { variant: 'ok', block_number, finalized, pending_messages };
  },

  async checkFinality(input: Record<string, unknown>, storage: ConceptStorage) {
    const provider = input.provider as string;
    const tx_hash = input.tx_hash as string;

    if (!provider) {
      return { variant: 'notfound', provider: '' };
    }

    const existing = await storage.get('optimism_provider', provider);
    if (!existing) {
      return { variant: 'notfound', provider };
    }

    if (!tx_hash) {
      return { variant: 'pending', confirmations: 0 };
    }

    // Simulate finality check — use hash to deterministically pick a result
    const hashValue = tx_hash.length;
    if (hashValue % 2 === 0) {
      const block_number = Number(existing['last_block'] || 100000);
      const l1_block = block_number - Math.floor(Math.random() * 1000);
      return { variant: 'finalized', block_number, l1_block };
    }

    const confirmations = Math.floor(Math.random() * 100);
    return { variant: 'pending', confirmations };
  },

  async relayMessage(input: Record<string, unknown>, storage: ConceptStorage) {
    const provider = input.provider as string;
    const message_hash = input.message_hash as string;

    if (!provider) {
      return { variant: 'error', message: 'provider is required' };
    }

    const existing = await storage.get('optimism_provider', provider);
    if (!existing) {
      return { variant: 'error', message: `Provider '${provider}' not found` };
    }

    if (!message_hash) {
      return { variant: 'error', message: 'message_hash is required' };
    }

    // Check if already relayed
    const relayRecord = await storage.get('optimism_relay', message_hash);
    if (relayRecord) {
      return { variant: 'already_relayed', message_hash };
    }

    // Simulate relay transaction
    const l1_tx_hash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
    const now = new Date().toISOString();

    await storage.put('optimism_relay', message_hash, {
      message_hash,
      l1_tx_hash,
      provider,
      relayedAt: now,
    });

    return { variant: 'ok', l1_tx_hash };
  },
};

/** Reset internal state. Useful for testing. */
export function resetOptimismProvider(): void {
  idCounter = 0;
}
