// ChainMonitor Concept Implementation
// Monitor blockchain state for finality, reorgs, and confirmation tracking.
// Async gate concept: awaitFinality holds invocations and completes them
// when the chain-specific finality condition is met (confirmations, L1 batch,
// validity proof). See Architecture doc for gate convention details.
import type { ConceptHandler } from '@copf/kernel';

/** Maximum wait time (ms) before a finality request times out */
const FINALITY_TIMEOUT_MS = 300_000; // 5 minutes

/** Default confirmation threshold when no chain config overrides it */
const DEFAULT_CONFIRMATION_THRESHOLD = 12;

export const chainMonitorHandler: ConceptHandler = {
  async awaitFinality(input, storage) {
    const txHash = input.txHash as string;
    const level = (input.level as string) || 'confirmations';

    // Look up existing subscription to see if finality was already reached
    const existing = await storage.get('subscription', txHash);

    if (existing && existing.status === 'finalized') {
      // Finality already confirmed -- remove subscription and return success
      await storage.del('subscription', txHash);
      return {
        variant: 'ok',
        chain: existing.chain as string,
        block: existing.finalizedBlock as number,
        confirmations: existing.confirmations as number,
      };
    }

    if (existing && existing.status === 'reorged') {
      // Reorg was detected for this transaction -- remove and report
      const depth = existing.reorgDepth as number;
      await storage.del('subscription', txHash);
      return { variant: 'reorged', txHash, depth };
    }

    if (existing && existing.status === 'pending') {
      // Check if the request has timed out
      const createdAt = new Date(existing.createdAt as string).getTime();
      if (Date.now() - createdAt > FINALITY_TIMEOUT_MS) {
        await storage.del('subscription', txHash);
        return { variant: 'timeout', txHash };
      }

      // Still pending -- in a real gate implementation the invocation would
      // be held open. For the skeleton we return the current pending state.
      return {
        variant: 'ok',
        chain: (existing.chain as string) || 'pending',
        block: (existing.blockNumber as number) || 0,
        confirmations: (existing.confirmations as number) || 0,
      };
    }

    // New subscription -- store as pending
    await storage.put('subscription', txHash, {
      txHash,
      level,
      status: 'pending',
      confirmations: 0,
      blockNumber: 0,
      chain: '',
      createdAt: new Date().toISOString(),
    });

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

    if (!chainId || !rpcUrl) {
      return { variant: 'error', message: 'Missing required fields: chainId, rpcUrl' };
    }

    // Store chain configuration with default finality settings
    await storage.put('chainConfig', String(chainId), {
      chainId,
      rpcUrl,
      finalityType: 'confirmations',
      threshold: DEFAULT_CONFIRMATION_THRESHOLD,
      subscribedAt: new Date().toISOString(),
    });

    // Initialize block height tracking
    await storage.put('blockHeight', String(chainId), {
      chainId,
      blockNumber: 0,
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', chainId };
  },

  async onBlock(input, storage) {
    const chainId = input.chainId as number;
    const blockNumber = input.blockNumber as number;
    const blockHash = input.blockHash as string;

    // Retrieve current block height for this chain
    const heightRecord = await storage.get('blockHeight', String(chainId));
    const currentHeight = heightRecord ? (heightRecord.blockNumber as number) : 0;

    // Reorg detection: if the new block number is less than or equal to
    // the current height, a reorganization has occurred
    if (blockNumber <= currentHeight && currentHeight > 0) {
      const reorgDepth = currentHeight - blockNumber + 1;

      // Update block height to the reorged block
      await storage.put('blockHeight', String(chainId), {
        chainId,
        blockNumber,
        blockHash,
        updatedAt: new Date().toISOString(),
      });

      // Mark all pending subscriptions at or after the reorged block as reorged
      const pendingSubscriptions = await storage.find('subscription', { status: 'pending' });
      for (const sub of pendingSubscriptions) {
        const subBlock = sub.blockNumber as number;
        if (subBlock >= blockNumber && subBlock > 0) {
          await storage.put('subscription', sub.txHash as string, {
            ...sub,
            status: 'reorged',
            reorgDepth,
          });
        }
      }

      return {
        variant: 'reorg',
        chainId,
        depth: reorgDepth,
        fromBlock: blockNumber,
      };
    }

    // Normal block processing -- update height
    await storage.put('blockHeight', String(chainId), {
      chainId,
      blockNumber,
      blockHash,
      updatedAt: new Date().toISOString(),
    });

    // Retrieve chain config for finality threshold
    const config = await storage.get('chainConfig', String(chainId));
    const threshold = config ? (config.threshold as number) : DEFAULT_CONFIRMATION_THRESHOLD;

    // Update confirmation counts for all pending subscriptions
    const pendingSubscriptions = await storage.find('subscription', { status: 'pending' });
    for (const sub of pendingSubscriptions) {
      const subBlock = sub.blockNumber as number;
      if (subBlock > 0) {
        const confirmations = blockNumber - subBlock;

        if (confirmations >= threshold) {
          // Finality reached -- mark as finalized for the next awaitFinality call
          await storage.put('subscription', sub.txHash as string, {
            ...sub,
            status: 'finalized',
            chain: String(chainId),
            finalizedBlock: blockNumber,
            confirmations,
          });
        } else {
          // Update confirmation count
          await storage.put('subscription', sub.txHash as string, {
            ...sub,
            chain: String(chainId),
            confirmations,
          });
        }
      }
    }

    return { variant: 'ok', chainId, blockNumber };
  },
};
