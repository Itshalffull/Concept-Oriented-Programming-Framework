// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ChainMonitor Concept Implementation
//
// Monitors blockchain state for finality, reorgs, and
// confirmation tracking. Gate concept: awaitFinality holds
// invocations until finality conditions are met.
//
// This implementation tracks pending finality requests and
// resolves them when onBlock events indicate sufficient
// confirmations. Reorg detection compares parent hashes.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

/** Chain finality configuration */
interface ChainConfig {
  chainId: number;
  finalityType: 'confirmations' | 'l1-batch' | 'validity-proof';
  threshold: number;
}

/** Pending finality request */
interface PendingRequest {
  txHash: string;
  level: string;
  chainId: number;
  submittedBlock: number;
  resolve: (result: Record<string, unknown>) => void;
}

// In-process pending requests (gate pattern)
const pendingRequests = new Map<string, PendingRequest>();
// Known chain configs
const chainConfigs = new Map<number, ChainConfig>();
// Current block heights per chain
const blockHeights = new Map<number, number>();
// Known block hashes for reorg detection: chainId → blockNumber → hash
const blockHashes = new Map<number, Map<number, string>>();

type Result = { variant: string; [key: string]: unknown };

const _chainMonitorHandler: FunctionalConceptHandler = {
  awaitFinality(input: Record<string, unknown>) {
    const txHash = input.txHash as string;
    const level = (input.level as string) || 'default';

    let p = createProgram();
    p = put(p, 'subscriptions', txHash, {
      txHash,
      level,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // In a real implementation, this would be held open (gate pattern).
    // For the skeleton, we return immediately with the current state.
    // The sync engine's eventual delivery queue handles the async completion.
    return complete(p, 'ok', {
      chain: 'pending',
      block: 0,
      confirmations: 0,
    }) as StorageProgram<Result>;
  },

  subscribe(input: Record<string, unknown>) {
    const chainId = input.chainId as number;
    const rpcUrl = input.rpcUrl as string;

    const config: ChainConfig = {
      chainId,
      finalityType: 'confirmations',
      threshold: 12,
    };

    chainConfigs.set(chainId, config);
    blockHeights.set(chainId, 0);
    blockHashes.set(chainId, new Map());

    let p = createProgram();
    p = put(p, 'chainConfig', String(chainId), {
      rpcUrl,
      ...config,
    });

    return complete(p, 'ok', { chainId }) as StorageProgram<Result>;
  },

  onBlock(input: Record<string, unknown>) {
    const chainId = input.chainId as number;
    const blockNumber = input.blockNumber as number;
    const blockHash = input.blockHash as string;

    const currentHeight = blockHeights.get(chainId) || 0;
    const chainBlockHashes = blockHashes.get(chainId) || new Map();

    // Reorg detection: if we already saw this block number with a different hash
    if (chainBlockHashes.has(blockNumber) && chainBlockHashes.get(blockNumber) !== blockHash) {
      const reorgDepth = currentHeight - blockNumber + 1;

      // Clean up invalidated blocks
      for (let i = blockNumber; i <= currentHeight; i++) {
        chainBlockHashes.delete(i);
      }

      // Build program to clean up reorged subscriptions
      let p = createProgram();

      // Resolve pending requests for affected transactions as reorged
      for (const [txHash, req] of pendingRequests.entries()) {
        if (req.chainId === chainId && req.submittedBlock >= blockNumber) {
          p = del(p, 'subscriptions', txHash);
          pendingRequests.delete(txHash);
        }
      }

      blockHeights.set(chainId, blockNumber);
      blockHashes.set(chainId, chainBlockHashes);

      return complete(p, 'reorg', {
        chainId,
        depth: reorgDepth,
        fromBlock: blockNumber,
      }) as StorageProgram<Result>;
    }

    // Normal block: update height and check pending finality requests
    chainBlockHashes.set(blockNumber, blockHash);
    blockHeights.set(chainId, blockNumber);
    blockHashes.set(chainId, chainBlockHashes);

    // Check pending requests for this chain
    let p = createProgram();
    const config = chainConfigs.get(chainId);
    if (config) {
      for (const [txHash, req] of pendingRequests.entries()) {
        if (req.chainId === chainId) {
          const confirmations = blockNumber - req.submittedBlock;
          if (confirmations >= config.threshold) {
            p = del(p, 'subscriptions', txHash);
            pendingRequests.delete(txHash);
          }
        }
      }
    }

    return complete(p, 'ok', { chainId, blockNumber }) as StorageProgram<Result>;
  },
};

export const chainMonitorHandler = autoInterpret(_chainMonitorHandler);
