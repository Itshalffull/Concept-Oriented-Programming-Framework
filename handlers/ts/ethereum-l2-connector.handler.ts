// ============================================================
// EthereumL2Connector Handler
//
// Bridge the Connector interface to Ethereum Layer 2 networks,
// enabling read and write operations against L2 smart contracts
// via a uniform data integration surface.
// See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `eth-l2-${++idCounter}`;
}

export const ethereumL2ConnectorHandler: ConceptHandler = {
  async read(input: Record<string, unknown>, storage: ConceptStorage) {
    const connector = input.connector as string;
    const query = input.query as string;

    if (!connector) {
      return { variant: 'error', message: 'connector is required' };
    }

    const existing = await storage.get('ethereum_l2_connector', connector);
    if (!existing) {
      return { variant: 'notfound', connector };
    }

    if (!query) {
      return { variant: 'error', message: 'query is required' };
    }

    // Simulate an L2 contract read call
    let parsedQuery: Record<string, unknown>;
    try {
      parsedQuery = JSON.parse(query);
    } catch {
      return { variant: 'error', message: 'Invalid query JSON' };
    }

    const data = JSON.stringify({
      result: `read_result_for_${parsedQuery.method || 'call'}`,
      contract: existing['contract_address'],
      chain_id: existing['chain_id'],
    });

    return { variant: 'ok', data };
  },

  async write(input: Record<string, unknown>, storage: ConceptStorage) {
    const connector = input.connector as string;
    const data = input.data as string;

    if (!connector) {
      return { variant: 'error', message: 'connector is required' };
    }

    const existing = await storage.get('ethereum_l2_connector', connector);
    if (!existing) {
      return { variant: 'notfound', connector };
    }

    if (!data) {
      return { variant: 'error', message: 'data is required' };
    }

    // Validate data is valid JSON
    try {
      JSON.parse(data);
    } catch {
      return { variant: 'error', message: 'Invalid data JSON' };
    }

    // Simulate submitting a transaction
    const tx_hash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;

    return { variant: 'ok', tx_hash };
  },

  async test(input: Record<string, unknown>, storage: ConceptStorage) {
    const connector = input.connector as string;

    if (!connector) {
      return { variant: 'unreachable', message: 'connector is required' };
    }

    const existing = await storage.get('ethereum_l2_connector', connector);
    if (!existing) {
      return { variant: 'unreachable', message: `Connector '${connector}' not found` };
    }

    // Simulate connectivity test
    const startTime = Date.now();
    const block_number = 1000000 + Math.floor(Math.random() * 100000);
    const latency_ms = Date.now() - startTime + Math.floor(Math.random() * 50);

    await storage.put('ethereum_l2_connector', connector, {
      ...existing,
      status: 'connected',
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', block_number, latency_ms };
  },

  async discover(input: Record<string, unknown>, storage: ConceptStorage) {
    const connector = input.connector as string;

    if (!connector) {
      return { variant: 'notfound', connector: '' };
    }

    const existing = await storage.get('ethereum_l2_connector', connector);
    if (!existing) {
      return { variant: 'notfound', connector };
    }

    // Parse ABI to extract function and event names
    let abi: readonly Record<string, unknown>[];
    try {
      abi = JSON.parse(String(existing['abi'] || '[]'));
    } catch {
      abi = [];
    }

    const functions = (abi as Record<string, unknown>[])
      .filter((item) => item.type === 'function')
      .map((item) => String(item.name));
    const events = (abi as Record<string, unknown>[])
      .filter((item) => item.type === 'event')
      .map((item) => String(item.name));

    return { variant: 'ok', functions, events };
  },
};

/** Reset internal state. Useful for testing. */
export function resetEthereumL2Connector(): void {
  idCounter = 0;
}
