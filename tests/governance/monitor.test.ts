// ============================================================
// Monitor Concept Conformance Tests
//
// Tests for governance monitoring: watching subjects,
// observing compliance, and resolution.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { monitorHandler } from '../../handlers/ts/app/governance/monitor.handler.js';

describe('Monitor Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('watch', () => {
    it('starts watching a subject', async () => {
      const result = await monitorHandler.watch({
        subject: 'treasury-balance', policyRef: 'policy-1', interval: '1h',
      }, storage);
      expect(result.variant).toBe('watching');
      expect(result.observer).toBeDefined();
    });
  });

  describe('observe', () => {
    it('records a compliant observation', async () => {
      const w = await monitorHandler.watch({
        subject: 'reserve', policyRef: 'policy-2', interval: '30m',
      }, storage);
      const result = await monitorHandler.observe({
        observer: w.observer, evidence: { value: 150, threshold: 100 },
      }, storage);
      expect(result.variant).toBe('compliant');
    });
  });

  describe('resolve', () => {
    it('resolves an observer', async () => {
      const w = await monitorHandler.watch({
        subject: 'metric', policyRef: 'policy-3', interval: '1d',
      }, storage);
      const result = await monitorHandler.resolve({
        observer: w.observer, outcome: 'all-clear',
      }, storage);
      expect(result.variant).toBe('resolved');
    });
  });
});
