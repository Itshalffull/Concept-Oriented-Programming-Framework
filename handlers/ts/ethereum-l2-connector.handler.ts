// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// EthereumL2Connector Handler
//
// Bridge the Connector interface to Ethereum Layer 2 networks,
// enabling read and write operations against L2 smart contracts
// via a uniform data integration surface.
// See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `eth-l2-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  read(input: Record<string, unknown>) {
    const connector = input.connector as string;
    const query = input.query as string;

    if (!connector) {
      const p = createProgram();
      return complete(p, 'error', { message: 'connector is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'ethereum_l2_connector', connector, 'existing');

    return branch(p, 'existing',
      (thenP) => {
        if (!query) {
          return complete(thenP, 'error', { message: 'query is required' });
        }

        let parsedQuery: Record<string, unknown>;
        try {
          parsedQuery = JSON.parse(query);
        } catch {
          return complete(thenP, 'error', { message: 'Invalid query JSON' });
        }

        return completeFrom(thenP, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const data = JSON.stringify({
            result: `read_result_for_${parsedQuery.method || 'call'}`,
            contract: existing['contract_address'],
            chain_id: existing['chain_id'],
          });
          return { data };
        });
      },
      (elseP) => complete(elseP, 'notfound', { connector }),
    ) as StorageProgram<Result>;
  },

  write(input: Record<string, unknown>) {
    const connector = input.connector as string;
    const data = input.data as string;

    if (!connector) {
      const p = createProgram();
      return complete(p, 'error', { message: 'connector is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'ethereum_l2_connector', connector, 'existing');

    return branch(p, 'existing',
      (thenP) => {
        if (!data) {
          return complete(thenP, 'error', { message: 'data is required' });
        }

        try {
          JSON.parse(data);
        } catch {
          return complete(thenP, 'error', { message: 'Invalid data JSON' });
        }

        const tx_hash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
        return complete(thenP, 'ok', { tx_hash });
      },
      (elseP) => complete(elseP, 'notfound', { connector }),
    ) as StorageProgram<Result>;
  },

  test(input: Record<string, unknown>) {
    const connector = input.connector as string;

    if (!connector) {
      const p = createProgram();
      return complete(p, 'unreachable', { message: 'connector is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'ethereum_l2_connector', connector, 'existing');

    return branch(p, 'existing',
      (thenP) => {
        const startTime = Date.now();
        const block_number = 1000000 + Math.floor(Math.random() * 100000);
        const latency_ms = Date.now() - startTime + Math.floor(Math.random() * 50);

        thenP = putFrom(thenP, 'ethereum_l2_connector', connector, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            ...existing,
            status: 'connected',
            updatedAt: new Date().toISOString(),
          };
        });

        return complete(thenP, 'ok', { block_number, latency_ms });
      },
      (elseP) => complete(elseP, 'unreachable', { message: `Connector '${connector}' not found` }),
    ) as StorageProgram<Result>;
  },

  discover(input: Record<string, unknown>) {
    const connector = input.connector as string;

    if (!connector) {
      const p = createProgram();
      return complete(p, 'notfound', { connector: '' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'ethereum_l2_connector', connector, 'existing');

    return branch(p, 'existing',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;

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

        return { functions, events };
      }),
      (elseP) => complete(elseP, 'notfound', { connector }),
    ) as StorageProgram<Result>;
  },
};

export const ethereumL2ConnectorHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetEthereumL2Connector(): void {
  idCounter = 0;
}
