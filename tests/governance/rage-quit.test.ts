// ============================================================
// Rage Quit Concept Conformance Tests
//
// Tests for the rage quit mechanism: initiation, claim
// calculation, and exit claim process.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { rageQuitHandler } from '../../handlers/ts/app/governance/rage-quit.handler.js';

describe('Rage Quit Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('initiate', () => {
    it('initiates a rage quit', async () => {
      const result = await rageQuitHandler.initiate({
        member: 'alice', shares: 100, loot: 50,
      }, storage);
      expect(result.variant).toBe('initiated');
      expect(result.exit).toBeDefined();
    });
  });

  describe('calculateClaim', () => {
    it('calculates the exit claim', async () => {
      const exit = await rageQuitHandler.initiate({
        member: 'bob', shares: 200, loot: 100,
      }, storage);
      const result = await rageQuitHandler.calculateClaim({ exit: exit.exit }, storage);
      expect(result.variant).toBe('calculated');
    });
  });

  describe('claim', () => {
    it('claims after calculation', async () => {
      const exit = await rageQuitHandler.initiate({
        member: 'charlie', shares: 50, loot: 25,
      }, storage);
      await rageQuitHandler.calculateClaim({ exit: exit.exit }, storage);
      const result = await rageQuitHandler.claim({ exit: exit.exit }, storage);
      expect(result.variant).toBe('claimed');
    });

    it('rejects claim before calculation', async () => {
      const exit = await rageQuitHandler.initiate({
        member: 'dave', shares: 50, loot: 25,
      }, storage);
      const result = await rageQuitHandler.claim({ exit: exit.exit }, storage);
      expect(result.variant).toBe('not_calculated');
    });
  });
});
