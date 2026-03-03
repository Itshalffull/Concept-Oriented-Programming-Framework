// ============================================================
// Treasury Concept Conformance Tests
//
// Tests for treasury vault: deposit, withdraw (with insufficient
// funds guard), allocation, and release.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { treasuryHandler } from '../../handlers/ts/app/governance/treasury.handler.js';

describe('Treasury Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('deposit / withdraw', () => {
    it('deposits funds and tracks balance', async () => {
      const d1 = await treasuryHandler.deposit(
        { vault: 'main', token: 'ETH', amount: 100, depositor: 'alice' },
        storage,
      );
      expect(d1.variant).toBe('deposited');
      expect(d1.newBalance).toBe(100);

      const d2 = await treasuryHandler.deposit(
        { vault: 'main', token: 'ETH', amount: 50, depositor: 'bob' },
        storage,
      );
      expect(d2.newBalance).toBe(150);
    });

    it('withdraws funds when sufficient', async () => {
      await treasuryHandler.deposit({ vault: 'main', token: 'ETH', amount: 100, depositor: 'alice' }, storage);
      const result = await treasuryHandler.withdraw(
        { vault: 'main', token: 'ETH', amount: 40, recipient: 'bob', sourceRef: 'prop-1' },
        storage,
      );
      expect(result.variant).toBe('withdrawn');
      expect(result.newBalance).toBe(60);
    });

    it('rejects withdrawal when insufficient', async () => {
      await treasuryHandler.deposit({ vault: 'main', token: 'ETH', amount: 10, depositor: 'alice' }, storage);
      const result = await treasuryHandler.withdraw(
        { vault: 'main', token: 'ETH', amount: 100, recipient: 'bob', sourceRef: 'prop-1' },
        storage,
      );
      expect(result.variant).toBe('insufficient');
    });
  });

  describe('allocate / releaseAllocation', () => {
    it('creates and releases an allocation', async () => {
      const alloc = await treasuryHandler.allocate(
        { vault: 'main', token: 'ETH', amount: 50, purpose: 'project-x' },
        storage,
      );
      expect(alloc.variant).toBe('allocated');

      const release = await treasuryHandler.releaseAllocation(
        { allocation: alloc.allocation },
        storage,
      );
      expect(release.variant).toBe('released');
    });
  });
});
