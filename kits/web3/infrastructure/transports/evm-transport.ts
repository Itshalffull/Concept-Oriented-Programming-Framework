// ============================================================
// EVM Transport Adapter (~300 LOC)
//
// Implements ConceptTransport for EVM-compatible blockchains.
// Maps concept invoke() to contract calls, query() to storage
// reads, subscribe() to event log subscriptions.
//
// Works for all EVM chains (Ethereum, Arbitrum, Optimism, Base,
// Polygon) — different RPC endpoints, same adapter.
//
// Pre-conceptual infrastructure (Section 10.3). This is NOT a
// concept — it's protocol plumbing that lives in the kit's
// infrastructure/ directory.
//
// Dependencies: ethers.js or viem (configured at instantiation)
// ============================================================

import type {
  ActionInvocation,
  ActionCompletion,
} from '../../../../kernel/src/types.js';

/** Configuration for an EVM chain connection */
export interface EVMChainConfig {
  chainId: number;
  rpcUrl: string;
  /** Optional WebSocket URL for subscriptions */
  wsUrl?: string;
  /** Gas price strategy: 'legacy' | 'eip1559' */
  gasStrategy?: 'legacy' | 'eip1559';
  /** Maximum gas price in gwei */
  maxGasPrice?: number;
  /** Transaction confirmation timeout in ms */
  confirmationTimeout?: number;
}

/** Contract ABI entry for invoke mapping */
interface ContractMethod {
  name: string;
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
  stateMutability: 'view' | 'pure' | 'nonpayable' | 'payable';
}

/** Event subscription handle */
interface Subscription {
  eventName: string;
  contractAddress: string;
  callback: (completion: ActionCompletion) => void;
  unsubscribe: () => void;
}

/**
 * EVM Transport Adapter.
 *
 * Bridges the COPF sync engine to EVM-compatible blockchains.
 * Each instance connects to one chain; multi-chain setups use
 * multiple adapter instances configured in the deploy manifest.
 */
export class EVMTransport {
  private config: EVMChainConfig;
  private provider: any; // ethers.JsonRpcProvider or viem PublicClient
  private signer: any; // ethers.Wallet or viem WalletClient
  private subscriptions: Map<string, Subscription> = new Map();
  private nonceTracker: Map<string, number> = new Map();

  constructor(config: EVMChainConfig) {
    this.config = config;
  }

  /**
   * Initialize the provider and signer.
   * Called once at startup; the transport is not usable until connected.
   */
  async connect(privateKey?: string): Promise<void> {
    // Dynamic import to support both ethers.js and viem
    try {
      const { JsonRpcProvider, Wallet } = await import('ethers');
      this.provider = new JsonRpcProvider(this.config.rpcUrl, this.config.chainId);
      if (privateKey) {
        this.signer = new Wallet(privateKey, this.provider);
      }
    } catch {
      // Fallback or error — ethers not installed
      throw new Error(
        `EVM transport requires ethers.js. Install with: npm install ethers`
      );
    }
  }

  /**
   * Invoke a contract method (write transaction).
   *
   * Maps ActionInvocation fields to contract call parameters:
   *   - invocation.input.contractAddress → target contract
   *   - invocation.input.method → contract method name
   *   - invocation.input.args → method arguments
   *   - invocation.input.value → ETH value (optional, for payable)
   */
  async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
    const {
      contractAddress,
      method,
      args = [],
      value,
      abi,
    } = invocation.input as {
      contractAddress: string;
      method: string;
      args?: unknown[];
      value?: string;
      abi?: ContractMethod[];
    };

    try {
      if (!this.signer) {
        throw new Error('No signer configured — cannot send transactions');
      }

      // Encode the function call
      const { Contract, parseEther } = await import('ethers');
      const contract = new Contract(contractAddress, abi || [], this.signer);

      // Gas estimation
      const gasEstimate = await contract[method].estimateGas(...args, {
        value: value ? parseEther(value) : undefined,
      });

      // Submit transaction
      const tx = await contract[method](...args, {
        value: value ? parseEther(value) : undefined,
        gasLimit: gasEstimate * BigInt(120) / BigInt(100), // 20% buffer
      });

      // Wait for receipt (1 confirmation)
      const receipt = await tx.wait(1);

      return {
        id: invocation.id,
        concept: invocation.concept,
        action: invocation.action,
        input: invocation.input,
        variant: 'ok',
        output: {
          variant: 'ok',
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          chain: String(this.config.chainId),
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
   * Query contract storage (read-only call).
   *
   * Maps to eth_call — no transaction, no gas.
   */
  async query(request: {
    contractAddress: string;
    method: string;
    args?: unknown[];
    abi?: ContractMethod[];
  }): Promise<unknown> {
    const { Contract } = await import('ethers');
    const contract = new Contract(
      request.contractAddress,
      request.abi || [],
      this.provider,
    );

    return await contract[request.method](...(request.args || []));
  }

  /**
   * Subscribe to contract events.
   *
   * Event logs arrive as ActionCompletions that can trigger syncs.
   * The completion's variant is the event name, and the output
   * contains the decoded event arguments.
   */
  async subscribe(
    contractAddress: string,
    eventName: string,
    abi: ContractMethod[],
    onCompletion: (completion: ActionCompletion) => void,
  ): Promise<string> {
    const { Contract } = await import('ethers');
    const contract = new Contract(contractAddress, abi, this.provider);

    const subscriptionId = `${contractAddress}:${eventName}:${Date.now()}`;

    const listener = (...args: unknown[]) => {
      const event = args[args.length - 1] as { log: { transactionHash: string; blockNumber: number } };
      const eventArgs = args.slice(0, -1);

      const completion: ActionCompletion = {
        id: `event-${subscriptionId}-${Date.now()}`,
        concept: `urn:web3/${contractAddress}`,
        action: eventName,
        input: {},
        variant: eventName,
        output: {
          variant: eventName,
          args: eventArgs,
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber,
        },
        flow: `event-flow-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };

      onCompletion(completion);
    };

    contract.on(eventName, listener);

    this.subscriptions.set(subscriptionId, {
      eventName,
      contractAddress,
      callback: onCompletion,
      unsubscribe: () => contract.off(eventName, listener),
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from a contract event.
   */
  unsubscribe(subscriptionId: string): void {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Health check — verify RPC connection and measure latency.
   */
  async health(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.provider.getBlockNumber();
      return { healthy: true, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }

  /**
   * Disconnect and clean up all subscriptions.
   */
  async disconnect(): Promise<void> {
    for (const [id] of this.subscriptions) {
      this.unsubscribe(id);
    }
    if (this.provider?.destroy) {
      await this.provider.destroy();
    }
  }
}
