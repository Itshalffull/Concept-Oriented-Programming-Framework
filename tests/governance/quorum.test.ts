// ============================================================
// Quorum Concept Conformance Tests
//
// Tests for quorum threshold setting, participation checks,
// and threshold updates.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { quorumHandler } from '../../handlers/ts/app/governance/quorum.handler.js';

describe('Quorum Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('setThreshold', () => {
    it('sets an absolute threshold', async () => {
      const result = await quorumHandler.setThreshold({
        type: 'Absolute', absoluteThreshold: 10, scope: 'proposal-1',
      }, storage);
      expect(result.variant).toBe('set');
    });

    it('sets a fractional threshold', async () => {
      const result = await quorumHandler.setThreshold({
        type: 'Fractional', fractionalThreshold: 0.5, scope: 'proposal-2',
      }, storage);
      expect(result.variant).toBe('set');
    });
  });

  describe('check', () => {
    it('meets absolute quorum', async () => {
      const q = await quorumHandler.setThreshold({
        type: 'Absolute', absoluteThreshold: 5, scope: 'p1',
      }, storage);
      const result = await quorumHandler.check({
        quorum: q.quorum, participation: 6, total: 10,
      }, storage);
      expect(result.variant).toBe('met');
    });

    it('fails absolute quorum', async () => {
      const q = await quorumHandler.setThreshold({
        type: 'Absolute', absoluteThreshold: 10, scope: 'p2',
      }, storage);
      const result = await quorumHandler.check({
        quorum: q.quorum, participation: 5, total: 20,
      }, storage);
      expect(result.variant).toBe('not_met');
    });

    it('meets fractional quorum', async () => {
      const q = await quorumHandler.setThreshold({
        type: 'Fractional', fractionalThreshold: 0.25, scope: 'p3',
      }, storage);
      const result = await quorumHandler.check({
        quorum: q.quorum, participation: 30, total: 100,
      }, storage);
      expect(result.variant).toBe('met');
    });

    it('none type always passes', async () => {
      const q = await quorumHandler.setThreshold({
        type: 'None', scope: 'p4',
      }, storage);
      const result = await quorumHandler.check({
        quorum: q.quorum, participation: 0, total: 100,
      }, storage);
      expect(result.variant).toBe('met');
    });
  });
});
