// ============================================================
// QualitySignal Handler Tests
//
// Validates signal recording, latest retrieval, worst-of rollup
// aggregation with blocking gate detection, and explain drilldown.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/index.js';
import { qualitySignalHandler } from '../handlers/ts/framework/test/quality-signal.handler.js';
import type { ConceptStorage } from '../runtime/types.js';

describe('QualitySignal Handler', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // ============================================================
  // record action
  // ============================================================

  describe('record', () => {
    it('records a valid quality signal and returns ok with id', async () => {
      const result = await qualitySignalHandler.record({
        target_symbol: 'MyModule',
        dimension: 'conformance',
        status: 'pass',
        severity: 'gate',
        summary: 'All conformance tests pass',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.id).toBeTruthy();
      expect(typeof result.id).toBe('string');
      expect(result.observed_at).toBeTruthy();
    });

    it('records a signal with optional artifact fields', async () => {
      const result = await qualitySignalHandler.record({
        target_symbol: 'Widget',
        dimension: 'snapshot',
        status: 'warn',
        severity: 'info',
        summary: 'Snapshot drift detected',
        artifact_path: '/snapshots/widget.snap',
        artifact_hash: 'abc123',
        run_ref: 'ci-run-42',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.id).toBeTruthy();
    });

    it('rejects an invalid dimension', async () => {
      const result = await qualitySignalHandler.record({
        target_symbol: 'Foo',
        dimension: 'bogus',
        status: 'pass',
        severity: 'gate',
      }, storage);

      expect(result.variant).toBe('validationError');
      expect(result.message).toContain('dimension');
    });

    it('rejects an invalid status', async () => {
      const result = await qualitySignalHandler.record({
        target_symbol: 'Foo',
        dimension: 'unit',
        status: 'excellent',
        severity: 'gate',
      }, storage);

      expect(result.variant).toBe('validationError');
      expect(result.message).toContain('status');
    });

    it('rejects an invalid severity', async () => {
      const result = await qualitySignalHandler.record({
        target_symbol: 'Foo',
        dimension: 'unit',
        status: 'pass',
        severity: 'critical',
      }, storage);

      expect(result.variant).toBe('validationError');
      expect(result.message).toContain('severity');
    });

    it('rejects missing required fields', async () => {
      const result = await qualitySignalHandler.record({
        target_symbol: 'Foo',
      }, storage);

      expect(result.variant).toBe('validationError');
      expect(result.message).toContain('required');
    });
  });

  // ============================================================
  // latest action
  // ============================================================

  describe('latest', () => {
    it('returns the most recent signal for a target and dimension', async () => {
      // Record two signals for the same target/dimension
      await qualitySignalHandler.record({
        target_symbol: 'Alpha',
        dimension: 'unit',
        status: 'warn',
        severity: 'gate',
        summary: 'first',
      }, storage);

      // Small delay to ensure distinct timestamps
      await new Promise(resolve => setTimeout(resolve, 5));

      await qualitySignalHandler.record({
        target_symbol: 'Alpha',
        dimension: 'unit',
        status: 'pass',
        severity: 'gate',
        summary: 'second',
      }, storage);

      const result = await qualitySignalHandler.latest({
        target_symbol: 'Alpha',
        dimension: 'unit',
      }, storage);

      expect(result.variant).toBe('ok');
      const signal = result.signal as Record<string, unknown>;
      expect(signal.status).toBe('pass');
    });

    it('returns notFound when no signals match', async () => {
      const result = await qualitySignalHandler.latest({
        target_symbol: 'Nonexistent',
        dimension: 'conformance',
      }, storage);

      expect(result.variant).toBe('notFound');
      expect(result.target_symbol).toBe('Nonexistent');
      expect(result.dimension).toBe('conformance');
    });

    it('rejects an invalid dimension', async () => {
      const result = await qualitySignalHandler.latest({
        target_symbol: 'Foo',
        dimension: 'invalid_dim',
      }, storage);

      expect(result.variant).toBe('validationError');
    });

    it('rejects missing required fields', async () => {
      const result = await qualitySignalHandler.latest({
        target_symbol: 'Foo',
      }, storage);

      expect(result.variant).toBe('validationError');
    });
  });

  // ============================================================
  // rollup action
  // ============================================================

  describe('rollup', () => {
    it('computes worst-of status across targets and dimensions', async () => {
      // Target A: conformance=pass, unit=warn
      await qualitySignalHandler.record({
        target_symbol: 'A',
        dimension: 'conformance',
        status: 'pass',
        severity: 'info',
      }, storage);
      await qualitySignalHandler.record({
        target_symbol: 'A',
        dimension: 'unit',
        status: 'warn',
        severity: 'info',
      }, storage);

      // Target B: conformance=fail
      await qualitySignalHandler.record({
        target_symbol: 'B',
        dimension: 'conformance',
        status: 'fail',
        severity: 'info',
      }, storage);

      const result = await qualitySignalHandler.rollup({
        target_symbols: ['A', 'B'],
      }, storage);

      expect(result.variant).toBe('ok');
      const targets = result.targets as Array<{ target_symbol: string; worst_status: string }>;
      expect(targets).toHaveLength(2);

      const targetA = targets.find(t => t.target_symbol === 'A');
      const targetB = targets.find(t => t.target_symbol === 'B');

      // A's worst is warn (lower than pass)
      expect(targetA?.worst_status).toBe('warn');
      // B's worst is fail
      expect(targetB?.worst_status).toBe('fail');
    });

    it('respects status ranking: fail > unknown > warn > pass > skipped', async () => {
      // Record signals with increasing severity of status
      await qualitySignalHandler.record({
        target_symbol: 'Ranked',
        dimension: 'snapshot',
        status: 'skipped',
        severity: 'info',
      }, storage);
      await qualitySignalHandler.record({
        target_symbol: 'Ranked',
        dimension: 'conformance',
        status: 'pass',
        severity: 'info',
      }, storage);
      await qualitySignalHandler.record({
        target_symbol: 'Ranked',
        dimension: 'contract',
        status: 'unknown',
        severity: 'info',
      }, storage);

      const result = await qualitySignalHandler.rollup({
        target_symbols: ['Ranked'],
      }, storage);

      expect(result.variant).toBe('ok');
      const targets = result.targets as Array<{ target_symbol: string; worst_status: string }>;
      // Worst of skipped, pass, unknown should be unknown
      expect(targets[0].worst_status).toBe('unknown');
    });

    it('sets blocking=true when a gate-severity signal has fail status', async () => {
      await qualitySignalHandler.record({
        target_symbol: 'Gated',
        dimension: 'conformance',
        status: 'fail',
        severity: 'gate',
      }, storage);

      const result = await qualitySignalHandler.rollup({
        target_symbols: ['Gated'],
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.blocking).toBe(true);
    });

    it('sets blocking=true when a gate-severity signal has unknown status', async () => {
      await qualitySignalHandler.record({
        target_symbol: 'GatedUnknown',
        dimension: 'formal',
        status: 'unknown',
        severity: 'gate',
      }, storage);

      const result = await qualitySignalHandler.rollup({
        target_symbols: ['GatedUnknown'],
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.blocking).toBe(true);
    });

    it('sets blocking=false when gate-severity signals all pass', async () => {
      await qualitySignalHandler.record({
        target_symbol: 'Safe',
        dimension: 'conformance',
        status: 'pass',
        severity: 'gate',
      }, storage);
      await qualitySignalHandler.record({
        target_symbol: 'Safe',
        dimension: 'unit',
        status: 'warn',
        severity: 'warn',
      }, storage);

      const result = await qualitySignalHandler.rollup({
        target_symbols: ['Safe'],
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.blocking).toBe(false);
    });

    it('filters by requested dimensions', async () => {
      await qualitySignalHandler.record({
        target_symbol: 'Filtered',
        dimension: 'conformance',
        status: 'pass',
        severity: 'info',
      }, storage);
      await qualitySignalHandler.record({
        target_symbol: 'Filtered',
        dimension: 'unit',
        status: 'fail',
        severity: 'gate',
      }, storage);

      // Only request conformance dimension, so the fail in unit should be excluded
      const result = await qualitySignalHandler.rollup({
        target_symbols: ['Filtered'],
        dimensions: ['conformance'],
      }, storage);

      expect(result.variant).toBe('ok');
      const targets = result.targets as Array<{ target_symbol: string; worst_status: string; dimensions: unknown[] }>;
      expect(targets[0].worst_status).toBe('pass');
      expect(targets[0].dimensions).toHaveLength(1);
    });

    it('rejects empty target_symbols array', async () => {
      const result = await qualitySignalHandler.rollup({
        target_symbols: [],
      }, storage);

      expect(result.variant).toBe('validationError');
    });
  });

  // ============================================================
  // explain action
  // ============================================================

  describe('explain', () => {
    it('returns all signals for a target sorted by most recent first', async () => {
      await qualitySignalHandler.record({
        target_symbol: 'Explained',
        dimension: 'conformance',
        status: 'pass',
        severity: 'gate',
        summary: 'first signal',
      }, storage);

      await new Promise(resolve => setTimeout(resolve, 5));

      await qualitySignalHandler.record({
        target_symbol: 'Explained',
        dimension: 'unit',
        status: 'warn',
        severity: 'info',
        summary: 'second signal',
      }, storage);

      await new Promise(resolve => setTimeout(resolve, 5));

      await qualitySignalHandler.record({
        target_symbol: 'Explained',
        dimension: 'snapshot',
        status: 'fail',
        severity: 'warn',
        summary: 'third signal',
      }, storage);

      const result = await qualitySignalHandler.explain({
        target_symbol: 'Explained',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.target_symbol).toBe('Explained');
      const signals = result.signals as Array<Record<string, unknown>>;
      expect(signals).toHaveLength(3);

      // Should be sorted most recent first
      expect((signals[0].observed_at as string) >= (signals[1].observed_at as string)).toBe(true);
      expect((signals[1].observed_at as string) >= (signals[2].observed_at as string)).toBe(true);
    });

    it('filters explain results by dimension', async () => {
      await qualitySignalHandler.record({
        target_symbol: 'FilteredExplain',
        dimension: 'conformance',
        status: 'pass',
        severity: 'gate',
      }, storage);
      await qualitySignalHandler.record({
        target_symbol: 'FilteredExplain',
        dimension: 'unit',
        status: 'fail',
        severity: 'gate',
      }, storage);
      await qualitySignalHandler.record({
        target_symbol: 'FilteredExplain',
        dimension: 'flaky',
        status: 'warn',
        severity: 'info',
      }, storage);

      const result = await qualitySignalHandler.explain({
        target_symbol: 'FilteredExplain',
        dimensions: ['conformance', 'flaky'],
      }, storage);

      expect(result.variant).toBe('ok');
      const signals = result.signals as Array<Record<string, unknown>>;
      expect(signals).toHaveLength(2);
      const dims = signals.map(s => s.dimension);
      expect(dims).toContain('conformance');
      expect(dims).toContain('flaky');
      expect(dims).not.toContain('unit');
    });

    it('returns empty signals array for a target with no recordings', async () => {
      const result = await qualitySignalHandler.explain({
        target_symbol: 'NoSignals',
      }, storage);

      expect(result.variant).toBe('ok');
      const signals = result.signals as unknown[];
      expect(signals).toHaveLength(0);
    });

    it('rejects missing target_symbol', async () => {
      const result = await qualitySignalHandler.explain({}, storage);

      expect(result.variant).toBe('validationError');
      expect(result.message).toContain('target_symbol');
    });
  });

  // ============================================================
  // Integration: full signal lifecycle flow
  // ============================================================

  describe('signal lifecycle flow', () => {
    it('records, retrieves latest, rolls up, and explains across multiple targets', async () => {
      // Record signals for two targets across several dimensions
      await qualitySignalHandler.record({
        target_symbol: 'ModA',
        dimension: 'conformance',
        status: 'pass',
        severity: 'gate',
      }, storage);
      await qualitySignalHandler.record({
        target_symbol: 'ModA',
        dimension: 'unit',
        status: 'pass',
        severity: 'gate',
      }, storage);
      await qualitySignalHandler.record({
        target_symbol: 'ModA',
        dimension: 'formal',
        status: 'warn',
        severity: 'warn',
      }, storage);

      await qualitySignalHandler.record({
        target_symbol: 'ModB',
        dimension: 'conformance',
        status: 'fail',
        severity: 'gate',
      }, storage);
      await qualitySignalHandler.record({
        target_symbol: 'ModB',
        dimension: 'snapshot',
        status: 'pass',
        severity: 'info',
      }, storage);

      // Latest: ModA conformance should be pass
      const latestResult = await qualitySignalHandler.latest({
        target_symbol: 'ModA',
        dimension: 'conformance',
      }, storage);
      expect(latestResult.variant).toBe('ok');
      expect((latestResult.signal as Record<string, unknown>).status).toBe('pass');

      // Rollup: both targets
      const rollupResult = await qualitySignalHandler.rollup({
        target_symbols: ['ModA', 'ModB'],
      }, storage);
      expect(rollupResult.variant).toBe('ok');
      // ModB has gate + fail, so blocking
      expect(rollupResult.blocking).toBe(true);

      const targets = rollupResult.targets as Array<{ target_symbol: string; worst_status: string }>;
      const modA = targets.find(t => t.target_symbol === 'ModA');
      const modB = targets.find(t => t.target_symbol === 'ModB');
      expect(modA?.worst_status).toBe('warn');
      expect(modB?.worst_status).toBe('fail');

      // Explain: ModB should have 2 signals
      const explainResult = await qualitySignalHandler.explain({
        target_symbol: 'ModB',
      }, storage);
      expect(explainResult.variant).toBe('ok');
      expect((explainResult.signals as unknown[]).length).toBe(2);
    });
  });
});
