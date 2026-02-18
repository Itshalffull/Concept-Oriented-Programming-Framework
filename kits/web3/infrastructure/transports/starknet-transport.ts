// ============================================================
// StarkNet Transport Adapter
//
// Implements ConceptTransport for StarkNet (Cairo VM) chains.
// Separate from EVM because Cairo VM has a different execution
// model, account abstraction, and transaction format.
//
// Uses starknet.js for transaction submission and storage reads.
//
// Pre-conceptual infrastructure (Section 10.3).
//
// Dependencies: starknet (starknet.js)
// ============================================================

import type {
  ActionInvocation,
  ActionCompletion,
} from '../../../../kernel/src/types.js';

/** Configuration for a StarkNet connection */
export interface StarkNetConfig {
  chainId: string; // "SN_MAIN" | "SN_GOERLI" | "SN_SEPOLIA"
  rpcUrl: string;
  /** Account address for signing transactions */
  accountAddress?: string;
  /** Private key for the account */
  privateKey?: string;
}

/**
 * StarkNet Transport Adapter.
 *
 * Bridges the COPF sync engine to StarkNet chains.
 * Cairo VM is not EVM — different ABI encoding, account
 * abstraction model, and transaction lifecycle.
 */
export class StarkNetTransport {
  private config: StarkNetConfig;
  private provider: any; // RpcProvider from starknet.js
  private account: any; // Account from starknet.js

  constructor(config: StarkNetConfig) {
    this.config = config;
  }

  /** Initialize the provider and account. */
  async connect(): Promise<void> {
    try {
      const { RpcProvider, Account } = await import('starknet');
      this.provider = new RpcProvider({ nodeUrl: this.config.rpcUrl });

      if (this.config.accountAddress && this.config.privateKey) {
        this.account = new Account(
          this.provider,
          this.config.accountAddress,
          this.config.privateKey,
        );
      }
    } catch {
      throw new Error(
        'StarkNet transport requires starknet.js. Install with: npm install starknet'
      );
    }
  }

  /**
   * Invoke a StarkNet contract function (write transaction).
   *
   * Maps ActionInvocation to a StarkNet multicall:
   *   - invocation.input.contractAddress → target contract
   *   - invocation.input.entrypoint → function selector
   *   - invocation.input.calldata → Cairo calldata array
   */
  async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
    const {
      contractAddress,
      entrypoint,
      calldata = [],
    } = invocation.input as {
      contractAddress: string;
      entrypoint: string;
      calldata?: string[];
    };

    try {
      if (!this.account) {
        throw new Error('No account configured — cannot send transactions');
      }

      // Execute transaction via account abstraction
      const result = await this.account.execute({
        contractAddress,
        entrypoint,
        calldata,
      });

      // Wait for transaction to be accepted
      await this.provider.waitForTransaction(result.transaction_hash);

      return {
        id: invocation.id,
        concept: invocation.concept,
        action: invocation.action,
        input: invocation.input,
        variant: 'ok',
        output: {
          variant: 'ok',
          txHash: result.transaction_hash,
          chain: this.config.chainId,
        },
        flow: invocation.flow,
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        id: invocation.id,
        concept: invocation.concept,
        action: invocation.action,
        input: invocation.input,
        variant: 'error',
        output: { variant: 'error', message },
        flow: invocation.flow,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Query StarkNet contract storage (read-only call).
   */
  async query(request: {
    contractAddress: string;
    entrypoint: string;
    calldata?: string[];
  }): Promise<unknown> {
    const result = await this.provider.callContract({
      contractAddress: request.contractAddress,
      entrypoint: request.entrypoint,
      calldata: request.calldata || [],
    });

    return result;
  }

  /** Health check — verify RPC connection. */
  async health(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.provider.getBlockLatestAccepted();
      return { healthy: true, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }

  async disconnect(): Promise<void> {
    // StarkNet provider doesn't need explicit cleanup
  }
}
