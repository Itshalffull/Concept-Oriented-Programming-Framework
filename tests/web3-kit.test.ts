// ============================================================
// Web3 Kit Handler Tests
//
// Tests for ChainMonitor, Content, and Wallet concept handlers.
// Uses in-memory storage from the kernel.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/index.js';
import { chainMonitorHandler } from '../handlers/ts/repertoire/web3/chain-monitor.handler.js';
import { contentHandler } from '../handlers/ts/repertoire/web3/content.handler.js';
import { walletHandler } from '../handlers/ts/repertoire/web3/wallet.handler.js';
import type { ConceptStorage } from '../kernel/src/types.js';

// ============================================================
// ChainMonitor Tests
// ============================================================

describe('ChainMonitor Handler', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('subscribe registers a chain', async () => {
    const result = await chainMonitorHandler.subscribe(
      { chainId: 1, rpcUrl: 'http://localhost:8545' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.chainId).toBe(1);
  });

  it('awaitFinality stores a pending subscription', async () => {
    const result = await chainMonitorHandler.awaitFinality(
      { txHash: '0xabc', level: 'confirmations' },
      storage,
    );
    expect(result.variant).toBe('ok');

    // Verify subscription was stored
    const sub = await storage.get('subscriptions', '0xabc');
    expect(sub).not.toBeNull();
    expect(sub!.txHash).toBe('0xabc');
    expect(sub!.status).toBe('pending');
  });

  it('onBlock processes a normal block', async () => {
    // Subscribe first
    await chainMonitorHandler.subscribe(
      { chainId: 1, rpcUrl: 'http://localhost:8545' },
      storage,
    );

    const result = await chainMonitorHandler.onBlock(
      { chainId: 1, blockNumber: 100, blockHash: '0xhash100' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.chainId).toBe(1);
    expect(result.blockNumber).toBe(100);
  });

  it('onBlock detects reorg when block hash changes', async () => {
    await chainMonitorHandler.subscribe(
      { chainId: 42, rpcUrl: 'http://localhost:8545' },
      storage,
    );

    // Process block 100 with hash A
    await chainMonitorHandler.onBlock(
      { chainId: 42, blockNumber: 100, blockHash: '0xhashA' },
      storage,
    );

    // Process block 101
    await chainMonitorHandler.onBlock(
      { chainId: 42, blockNumber: 101, blockHash: '0xhash101' },
      storage,
    );

    // Reorg: block 100 now has hash B
    const result = await chainMonitorHandler.onBlock(
      { chainId: 42, blockNumber: 100, blockHash: '0xhashB' },
      storage,
    );
    expect(result.variant).toBe('reorg');
    expect(result.chainId).toBe(42);
    expect(result.depth).toBeGreaterThan(0);
    expect(result.fromBlock).toBe(100);
  });

  it('onBlock with no subscription still works', async () => {
    const result = await chainMonitorHandler.onBlock(
      { chainId: 999, blockNumber: 1, blockHash: '0x1' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });
});

// ============================================================
// Content Tests
// ============================================================

describe('Content Handler', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('store returns a CID and size', async () => {
    const result = await contentHandler.store(
      { data: 'hello world', name: 'test.txt', contentType: 'text/plain' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.cid).toBeDefined();
    expect(typeof result.cid).toBe('string');
    expect(result.size).toBeGreaterThan(0);
  });

  it('store saves metadata to storage', async () => {
    const result = await contentHandler.store(
      { data: 'test data', name: 'doc.txt', contentType: 'text/plain' },
      storage,
    );
    expect(result.variant).toBe('ok');

    const meta = await storage.get('items', result.cid as string);
    expect(meta).not.toBeNull();
    expect(meta!.name).toBe('doc.txt');
    expect(meta!.contentType).toBe('text/plain');
    expect(meta!.pinned).toBe(false);
  });

  it('pin marks content as pinned', async () => {
    const storeResult = await contentHandler.store(
      { data: 'pin me', name: 'pinned.txt', contentType: 'text/plain' },
      storage,
    );
    const cid = storeResult.cid as string;

    const pinResult = await contentHandler.pin({ cid }, storage);
    expect(pinResult.variant).toBe('ok');
    expect(pinResult.cid).toBe(cid);

    const meta = await storage.get('items', cid);
    expect(meta!.pinned).toBe(true);
  });

  it('unpin marks content as unpinned', async () => {
    const storeResult = await contentHandler.store(
      { data: 'unpin me', name: 'temp.txt', contentType: 'text/plain' },
      storage,
    );
    const cid = storeResult.cid as string;

    await contentHandler.pin({ cid }, storage);
    const unpinResult = await contentHandler.unpin({ cid }, storage);
    expect(unpinResult.variant).toBe('ok');

    const meta = await storage.get('items', cid);
    expect(meta!.pinned).toBe(false);
  });

  it('resolve returns notFound for unknown CID', async () => {
    const result = await contentHandler.resolve(
      { cid: 'QmNonexistent' },
      storage,
    );
    expect(result.variant).toBe('notFound');
    expect(result.cid).toBe('QmNonexistent');
  });

  it('resolve returns data for stored content', async () => {
    const storeResult = await contentHandler.store(
      { data: 'resolvable', name: 'res.txt', contentType: 'text/plain' },
      storage,
    );
    const cid = storeResult.cid as string;

    const resolveResult = await contentHandler.resolve({ cid }, storage);
    // The stub IPFS client returns empty Uint8Array for get(), but variant should be ok
    expect(resolveResult.variant).toBe('ok');
    expect(resolveResult.contentType).toBe('text/plain');
  });

  it('store produces deterministic CIDs for same data', async () => {
    const result1 = await contentHandler.store(
      { data: 'identical', name: 'a.txt', contentType: 'text/plain' },
      storage,
    );
    const result2 = await contentHandler.store(
      { data: 'identical', name: 'b.txt', contentType: 'text/plain' },
      storage,
    );
    expect(result1.cid).toBe(result2.cid);
  });
});

// ============================================================
// Wallet Tests
// ============================================================

describe('Wallet Handler', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('verify returns a result with variant', { timeout: 15000 }, async () => {
    // Without ethers installed, the stub always returns zero address
    const result = await walletHandler.verify(
      {
        address: '0x0000000000000000000000000000000000000000',
        message: 'hello',
        signature: '0xsig',
      },
      storage,
    );
    // The stub recovers 0x0...0 which matches the claimed address
    expect(result.variant).toBe('ok');
    expect(result.address).toBe('0x0000000000000000000000000000000000000000');
    expect(result.recoveredAddress).toBe('0x0000000000000000000000000000000000000000');
  });

  it('verify returns invalid when addresses do not match', async () => {
    const result = await walletHandler.verify(
      {
        address: '0x1111111111111111111111111111111111111111',
        message: 'hello',
        signature: '0xsig',
      },
      storage,
    );
    // Stub recovers 0x0...0, claimed is 0x1...1 → invalid
    expect(result.variant).toBe('invalid');
  });

  it('verify registers address on successful verification', async () => {
    await walletHandler.verify(
      {
        address: '0x0000000000000000000000000000000000000000',
        message: 'hello',
        signature: '0xsig',
      },
      storage,
    );

    const record = await storage.get('addresses', '0x0000000000000000000000000000000000000000');
    expect(record).not.toBeNull();
    expect(record!.address).toBe('0x0000000000000000000000000000000000000000');
  });

  it('getNonce returns notFound for unknown address', async () => {
    const result = await walletHandler.getNonce(
      { address: '0xunknown' },
      storage,
    );
    expect(result.variant).toBe('notFound');
  });

  it('incrementNonce creates and increments nonce', async () => {
    const r1 = await walletHandler.incrementNonce(
      { address: '0xABC' },
      storage,
    );
    expect(r1.variant).toBe('ok');
    expect(r1.nonce).toBe(1);

    const r2 = await walletHandler.incrementNonce(
      { address: '0xABC' },
      storage,
    );
    expect(r2.variant).toBe('ok');
    expect(r2.nonce).toBe(2);
  });

  it('getNonce returns correct nonce after increment', async () => {
    await walletHandler.incrementNonce({ address: '0xDEF' }, storage);
    await walletHandler.incrementNonce({ address: '0xDEF' }, storage);
    await walletHandler.incrementNonce({ address: '0xDEF' }, storage);

    const result = await walletHandler.getNonce(
      { address: '0xDEF' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.nonce).toBe(3);
  });

  it('verifyTypedData returns a result', async () => {
    const result = await walletHandler.verifyTypedData(
      {
        address: '0x0000000000000000000000000000000000000000',
        domain: '{}',
        types: '{}',
        value: '{}',
        signature: '0xsig',
      },
      storage,
    );
    // Stub recovers 0x0...0 → matches → ok
    expect(result.variant).toBe('ok');
  });
});
