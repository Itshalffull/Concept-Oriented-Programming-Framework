// ============================================================
// Counting Method Concept Conformance Tests
//
// Tests for the counting method registry: registration,
// aggregation, and deregistration.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { countingMethodHandler } from '../../handlers/ts/app/governance/counting-method.handler.js';

describe('Counting Method Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('register', () => {
    it('registers a counting method', async () => {
      const result = await countingMethodHandler.register({
        name: 'majority', providerRef: 'maj-provider-1',
      }, storage);
      expect(result.variant).toBe('registered');
      expect(result.method).toBeDefined();
    });
  });

  describe('aggregate', () => {
    it('returns not_found for unknown method', async () => {
      const result = await countingMethodHandler.aggregate({
        method: 'nonexistent', ballots: [], weights: {},
      }, storage);
      expect(result.variant).toBe('not_found');
    });
  });

  describe('deregister', () => {
    it('deregisters a method', async () => {
      const reg = await countingMethodHandler.register({
        name: 'temp-method', providerRef: 'provider-x',
      }, storage);
      const result = await countingMethodHandler.deregister({ method: reg.method }, storage);
      expect(result.variant).toBe('deregistered');
    });
  });
});
