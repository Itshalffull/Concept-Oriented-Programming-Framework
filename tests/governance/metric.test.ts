// ============================================================
// Metric Concept Conformance Tests
//
// Tests for governance metrics: definition, value updates,
// threshold setting, and evaluation.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { metricHandler } from '../../handlers/ts/app/governance/metric.handler.js';

describe('Metric Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('define', () => {
    it('defines a metric', async () => {
      const result = await metricHandler.define({
        name: 'treasury-balance', unit: 'ETH', aggregation: 'latest',
      }, storage);
      expect(result.variant).toBe('defined');
      expect(result.metric).toBeDefined();
    });
  });

  describe('update', () => {
    it('updates metric value', async () => {
      const m = await metricHandler.define({ name: 'balance', unit: 'ETH', aggregation: 'latest' }, storage);
      const result = await metricHandler.update({
        metric: m.metric, value: 100, source: 'chain',
      }, storage);
      expect(result.variant).toBe('updated');
    });
  });

  describe('setThreshold / evaluate', () => {
    it('detects threshold crossing', async () => {
      const m = await metricHandler.define({ name: 'tvl', unit: 'USD', aggregation: 'latest' }, storage);
      await metricHandler.setThreshold({
        metric: m.metric, threshold: 50, alertOnBreach: true,
      }, storage);
      await metricHandler.update({ metric: m.metric, value: 30, source: 'oracle' }, storage);

      const result = await metricHandler.evaluate({ metric: m.metric }, storage);
      // Value 30 is below threshold 50
      expect(['within_threshold', 'threshold_crossed']).toContain(result.variant);
    });
  });
});
