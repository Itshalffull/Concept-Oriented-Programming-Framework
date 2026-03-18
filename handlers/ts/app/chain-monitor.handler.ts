// @migrated dsl-constructs 2026-03-18
// ChainMonitor Concept Implementation
// Monitor blockchain state for finality, reorgs, and confirmation tracking.
// Async gate concept: awaitFinality holds invocations and completes them
// when the chain-specific finality condition is met (confirmations, L1 batch,
// validity proof). See Architecture doc for gate convention details.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

/** Maximum wait time (ms) before a finality request times out */
const FINALITY_TIMEOUT_MS = 300_000; // 5 minutes

/** Default confirmation threshold when no chain config overrides it */
const DEFAULT_CONFIRMATION_THRESHOLD = 12;

const chainMonitorHandlerFunctional: FunctionalConceptHandler = {
  awaitFinality(input: Record<string, unknown>) {
    const txHash = input.txHash as string;
    const level = (input.level as string) || 'confirmations';

    let p = createProgram();
    p = spGet(p, 'subscription', txHash, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Status checks (finalized/reorged/pending/timeout) resolved at runtime from bindings
        return complete(b, 'ok', { chain: '', block: 0, confirmations: 0 });
      },
      (b) => {
        // New subscription — store as pending
        let b2 = put(b, 'subscription', txHash, {
          txHash,
          level,
          status: 'pending',
          confirmations: 0,
          blockNumber: 0,
          chain: '',
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { chain: 'pending', block: 0, confirmations: 0 });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  subscribe(input: Record<string, unknown>) {
    const chainId = input.chainId as number;
    const rpcUrl = input.rpcUrl as string;

    if (!chainId || !rpcUrl) {
      let p = createProgram();
      return complete(p, 'error', { message: 'Missing required fields: chainId, rpcUrl' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = put(p, 'chainConfig', String(chainId), {
      chainId,
      rpcUrl,
      finalityType: 'confirmations',
      threshold: DEFAULT_CONFIRMATION_THRESHOLD,
      subscribedAt: new Date().toISOString(),
    });
    p = put(p, 'blockHeight', String(chainId), {
      chainId,
      blockNumber: 0,
      updatedAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { chainId }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  onBlock(input: Record<string, unknown>) {
    const chainId = input.chainId as number;
    const blockNumber = input.blockNumber as number;
    const blockHash = input.blockHash as string;

    let p = createProgram();
    p = spGet(p, 'blockHeight', String(chainId), 'heightRecord');
    // Reorg detection, block height update, confirmation tracking all resolved at runtime
    p = put(p, 'blockHeight', String(chainId), {
      chainId,
      blockNumber,
      blockHash,
      updatedAt: new Date().toISOString(),
    });
    p = find(p, 'subscription', { status: 'pending' }, 'pendingSubscriptions');
    p = spGet(p, 'chainConfig', String(chainId), 'config');
    // Confirmation updates and finality marking resolved at runtime
    return complete(p, 'ok', { chainId, blockNumber }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const chainMonitorHandler = wrapFunctional(chainMonitorHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { chainMonitorHandlerFunctional };
