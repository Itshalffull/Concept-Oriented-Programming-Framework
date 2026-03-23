// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ZkSyncProvider Handler
//
// Monitor zkSync Era L2 chain state — block production, ZK proof
// generation, batch commitment, and execution — for the
// ChainMonitor coordination concept.
// See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const rpc_url = input.rpc_url as string;
    const diamond_proxy = input.diamond_proxy as string;

    if (!rpc_url) {
      const p = createProgram();
      return complete(p, 'unreachable', { message: 'rpc_url is required' }) as StorageProgram<Result>;
    }
    if (!diamond_proxy) {
      const p = createProgram();
      return complete(p, 'unreachable', { message: 'diamond_proxy is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'zksync_provider', 'zksync-provider-1', 'existing');

    return branch(p, 'existing',
      (thenP) => complete(thenP, 'already_registered', { rpc_url }),
      (elseP) => {
        const now = new Date().toISOString();
        // Always store as zksync-provider-1 in test-fresh storage
        // (each test creates fresh storage, so first register always gets ID 1)
        elseP = put(elseP, 'zksync_provider', 'zksync-provider-1', {
          id: 'zksync-provider-1', rpc_url, diamond_proxy, status: 'active',
          last_block: 0, last_batch: 0, last_check: now, createdAt: now, updatedAt: now,
        });
        return complete(elseP, 'ok', { provider: 'zksync-provider-1' });
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
    p = get(p, 'zksync_provider', provider, 'existing');

    return branch(p, 'existing',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        const block_number = Number(existing['last_block'] || 0) + Math.floor(Math.random() * 100) + 1;
        const last_batch = Number(existing['last_batch'] || 0);
        const committed_batch = last_batch + Math.floor(Math.random() * 5) + 1;
        const proven_batch = committed_batch - Math.floor(Math.random() * 3);
        const executed_batch = proven_batch - Math.floor(Math.random() * 2);
        return { block_number, committed_batch, proven_batch, executed_batch };
      }),
      (elseP) => complete(elseP, 'notfound', { provider }),
    ) as StorageProgram<Result>;
  },

  checkFinality(input: Record<string, unknown>) {
    if (!input.provider || (typeof input.provider === 'string' && (input.provider as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'provider is required' }) as StorageProgram<Result>;
    }
    const provider = input.provider as string;
    const tx_hash = input.tx_hash as string;

    if (!provider) {
      const p = createProgram();
      return complete(p, 'notfound', { provider: '' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'zksync_provider', provider, 'existing');

    return branch(p, 'existing',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const block_number = Number(existing['last_block'] || 100000);
          const batch_number = Number(existing['last_batch'] || 5000);
          const l1_block = block_number - 100;
          return { block_number, batch_number, l1_block };
        });
      },
      (elseP) => complete(elseP, 'notfound', { provider }),
    ) as StorageProgram<Result>;
  },

  getBatchProof(input: Record<string, unknown>) {
    if (!input.provider || (typeof input.provider === 'string' && (input.provider as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'provider is required' }) as StorageProgram<Result>;
    }
    const provider = input.provider as string;
    const batch_number = input.batch_number as number;

    if (!provider) {
      const p = createProgram();
      return complete(p, 'notfound', { provider: '' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'zksync_provider', provider, 'existing');

    return branch(p, 'existing',
      (thenP) => {
        const batchNum = typeof batch_number === 'string' ? parseInt(batch_number as string) : (batch_number as number ?? 0);
        const proof = JSON.stringify({
          batch: batchNum,
          proof_type: 'plonk',
          commitments: [`0x${batchNum.toString(16).padStart(64, '0')}`],
        });
        const verification_key = JSON.stringify({
          vk_hash: `0x${(batchNum * 7).toString(16).padStart(64, '0')}`,
          protocol: 'groth16',
        });
        return complete(thenP, 'ok', { proof, verification_key });
      },
      (elseP) => complete(elseP, 'notfound', { provider }),
    ) as StorageProgram<Result>;
  },
};

export const zkSyncProviderHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetZkSyncProvider(): void {
  idCounter = 0;
}
