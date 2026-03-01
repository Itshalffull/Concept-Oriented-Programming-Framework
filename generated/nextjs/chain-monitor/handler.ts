// ChainMonitor — Blockchain monitoring, finality tracking, and reorg detection
// Subscribes to chains, processes blocks, detects reorgs, and waits for transaction finality.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ChainMonitorStorage,
  ChainMonitorAwaitFinalityInput,
  ChainMonitorAwaitFinalityOutput,
  ChainMonitorSubscribeInput,
  ChainMonitorSubscribeOutput,
  ChainMonitorOnBlockInput,
  ChainMonitorOnBlockOutput,
} from './types.js';

import {
  awaitFinalityOk,
  awaitFinalityReorged,
  awaitFinalityTimeout,
  subscribeOk,
  subscribeError,
  onBlockOk,
  onBlockReorg,
} from './types.js';

export interface ChainMonitorError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): ChainMonitorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Required confirmations for each finality level. */
const FINALITY_LEVELS: Record<string, number> = {
  safe: 6,
  finalized: 12,
  justified: 32,
  instant: 1,
};

export interface ChainMonitorHandler {
  readonly awaitFinality: (
    input: ChainMonitorAwaitFinalityInput,
    storage: ChainMonitorStorage,
  ) => TE.TaskEither<ChainMonitorError, ChainMonitorAwaitFinalityOutput>;
  readonly subscribe: (
    input: ChainMonitorSubscribeInput,
    storage: ChainMonitorStorage,
  ) => TE.TaskEither<ChainMonitorError, ChainMonitorSubscribeOutput>;
  readonly onBlock: (
    input: ChainMonitorOnBlockInput,
    storage: ChainMonitorStorage,
  ) => TE.TaskEither<ChainMonitorError, ChainMonitorOnBlockOutput>;
}

// --- Implementation ---

export const chainMonitorHandler: ChainMonitorHandler = {
  awaitFinality: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const requiredConfirmations = FINALITY_LEVELS[input.level] ?? FINALITY_LEVELS['safe'];

          // Look up the transaction's inclusion block
          const txRecord = await storage.get('tx', input.txHash);
          if (!txRecord) {
            return awaitFinalityTimeout(input.txHash);
          }

          const txBlock = Number(txRecord['blockNumber'] ?? 0);
          const chainId = String(txRecord['chainId'] ?? '1');

          // Get the latest known block for this chain
          const chainState = await storage.get('chain_state', chainId);
          const latestBlock = chainState ? Number(chainState['latestBlock'] ?? 0) : 0;

          // Check if the tx block has been reorged out
          const reorgRecord = await storage.get('reorg', `${chainId}_${txBlock}`);
          if (reorgRecord) {
            return awaitFinalityReorged(input.txHash, Number(reorgRecord['depth'] ?? 1));
          }

          const confirmations = latestBlock - txBlock;
          if (confirmations >= requiredConfirmations) {
            return awaitFinalityOk(chainId, txBlock, confirmations);
          }

          return awaitFinalityTimeout(input.txHash);
        },
        storageError,
      ),
    ),

  subscribe: (input, storage) => {
    // Validate RPC URL format
    if (!input.rpcUrl.startsWith('http://') && !input.rpcUrl.startsWith('https://') && !input.rpcUrl.startsWith('ws://') && !input.rpcUrl.startsWith('wss://')) {
      return TE.right(subscribeError(`Invalid RPC URL: ${input.rpcUrl}`));
    }
    return pipe(
      TE.tryCatch(
        async () => {
          const chainKey = String(input.chainId);
          await storage.put('chain_subscription', chainKey, {
            chainId: input.chainId,
            rpcUrl: input.rpcUrl,
            subscribedAt: new Date().toISOString(),
            status: 'active',
          });
          // Initialize chain state if it doesn't exist
          const existing = await storage.get('chain_state', chainKey);
          if (!existing) {
            await storage.put('chain_state', chainKey, {
              chainId: input.chainId,
              latestBlock: 0,
              latestHash: '',
              updatedAt: new Date().toISOString(),
            });
          }
          return subscribeOk(input.chainId);
        },
        storageError,
      ),
    );
  },

  onBlock: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const chainKey = String(input.chainId);
          const chainState = await storage.get('chain_state', chainKey);
          const previousBlock = chainState ? Number(chainState['latestBlock'] ?? 0) : 0;
          const previousHash = chainState ? String(chainState['latestHash'] ?? '') : '';

          // Detect reorg: if the new block number is not exactly previousBlock + 1
          // and we have a previous state, this indicates a chain reorganization
          if (previousBlock > 0 && input.blockNumber <= previousBlock) {
            const reorgDepth = previousBlock - input.blockNumber + 1;
            await storage.put('reorg', `${chainKey}_${input.blockNumber}`, {
              chainId: input.chainId,
              depth: reorgDepth,
              fromBlock: input.blockNumber,
              toBlock: previousBlock,
              newHash: input.blockHash,
              previousHash,
              detectedAt: new Date().toISOString(),
            });

            // Update chain state to the new fork
            await storage.put('chain_state', chainKey, {
              chainId: input.chainId,
              latestBlock: input.blockNumber,
              latestHash: input.blockHash,
              updatedAt: new Date().toISOString(),
            });

            return onBlockReorg(input.chainId, reorgDepth, input.blockNumber);
          }

          // Normal block processing
          await storage.put('chain_state', chainKey, {
            chainId: input.chainId,
            latestBlock: input.blockNumber,
            latestHash: input.blockHash,
            updatedAt: new Date().toISOString(),
          });

          // Store block record
          await storage.put('block', `${chainKey}_${input.blockNumber}`, {
            chainId: input.chainId,
            blockNumber: input.blockNumber,
            blockHash: input.blockHash,
            processedAt: new Date().toISOString(),
          });

          return onBlockOk(input.chainId, input.blockNumber);
        },
        storageError,
      ),
    ),
};
