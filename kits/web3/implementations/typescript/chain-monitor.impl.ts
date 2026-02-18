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

import type {
  ConceptHandler,
  ConceptStorage,
} from '../../../../kernel/src/types.js';

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

export const chainMonitorHandler: ConceptHandler = {
  async awaitFinality(input, storage) {
    const txHash = input.txHash as string;
    const level = (input.level as string) || 'default';

    // Store the pending request
    await storage.put('subscriptions', txHash, {
      txHash,
      level,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // In a real implementation, this would be held open (gate pattern).
    // For the skeleton, we return immediately with the current state.
    // The sync engine's eventual delivery queue handles the async completion.
    return {
      variant: 'ok',
      chain: 'pending',
      block: 0,
      confirmations: 0,
    };
  },

  async subscribe(input, storage) {
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

    await storage.put('chainConfig', String(chainId), {
      chainId,
      rpcUrl,
      ...config,
    });

    return { variant: 'ok', chainId };
  },

  async onBlock(input, storage) {
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

      // Resolve pending requests for affected transactions as reorged
      for (const [txHash, req] of pendingRequests.entries()) {
        if (req.chainId === chainId && req.submittedBlock >= blockNumber) {
          await storage.del('subscriptions', txHash);
          pendingRequests.delete(txHash);
        }
      }

      blockHeights.set(chainId, blockNumber);
      blockHashes.set(chainId, chainBlockHashes);

      return {
        variant: 'reorg',
        chainId,
        depth: reorgDepth,
        fromBlock: blockNumber,
      };
    }

    // Normal block: update height and check pending finality requests
    chainBlockHashes.set(blockNumber, blockHash);
    blockHeights.set(chainId, blockNumber);
    blockHashes.set(chainId, chainBlockHashes);

    // Check pending requests for this chain
    const config = chainConfigs.get(chainId);
    if (config) {
      for (const [txHash, req] of pendingRequests.entries()) {
        if (req.chainId === chainId) {
          const confirmations = blockNumber - req.submittedBlock;
          if (confirmations >= config.threshold) {
            await storage.del('subscriptions', txHash);
            pendingRequests.delete(txHash);
          }
        }
      }
    }

    return { variant: 'ok', chainId, blockNumber };
  },
};
