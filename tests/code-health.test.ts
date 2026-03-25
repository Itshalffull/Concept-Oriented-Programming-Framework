// CodeHealth handler unit tests
// Validates all 6 actions and the 10-biomarker scoring model.

import { describe, it, expect, beforeEach } from 'vitest';
import { codeHealthHandler, resetCodeHealthCounter } from '../handlers/ts/quality-analysis/code-health.handler.js';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import type { ConceptStorage } from '../runtime/types.js';

const HEALTHY_SIGNALS = {
  target: 'src/auth/login.ts',
  complexity: 15.0,
  testCoverage: 88.0,
  duplication: 4.0,
  depFreshness: 90.0,
  securityVulns: 0.0,
  docCoverage: 75.0,
  codeChurn: 20.0,
  coupling: 30.0,
  techDebt: 10.0,
  staticViolations: 2.0,
};

const UNHEALTHY_SIGNALS = {
  target: 'src/legacy/big-ball-of-mud.ts',
  complexity: 95.0,
  testCoverage: 5.0,
  duplication: 60.0,
  depFreshness: 20.0,
  securityVulns: 80.0,
  docCoverage: 5.0,
  codeChurn: 90.0,
  coupling: 85.0,
  techDebt: 80.0,
  staticViolations: 75.0,
};

describe('CodeHealth handler', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetCodeHealthCounter();
  });

  describe('register', () => {
    it('returns CodeHealth as the concept name', async () => {
      const result = await codeHealthHandler.register({}, storage) as any;
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('CodeHealth');
    });
  });

  describe('measure', () => {
    it('measures healthy signals and returns a health score', async () => {
      const result = await codeHealthHandler.measure(HEALTHY_SIGNALS, storage) as any;
      expect(result.variant).toBe('ok');
      expect(typeof result.snapshot).toBe('string');
      expect(typeof result.healthScore).toBe('number');
      expect(result.healthScore).toBeGreaterThan(50); // healthy codebase
      expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade);
    });

    it('measures unhealthy signals and returns a low score', async () => {
      const result = await codeHealthHandler.measure(UNHEALTHY_SIGNALS, storage) as any;
      expect(result.variant).toBe('ok');
      expect(result.healthScore).toBeLessThan(50); // unhealthy codebase
      expect(['D', 'F']).toContain(result.grade);
    });

    it('returns invalid for empty target', async () => {
      const result = await codeHealthHandler.measure({
        ...HEALTHY_SIGNALS,
        target: '',
      }, storage) as any;
      expect(result.variant).toBe('invalid');
      expect(typeof result.message).toBe('string');
    });

    it('returns invalid for out-of-range signal value', async () => {
      const result = await codeHealthHandler.measure({
        ...HEALTHY_SIGNALS,
        complexity: -5.0,
      }, storage) as any;
      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('complexity');
    });

    it('returns invalid for signal value above 100', async () => {
      const result = await codeHealthHandler.measure({
        ...HEALTHY_SIGNALS,
        testCoverage: 150.0,
      }, storage) as any;
      expect(result.variant).toBe('invalid');
    });
  });

  describe('get', () => {
    it('retrieves a snapshot by ID with all 10 signals', async () => {
      const measured = await codeHealthHandler.measure(HEALTHY_SIGNALS, storage) as any;
      expect(measured.variant).toBe('ok');

      const result = await codeHealthHandler.get({ snapshot: measured.snapshot }, storage) as any;
      expect(result.variant).toBe('ok');
      expect(result.snapshot).toBe(measured.snapshot);
      expect(result.target).toBe('src/auth/login.ts');
      expect(result.healthScore).toBe(measured.healthScore);
      expect(result.grade).toBe(measured.grade);
      // All 10 signals present
      expect(result.signals.complexity).toBe(15.0);
      expect(result.signals.testCoverage).toBe(88.0);
      expect(result.signals.duplication).toBe(4.0);
      expect(result.signals.depFreshness).toBe(90.0);
      expect(result.signals.securityVulns).toBe(0.0);
      expect(result.signals.docCoverage).toBe(75.0);
      expect(result.signals.codeChurn).toBe(20.0);
      expect(result.signals.coupling).toBe(30.0);
      expect(result.signals.techDebt).toBe(10.0);
      expect(result.signals.staticViolations).toBe(2.0);
    });

    it('returns notfound for unknown snapshot ID', async () => {
      const result = await codeHealthHandler.get({ snapshot: 'nonexistent' }, storage) as any;
      expect(result.variant).toBe('notfound');
    });
  });

  describe('latest', () => {
    it('returns the most recent snapshot for a target', async () => {
      await codeHealthHandler.measure(HEALTHY_SIGNALS, storage);
      const result = await codeHealthHandler.latest({ target: 'src/auth/login.ts' }, storage) as any;
      expect(result.variant).toBe('ok');
      expect(typeof result.snapshot).toBe('string');
      expect(typeof result.healthScore).toBe('number');
      expect(['improving', 'stable', 'degrading']).toContain(result.trend);
    });

    it('returns notfound for unknown target', async () => {
      const result = await codeHealthHandler.latest({ target: 'does-not-exist.ts' }, storage) as any;
      expect(result.variant).toBe('notfound');
    });
  });

  describe('history', () => {
    it('returns all snapshots for a target in descending order', async () => {
      await codeHealthHandler.measure(HEALTHY_SIGNALS, storage);
      const result = await codeHealthHandler.history({ target: 'src/auth/login.ts', limit: null }, storage) as any;
      expect(result.variant).toBe('ok');
      expect(Array.isArray(result.snapshots)).toBe(true);
      expect(result.snapshots.length).toBeGreaterThanOrEqual(1);
    });

    it('respects the limit parameter', async () => {
      await codeHealthHandler.measure(HEALTHY_SIGNALS, storage);
      await codeHealthHandler.measure(HEALTHY_SIGNALS, storage);
      const result = await codeHealthHandler.history({ target: 'src/auth/login.ts', limit: 1 }, storage) as any;
      expect(result.variant).toBe('ok');
      expect(result.snapshots.length).toBe(1);
    });

    it('returns notfound for unknown target', async () => {
      const result = await codeHealthHandler.history({ target: 'nonexistent.ts', limit: null }, storage) as any;
      expect(result.variant).toBe('notfound');
    });
  });

  describe('compare', () => {
    it('compares two snapshots and identifies degraded signals', async () => {
      const a = await codeHealthHandler.measure(HEALTHY_SIGNALS, storage) as any;
      const b = await codeHealthHandler.measure(UNHEALTHY_SIGNALS, storage) as any;

      const result = await codeHealthHandler.compare({
        target: 'src/auth/login.ts',
        snapshotA: a.snapshot,
        snapshotB: b.snapshot,
      }, storage) as any;

      expect(result.variant).toBe('ok');
      expect(typeof result.delta).toBe('number');
      expect(typeof result.improved).toBe('boolean');
      expect(Array.isArray(result.degradedSignals)).toBe(true);
      // Unhealthy has worse scores on most signals — delta should be negative
      expect(result.delta).toBeLessThan(0);
      expect(result.improved).toBe(false);
      // Multiple signals degraded
      expect(result.degradedSignals.length).toBeGreaterThan(0);
    });

    it('returns notfound when snapshots do not exist', async () => {
      const result = await codeHealthHandler.compare({
        target: 'src/auth/login.ts',
        snapshotA: 'nonexistent-a',
        snapshotB: 'nonexistent-b',
      }, storage) as any;
      expect(result.variant).toBe('notfound');
    });
  });

  describe('topOffenders', () => {
    it('returns targets sorted by ascending health score', async () => {
      await codeHealthHandler.measure(HEALTHY_SIGNALS, storage);
      await codeHealthHandler.measure(UNHEALTHY_SIGNALS, storage);

      const result = await codeHealthHandler.topOffenders({ limit: null, grade: null }, storage) as any;
      expect(result.variant).toBe('ok');
      expect(Array.isArray(result.offenders)).toBe(true);
      expect(result.offenders.length).toBe(2);
      // First entry should be the unhealthiest
      expect(result.offenders[0].target).toBe('src/legacy/big-ball-of-mud.ts');
      expect(typeof result.offenders[0].worstSignal).toBe('string');
    });

    it('respects the grade filter', async () => {
      await codeHealthHandler.measure(HEALTHY_SIGNALS, storage); // should be B or A
      await codeHealthHandler.measure(UNHEALTHY_SIGNALS, storage); // should be F

      const result = await codeHealthHandler.topOffenders({ limit: null, grade: 'C' }, storage) as any;
      expect(result.variant).toBe('ok');
      // Only F-grade should pass (D and below match "C" filter)
      for (const o of result.offenders) {
        expect(['D', 'F']).toContain(o.grade);
      }
    });
  });

  describe('breakdown', () => {
    it('returns per-signal contribution with weights and ratings', async () => {
      const measured = await codeHealthHandler.measure(HEALTHY_SIGNALS, storage) as any;
      const result = await codeHealthHandler.breakdown({ snapshot: measured.snapshot }, storage) as any;

      expect(result.variant).toBe('ok');
      expect(Array.isArray(result.signals)).toBe(true);
      expect(result.signals.length).toBe(10); // all 10 biomarkers
      for (const sig of result.signals) {
        expect(typeof sig.name).toBe('string');
        expect(typeof sig.value).toBe('number');
        expect(typeof sig.weight).toBe('number');
        expect(typeof sig.contribution).toBe('number');
        expect(['good', 'fair', 'poor']).toContain(sig.rating);
      }
    });

    it('returns notfound for unknown snapshot', async () => {
      const result = await codeHealthHandler.breakdown({ snapshot: 'nonexistent' }, storage) as any;
      expect(result.variant).toBe('notfound');
    });
  });
});
