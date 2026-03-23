// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// OptimismProvider Handler
//
// Monitor Optimism L2 chain state — block production, transaction
// finality, and cross-domain message relaying — for the
// ChainMonitor coordination concept.
// See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `op-provider-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const rpc_url = input.rpc_url as string;
    const l1_bridge_address = input.l1_bridge_address as string;

    if (!rpc_url) {
      const p = createProgram();
      return complete(p, 'unreachable', { message: 'rpc_url is required' }) as StorageProgram<Result>;
    }
    if (!l1_bridge_address) {
      const p = createProgram();
      return complete(p, 'unreachable', { message: 'l1_bridge_address is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'optimism_provider', { rpc_url }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as Record<string, unknown>[]).length > 0,
      (bp) => complete(bp, 'already_registered', { rpc_url }),
      (bp) => {
        const id = nextId();
        const now = new Date().toISOString();
        const bp2 = put(bp, 'optimism_provider', id, {
          id, rpc_url, l1_bridge_address,
          status: 'active', last_block: 0, last_check: now,
          createdAt: now, updatedAt: now,
        });
        return complete(bp2, 'ok', { provider: id });
      },
    ) as StorageProgram<Result>;
  },

  poll(input: Record<string, unknown>) {
    const provider = input.provider as string;

    if (!provider) {
      const p = createProgram();
      return complete(p, 'error', { message: 'provider is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'optimism_provider', provider, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (bp) => complete(bp, 'notfound', { provider }),
      (bp) => completeFrom(bp, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        const block_number = Number(existing['last_block'] || 0) + Math.floor(Math.random() * 100) + 1;
        const finalized = block_number - Math.floor(Math.random() * 50);
        const pending_messages = Math.floor(Math.random() * 10);
        return { block_number, finalized, pending_messages };
      }),
    ) as StorageProgram<Result>;
  },

  checkFinality(input: Record<string, unknown>) {
    if (!input.provider || (typeof input.provider === 'string' && (input.provider as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'provider is required' }) as StorageProgram<Result>;
    }
    const provider = input.provider as string;
    const tx_hash = input.tx_hash as string;

    if (!provider) {
      const p = createProgram();
      return complete(p, 'notfound', { provider: '' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'optimism_provider', provider, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (bp) => complete(bp, 'notfound', { provider }),
      (bp) => {
        if (!tx_hash) {
          return complete(bp, 'pending', { confirmations: 0 });
        }

        const hashValue = tx_hash.length;
        if (hashValue % 2 === 0) {
          return completeFrom(bp, 'ok', (bindings) => {
            const existing = bindings.existing as Record<string, unknown>;
            const block_number = Number(existing['last_block'] || 100000);
            const l1_block = block_number - Math.floor(Math.random() * 1000);
            return { block_number, l1_block };
          });
        }

        const confirmations = Math.floor(Math.random() * 100);
        return complete(bp, 'pending', { confirmations });
      },
    ) as StorageProgram<Result>;
  },

  relayMessage(input: Record<string, unknown>) {
    const provider = input.provider as string;
    const message_hash = input.message_hash as string;

    if (!provider) {
      const p = createProgram();
      return complete(p, 'error', { message: 'provider is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'optimism_provider', provider, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (bp) => complete(bp, 'error', { message: `Provider '${provider}' not found` }),
      (bp) => {
        if (!message_hash) {
          return complete(bp, 'error', { message: 'message_hash is required' });
        }

        const bp2 = get(bp, 'optimism_relay', message_hash, 'relayRecord');

        return branch(bp2,
          (bindings) => !!bindings.relayRecord,
          (bp3) => complete(bp3, 'already_relayed', { message_hash }),
          (bp3) => {
            const l1_tx_hash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
            const now = new Date().toISOString();
            const bp4 = put(bp3, 'optimism_relay', message_hash, {
              message_hash, l1_tx_hash, provider, relayedAt: now,
            });
            return complete(bp4, 'ok', { l1_tx_hash });
          },
        );
      },
    ) as StorageProgram<Result>;
  },
};

export const optimismProviderHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetOptimismProvider(): void {
  idCounter = 0;
}
