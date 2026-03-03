// ============================================================
// Finality Gate Concept Conformance Tests
//
// Tests for finality gates: submission and confirmation lifecycle.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { finalityGateHandler } from '../../handlers/ts/app/governance/finality-gate.handler.js';

describe('Finality Gate Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('submit', () => {
    it('submits an operation for finality', async () => {
      const result = await finalityGateHandler.submit({
        operationRef: 'op-001', providerRef: 'immediate',
      }, storage);
      expect(result.variant).toBe('pending');
      expect(result.gate).toBeDefined();
    });
  });

  describe('confirm', () => {
    it('confirms finality for a gate', async () => {
      const gate = await finalityGateHandler.submit({
        operationRef: 'op-002', providerRef: 'chain-finality',
      }, storage);
      const result = await finalityGateHandler.confirm({
        gate: gate.gate, proof: { blockConfirmations: 12 },
      }, storage);
      expect(result.variant).toBe('finalized');
    });

    it('returns not_found for unknown gate', async () => {
      const result = await finalityGateHandler.confirm({
        gate: 'nonexistent', proof: {},
      }, storage);
      expect(result.variant).toBe('not_found');
    });
  });
});
